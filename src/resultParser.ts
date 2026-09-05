/** Maps DocSDK JSON into UI fields — same contract as native ResultParser. */

import {
  extractImageQualityChecks,
  IMAGE_QA_ORDER,
  normalizeResult,
  statusCode,
} from './normalizeResult';

export type FieldRow = { key: string; value: string; source: string };

export type ResultImage = {
  category: string;
  source: string;
  uri: string;
};

const LONG_VALUE = 300;

const SKIP_KEYS = new Set([
  'checkSums',
  'contrastPrint',
  'docFormat',
  'mrzFormat',
  'mrzFormatCheckdigit',
  'mrzStringsWithCorrectCheckSums',
  'numberChecksumValidity',
  'numberValidity',
  'overallValidity',
  'symbolMatrix',
  'images',
]);

function jsonObject(raw: string): Record<string, unknown> | null {
  try {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    // Always fold Android → iOS schema before UI mapping.
    const normalized = normalizeResult(trimmed);
    return Object.keys(normalized).length ? normalized : null;
  } catch {
    return null;
  }
}

function summarizeLong(value: string): string {
  let type = 'string';
  if (value.startsWith('/9j/') || value.startsWith('data:image/jpeg'))
    type = 'jpeg';
  else if (value.startsWith('iVBOR') || value.startsWith('data:image/png'))
    type = 'png';
  else if (value.startsWith('R0lGOD') || value.startsWith('data:image/gif'))
    type = 'gif';
  else if (value.startsWith('Qk') && value.length > 100) type = 'bmp';
  else if (/^[A-Za-z0-9+/=]+$/.test(value)) type = 'base64';
  return `${type}, ${value.length} chars`;
}

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitize(v);
    }
    return out;
  }
  if (typeof value === 'string' && value.length > LONG_VALUE) {
    return summarizeLong(value);
  }
  return value;
}

export function pretty(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '(empty response)';
  try {
    const obj = normalizeResult(trimmed);
    return JSON.stringify(sanitize(obj), null, 2);
  } catch {
    return summarizeLong(trimmed);
  }
}

function overallLabel(code: number): string {
  switch (code) {
    case 0:
      return 'Verified';
    case 1:
      return 'Not verified';
    case 2:
      return 'Not checked';
    default:
      return `${code}`;
  }
}

function checkLabel(code: number): string {
  switch (code) {
    case 0:
      return 'Pass';
    case 1:
      return 'Fail';
    case 2:
      return 'Not checked';
    default:
      return `${code}`;
  }
}

function checkResultLabel(code: number): string {
  switch (code) {
    case 0:
      return 'Fail';
    case 1:
      return 'Pass';
    case 2:
      return 'Not checked';
    default:
      return `${code}`;
  }
}

function imageQualityChecks(value: unknown): Record<string, unknown> {
  return extractImageQualityChecks(value);
}

function rowsFromMap(
  data: Record<string, unknown> | undefined,
  source: string
): FieldRow[] {
  if (!data) return [];
  const out: FieldRow[] = [];
  for (const key of Object.keys(data).sort()) {
    if (SKIP_KEYS.has(key)) continue;
    if (/^field\d+$/.test(key)) continue;
    const value = data[key];
    if (value && typeof value === 'object') continue;
    out.push({ key, value: `${value}`, source });
  }
  return out;
}

function rowsFromImageQuality(value: unknown): FieldRow[] {
  const checks = imageQualityChecks(value);
  if (!Object.keys(checks).length) return [];
  const out: FieldRow[] = [];
  const seen = new Set<string>();
  for (const key of IMAGE_QA_ORDER) {
    if (!(key in checks)) continue;
    seen.add(key);
    const code = checkResultCode(checks[key]);
    out.push({
      key,
      value: code != null ? checkResultLabel(code) : `${checks[key]}`,
      source: 'Image QA',
    });
  }
  for (const key of Object.keys(checks).sort()) {
    if (seen.has(key)) continue;
    const code = checkResultCode(checks[key]);
    out.push({
      key,
      value: code != null ? checkResultLabel(code) : `${checks[key]}`,
      source: 'Image QA',
    });
  }
  return out;
}

function worseCheckResult(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  if (a === 2 || b === 2) return 2;
  return 1;
}

function checkResultToStatus(checkResult: number): number {
  if (checkResult === 0) return 1;
  if (checkResult === 2) return 2;
  return 0;
}

/** Derive Verify imageQA from CheckResult checks so it matches Image QA rows. */
function imageQaStatusFromChecks(obj: Record<string, unknown>): number | null {
  const checks = imageQualityChecks(obj.imageQuality);
  if (!Object.keys(checks).length) return null;
  let worst = 1;
  let any = false;
  for (const val of Object.values(checks)) {
    const code = checkResultCode(val);
    if (code == null) continue;
    any = true;
    worst = worseCheckResult(worst, code);
  }
  return any ? checkResultToStatus(worst) : null;
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === 'string' && item) return [item];
      if (typeof item === 'number' && Number.isFinite(item)) return [`${item}`];
      return [];
    });
  }
  if (typeof value === 'string' && value) return [value];
  return [];
}

function qaScoreToCheckResultInt(value: unknown): number | null {
  const n = statusCode(value);
  if (n == null) return null;
  if (n === 0 || n === 1 || n === 2) return n;
  if (n > 0 && n <= 1) return n >= 0.9 ? 1 : 0;
  return null;
}

function checkResultCode(value: unknown): number | null {
  const qa = qaScoreToCheckResultInt(value);
  if (qa != null) return qa;
  return statusCode(value);
}

function verificationMap(
  obj: Record<string, unknown>
): Record<string, unknown> | null {
  let v: Record<string, unknown> | null = null;
  if (
    obj.verification &&
    typeof obj.verification === 'object' &&
    !Array.isArray(obj.verification) &&
    Object.keys(obj.verification as object).length
  ) {
    v = { ...(obj.verification as Record<string, unknown>) };
  } else if (obj.status && typeof obj.status === 'object') {
    const st = obj.status as Record<string, unknown>;
    v = {};
    if (st.overallStatus != null) v.overall = st.overallStatus;
    if (st.detailsOptical && typeof st.detailsOptical === 'object') {
      const opt = st.detailsOptical as Record<string, unknown>;
      for (const key of [
        'docType',
        'expiry',
        'text',
        'mrz',
        'security',
        'imageQA',
      ]) {
        if (opt[key] != null) v[key] = opt[key];
      }
    }
    if (st.portrait != null) v.portrait = st.portrait;
    if (!Object.keys(v).length) v = null;
  }
  if (!v) return null;

  const qa = imageQaStatusFromChecks(obj);
  if (qa != null) {
    v.imageQA = qa;
    if (
      v.reasons &&
      typeof v.reasons === 'object' &&
      !Array.isArray(v.reasons)
    ) {
      const reasons = { ...(v.reasons as Record<string, unknown>) };
      delete reasons.imageQA;
      v.reasons = reasons;
    }
  }
  return v;
}

function failedImageQaReasons(obj: Record<string, unknown>): string[] {
  const checks = imageQualityChecks(obj.imageQuality);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const key of IMAGE_QA_ORDER) {
    if (!(key in checks)) continue;
    if (checkResultCode(checks[key]) !== 0) continue;
    seen.add(key);
    out.push(key);
  }
  for (const key of Object.keys(checks).sort()) {
    if (seen.has(key)) continue;
    if (checkResultCode(checks[key]) !== 0) continue;
    out.push(key);
  }
  return out;
}

function failedAuthReasons(value: unknown): string[] {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const d = node as Record<string, unknown>;
    for (const key of [
      'liveness',
      'barcode',
      'IPI',
      'ipi',
      'imagePattern',
      'faceMatch',
      'photoEmbedding',
    ]) {
      if (statusCode(d[key]) === 0) {
        out.push(key);
        continue;
      }
      const items = d[key];
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const e = item as Record<string, unknown>;
        const result = statusCode(e.result ?? e.elementResult) ?? 1;
        if (result !== 0) continue;
        const t =
          (typeof e.type === 'string' && e.type) ||
          (typeof e.elementDiagnoseName === 'string' &&
            e.elementDiagnoseName) ||
          key;
        out.push(t);
      }
    }
  };
  walk(value);
  return out;
}

function storedReasonsForCheck(
  key: string,
  verification: Record<string, unknown>
): string[] {
  const reasonsObj = verification.reasons;
  if (
    !reasonsObj ||
    typeof reasonsObj !== 'object' ||
    Array.isArray(reasonsObj)
  ) {
    return [];
  }
  return stringList((reasonsObj as Record<string, unknown>)[key]);
}

function reasonsForCheck(
  key: string,
  verification: Record<string, unknown>,
  obj: Record<string, unknown>
): string[] {
  // FacePlugin: 0=Pass, 1=Fail. Never invent failure text for a passing check.
  const code = statusCode(verification[key]);
  if (code != null && code !== 1) return [];

  const stored = storedReasonsForCheck(key, verification);
  if (stored.length) return stored;

  switch (key) {
    case 'imageQA':
      return failedImageQaReasons(obj);
    case 'security':
      return failedAuthReasons(obj.authenticity);
    case 'docType':
      return ['not recognized'];
    case 'expiry':
      return ['expired'];
    case 'text':
      return ['comparison failed'];
    case 'mrz':
      return ['checksums'];
    case 'portrait':
      return ['mismatch'];
    case 'overall':
      return [
        'docType',
        'expiry',
        'text',
        'mrz',
        'security',
        'imageQA',
        'portrait',
      ].filter((k) => statusCode(verification[k]) === 1);
    default:
      return [];
  }
}

function labelValue(
  value: unknown,
  overall: boolean,
  reasons: string[] = []
): string {
  const code = statusCode(value);
  if (code != null) {
    // Trust the numeric code: 0=Pass/Verified, 1=Fail/Not verified.
    const label = overall ? overallLabel(code) : checkLabel(code);
    if (code === 1 && reasons.length) {
      return `${label} (${reasons.join(', ')})`;
    }
    return label;
  }
  if (typeof value === 'string' && value) return value;
  return value != null ? `${value}` : '';
}

function rowsFromVerification(obj: Record<string, unknown>): FieldRow[] {
  const v = verificationMap(obj);
  if (!v) return [];
  const out: FieldRow[] = [];
  if (v.overall != null) {
    out.push({
      key: 'overall',
      value: labelValue(v.overall, true, reasonsForCheck('overall', v, obj)),
      source: 'Verify',
    });
  }
  for (const key of [
    'docType',
    'expiry',
    'text',
    'mrz',
    'security',
    'imageQA',
    'portrait',
  ]) {
    if (v[key] == null) continue;
    out.push({
      key,
      value: labelValue(v[key], false, reasonsForCheck(key, v, obj)),
      source: 'Verify',
    });
  }
  return out;
}

export function summary(raw: string): string {
  const obj = jsonObject(raw);
  if (!obj) return raw.slice(0, 200);
  if (typeof obj.msg === 'string') return obj.msg;
  const err =
    typeof obj.errorCode === 'number'
      ? obj.errorCode
      : Number(obj.errorCode ?? -1);
  const score =
    typeof obj.score === 'number'
      ? obj.score.toFixed(3)
      : obj.score != null
        ? `${obj.score}`
        : '—';
  const v = verificationMap(obj);
  const verification =
    v?.overall != null
      ? labelValue(v.overall, true, reasonsForCheck('overall', v, obj))
      : 'Not checked';
  return [
    `Status: ${err === 0 ? 'OK' : 'Failed'} (errorCode=${err})`,
    `Document: ${typeof obj.documentName === 'string' ? obj.documentName : '—'}`,
    `Country: ${typeof obj.countryName === 'string' ? obj.countryName : '—'}`,
    `Verification: ${verification}`,
    `Score: ${score}`,
  ].join('\n');
}

export function rows(raw: string): FieldRow[] {
  const obj = jsonObject(raw);
  if (!obj) return [];
  const out: FieldRow[] = [
    {
      key: 'documentName',
      value: typeof obj.documentName === 'string' ? obj.documentName : '',
      source: 'meta',
    },
    {
      key: 'countryName',
      value: typeof obj.countryName === 'string' ? obj.countryName : '',
      source: 'meta',
    },
    {
      key: 'score',
      value: obj.score != null ? `${obj.score}` : '—',
      source: 'meta',
    },
    {
      key: 'errorCode',
      value: obj.errorCode != null ? `${obj.errorCode}` : '',
      source: 'meta',
    },
  ];
  out.push(...rowsFromVerification(obj));
  out.push(...rowsFromImageQuality(obj.imageQuality));
  out.push(
    ...rowsFromMap(
      obj.ocr && typeof obj.ocr === 'object'
        ? (obj.ocr as Record<string, unknown>)
        : undefined,
      'OCR'
    )
  );
  out.push(
    ...rowsFromMap(
      obj.mrz && typeof obj.mrz === 'object'
        ? (obj.mrz as Record<string, unknown>)
        : undefined,
      'MRZ'
    )
  );
  out.push(
    ...rowsFromMap(
      obj.barcode && typeof obj.barcode === 'object'
        ? (obj.barcode as Record<string, unknown>)
        : undefined,
      'Barcode'
    )
  );
  return out.filter((r) => r.value && r.value !== 'null');
}

export function images(raw: string): ResultImage[] {
  const obj = jsonObject(raw);
  if (!obj || !Array.isArray(obj.images)) return [];
  const out: ResultImage[] = [];
  const seen = new Set<string>();
  for (const item of obj.images) {
    let b64 = '';
    let category = 'Image';
    let source = '';
    if (typeof item === 'string') {
      b64 = item;
    } else if (item && typeof item === 'object') {
      const d = item as Record<string, unknown>;
      b64 =
        (typeof d.image === 'string' && d.image) ||
        (typeof d.value === 'string' && d.value) ||
        (typeof d.data === 'string' && d.data) ||
        '';
      const rawName =
        (typeof d.name === 'string' && d.name) ||
        (typeof d.fieldName === 'string' && d.fieldName) ||
        (typeof d.role === 'string' && d.role) ||
        '';
      category = rawName || 'Image';
      source = typeof d.source === 'string' ? d.source : '';
    }
    if (b64.length < 32) continue;
    const key = `${category.toLowerCase()}|${source.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const payload = b64.includes('base64,')
      ? b64.slice(b64.indexOf('base64,') + 7)
      : b64;
    const mime = b64.startsWith('iVBOR') ? 'image/png' : 'image/jpeg';
    out.push({
      category,
      source,
      uri: `data:${mime};base64,${payload}`,
    });
  }
  return out;
}

/** ID-type confidence 0–100 from locate/recognize `score`. */
export function documentPercent(raw: string): number {
  const obj = jsonObject(raw);
  if (!obj || obj.score == null) return 0;
  const s = Number(obj.score);
  if (!Number.isFinite(s)) return 0;
  const pct = s <= 1.0 ? s * 100.0 : s;
  return Math.max(0, Math.min(100, Math.trunc(pct)));
}

export type Point = { x: number; y: number };

/** Snapshot pixel size after EXIF/orientation (portrait upright). */
export function uprightSnapshotSize(
  width: number,
  height: number,
  orientation?: string
): { width: number; height: number } {
  // vision-camera takeSnapshot on iOS: physical landscape pixels, often no EXIF.
  if (width > height) {
    return { width: height, height: width };
  }
  const o = orientation ?? 'portrait';
  if (o === 'landscape-left' || o === 'landscape-right') {
    return { width: height, height: width };
  }
  return { width, height };
}

/** Upright bitmap size used for locate (from native bridge when available). */
export function locateImageSize(
  raw: string
): { width: number; height: number } | null {
  const obj = jsonObject(raw);
  if (!obj) return null;
  const w = Number(obj._locateImageWidth);
  const h = Number(obj._locateImageHeight);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return null;
  }
  return { width: w, height: h };
}

/**
 * Map locate corners (upright bitmap pixels) into preview view coords.
 * Matches native iOS CameraViewController.mapUprightCornersToView (aspect-fill + Y flip).
 */
export function mapUprightCornersToView(
  corners: Point[],
  imageW: number,
  imageH: number,
  viewW: number,
  viewH: number
): Point[] | null {
  if (
    corners.length < 4 ||
    imageW <= 1 ||
    imageH <= 1 ||
    viewW <= 1 ||
    viewH <= 1
  ) {
    return null;
  }
  const scale = Math.max(viewW / imageW, viewH / imageH);
  const dx = (viewW - imageW * scale) / 2;
  const dy = (viewH - imageH * scale) / 2;
  return corners.map((c) => ({
    x: c.x * scale + dx,
    y: (imageH - c.y) * scale + dy,
  }));
}

export function documentCorners(raw: string): Point[] | null {
  const obj = jsonObject(raw);
  if (!obj || !obj.position || typeof obj.position !== 'object') return null;
  const pos = obj.position as Record<string, unknown>;
  if (Array.isArray(pos.corners) && pos.corners.length >= 4) {
    const out: Point[] = [];
    for (let i = 0; i < 4; i++) {
      const p = pos.corners[i] as Record<string, unknown>;
      const x = Number(p?.x);
      const y = Number(p?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      out.push({ x, y });
    }
    return out;
  }
  const l = Number(pos.left);
  const t = Number(pos.top);
  const r = Number(pos.right);
  const b = Number(pos.bottom);
  if (![l, t, r, b].every(Number.isFinite) || r <= l || b <= t) return null;
  return [
    { x: l, y: t },
    { x: r, y: t },
    { x: r, y: b },
    { x: l, y: b },
  ];
}

export type SecurityRow = { page: string; check: string; status: string };

const SECURITY_PAGE_META = new Set([
  'pageIndex',
  'overall',
  'label',
  'pages',
  'presentation',
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function nonemptyString(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function pageSide(value: unknown): string {
  const n = Number(value);
  const idx = Number.isFinite(n) ? n : 0;
  if (idx === 0) return 'Front';
  if (idx === 1) return 'Back';
  return `Page ${idx}`;
}

function humanizeKey(key: string): string {
  let spaced = '';
  for (const ch of key) {
    if (ch >= 'A' && ch <= 'Z' && spaced) spaced += ' ';
    spaced += ch;
  }
  spaced = spaced.trim();
  if (!spaced) return key;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function checkTitle(key: string, raw: unknown): string {
  const d = asRecord(raw);
  const title = d && typeof d.title === 'string' ? d.title.trim() : '';
  return title || humanizeKey(key);
}

function statusKind(value: unknown): string {
  let v: unknown = value;
  const d = asRecord(v);
  if (d) {
    if (d.score != null && !asRecord(d.score)) return 'score';
    v = d.result ?? d.label;
  }
  if (typeof v === 'number' && Number.isFinite(v)) return 'score';
  const s = String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/ /g, '')
    .replace(/_/g, '');
  if (['success', 'pass', 'ok', 'authentic', '1'].includes(s)) return 'success';
  if (['notchecked', 'wasnotdone', '2'].includes(s)) return 'notChecked';
  if (['fail', 'failed', 'error', 'notauthentic', '0'].includes(s)) return 'fail';
  return 'other';
}

function formatScore(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return value == null ? '' : String(value);
  let s = n.toFixed(1);
  while (s.endsWith('0')) s = s.slice(0, -1);
  if (s.endsWith('.')) s = s.slice(0, -1);
  return `${s || '0'}%`;
}

function statusCell(value: unknown): string {
  switch (statusKind(value)) {
    case 'success':
      return 'Pass';
    case 'notChecked':
      return 'Not checked';
    case 'fail':
      return 'Fail';
    case 'score': {
      const d = asRecord(value);
      return formatScore(d ? d.score ?? d.result : value);
    }
    default: {
      const d = asRecord(value);
      const v = d ? d.result ?? d.label : value;
      return v == null ? '' : String(v);
    }
  }
}

function securityPages(sec: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(sec.pages) && sec.pages.length > 0) {
    return sec.pages
      .map((p) => asRecord(p))
      .filter((p): p is Record<string, unknown> => !!p);
  }
  const flat: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(sec)) {
    if (!SECURITY_PAGE_META.has(key)) flat[key] = value;
  }
  if (!Object.keys(flat).length) return [];
  if (sec.overall != null) flat.overall = sec.overall;
  if (sec.label != null) flat.label = sec.label;
  flat.pageIndex = 0;
  return [flat];
}

function appendSecurityValue(
  rows: SecurityRow[],
  pageName: string,
  key: string,
  raw: unknown
): void {
  const title = checkTitle(key, raw);
  const dict = asRecord(raw);
  if (!dict) {
    rows.push({ page: pageName, check: title, status: statusCell(raw) });
    return;
  }
  if (dict.score != null && !asRecord(dict.score)) {
    rows.push({ page: pageName, check: title, status: statusCell(raw) });
    return;
  }
  const kind = statusKind(raw);
  rows.push({
    page: pageName,
    check: title,
    status: statusCell(dict.result),
  });
  const checks = asRecord(dict.checks);
  if (!checks) return;
  const checkKeys = Object.keys(checks);
  if (
    kind !== 'fail' &&
    !checkKeys.some((ck) => statusKind(checks[ck]) === 'fail')
  ) {
    return;
  }
  for (const ck of checkKeys) {
    const cv = checks[ck];
    if (statusKind(cv) === 'notChecked' && kind !== 'fail') continue;
    rows.push({
      page: pageName,
      check: `  → ${checkTitle(ck, cv)}`,
      status: statusCell(cv),
    });
  }
}

/** Document / page authenticity summary — same contract as native ResultParser. */
export function securitySummary(raw: string): string {
  const obj = jsonObject(raw);
  const sec = obj ? asRecord(obj.security) : null;
  if (!sec) {
    return 'No security checks in this response. If you expected checks, this license may not include liveness.';
  }
  const pages = securityPages(sec);
  const docLabel = nonemptyString(sec.label) ?? statusCell(sec.overall) ?? '';
  if (!pages.length) {
    if (docLabel) {
      return `Document: ${docLabel}\nNo per-page checks in this response.`;
    }
    return 'No security checks in this response.';
  }
  let s = `Document: ${docLabel || '—'}`;
  for (const page of pages) {
    const name = pageSide(page.pageIndex);
    const pageLabel =
      nonemptyString(page.label) ?? statusCell(page.overall) ?? '';
    s += `\n${name}: ${pageLabel || '—'}`;
  }
  return s;
}

export function securityRows(raw: string): SecurityRow[] {
  const obj = jsonObject(raw);
  const sec = obj ? asRecord(obj.security) : null;
  if (!sec) return [];
  const pages = securityPages(sec);
  if (!pages.length) {
    const docLabel = nonemptyString(sec.label) ?? statusCell(sec.overall);
    return docLabel
      ? [{ page: '—', check: 'Overall', status: docLabel }]
      : [];
  }
  const out: SecurityRow[] = [];
  for (const page of pages) {
    const name = pageSide(page.pageIndex);
    const pageLabel =
      nonemptyString(page.label) ?? statusCell(page.overall) ?? '';
    out.push({ page: name, check: 'Overall', status: pageLabel || '—' });
    for (const [key, rawValue] of Object.entries(page)) {
      if (SECURITY_PAGE_META.has(key)) continue;
      appendSecurityValue(out, name, key, rawValue);
    }
  }
  return out;
}
