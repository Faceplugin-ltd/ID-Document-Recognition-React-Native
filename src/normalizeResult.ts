/**
 * Canonical DocumentReader result schema matches the demo FacePlugin shape
 * (verification 0=Pass / 1=Fail). Android nested checks and iOS flat
 * `verification` both use optical StatusResult / CheckResult (1=OK, 0=Fail);
 * this middleware remaps them, folds `status.detailsOptical`, and normalizes
 * image / QA aliases so apps never need Platform.OS branches.
 *
 * Does not touch locate geometry (`position`, `_locateImageWidth/Height`).
 * `imageQuality.checks` stay CheckResult (0=Fail, 1=Pass).
 */

export type DocVerification = {
  overall?: number;
  docType?: number;
  expiry?: number;
  text?: number;
  mrz?: number;
  security?: number;
  imageQA?: number;
  portrait?: number;
  reasons?: Record<string, string[]>;
  [key: string]: unknown;
};

export type DocImage = {
  name: string;
  image: string;
  source?: string;
};

export type DocResult = {
  errorCode?: number;
  documentName?: string;
  countryName?: string;
  score?: number;
  msg?: string;
  verification?: DocVerification;
  /** Original Android status kept when present (soft compatibility). */
  status?: unknown;
  imageQuality?: { checks: Record<string, unknown> };
  ocr?: Record<string, unknown>;
  mrz?: Record<string, unknown>;
  barcode?: Record<string, unknown>;
  authenticity?: unknown;
  images?: DocImage[];
  position?: unknown;
  _locateImageWidth?: number;
  _locateImageHeight?: number;
  [key: string]: unknown;
};

export const IMAGE_QA_ORDER = [
  'focus',
  'glares',
  'resolution',
  'colorness',
  'perspective',
  'bounds',
  'portrait',
  'handwritten',
  'brightness',
  'occlusion',
];

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function statusCode(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseRoot(raw: string): Record<string, unknown> | null {
  try {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const obj = JSON.parse(trimmed);
    return asObject(obj);
  } catch {
    return null;
  }
}

/** Flatten platform image-QA variants into a name→result map. */
export function extractImageQualityChecks(
  value: unknown
): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const d = value as Record<string, unknown>;
    if (d.checks && typeof d.checks === 'object' && !Array.isArray(d.checks)) {
      return { ...(d.checks as Record<string, unknown>) };
    }
    const known = new Set(IMAGE_QA_ORDER);
    const named: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(d)) {
      if (known.has(k) && !(v && typeof v === 'object') && !Array.isArray(v)) {
        named[k] = v;
      }
    }
    if (Object.keys(named).length) return named;
  }

  const out: Record<string, unknown> = {};
  const pages: unknown[] = Array.isArray(value)
    ? value
    : value &&
        typeof value === 'object' &&
        Array.isArray((value as Record<string, unknown>).list)
      ? [(value as Record<string, unknown>).list]
      : [];

  for (const page of pages) {
    let checks: unknown[] = [];
    if (page && typeof page === 'object' && !Array.isArray(page)) {
      const d = page as Record<string, unknown>;
      if (
        d.checks &&
        typeof d.checks === 'object' &&
        !Array.isArray(d.checks)
      ) {
        Object.assign(out, d.checks as Record<string, unknown>);
        continue;
      }
      checks = Array.isArray(d.list) ? d.list : [];
    } else if (Array.isArray(page)) {
      checks = page;
    }
    for (const item of checks) {
      if (!item || typeof item !== 'object') continue;
      const c = item as Record<string, unknown>;
      const result = c.result ?? c.Result;
      const name =
        (typeof c.id === 'string' && c.id) ||
        (typeof c.name === 'string' && c.name) ||
        '';
      if (name) {
        out[name] = result;
        continue;
      }
      const type = statusCode(c.type ?? c.Type);
      const idMap: Record<number, string> = {
        0: 'glares',
        1: 'focus',
        2: 'resolution',
        3: 'colorness',
        4: 'perspective',
        5: 'bounds',
        7: 'portrait',
        8: 'handwritten',
        9: 'brightness',
        10: 'occlusion',
      };
      if (type == null) continue;
      out[idMap[type] ?? `${type}`] = result;
    }
  }
  return out;
}

function qaScoreToCheckResult(value: unknown): unknown {
  const n = statusCode(value);
  if (n == null) return value;
  if (n === 0 || n === 1 || n === 2) return n;
  // Android wire scores are 0…1 quality; only near-perfect reads as Pass in UI.
  if (n > 0 && n <= 1) return n >= 0.9 ? 1 : 0;
  return value;
}

function normalizeImageQualityChecks(
  checks: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(checks)) {
    out[key] = qaScoreToCheckResult(val);
  }
  return out;
}
const VERIFY_CHECK_KEYS = [
  'docType',
  'expiry',
  'text',
  'mrz',
  'security',
  'imageQA',
  'portrait',
] as const;

/**
 * Android DocSDK `verification` / iOS flat optical codes use native
 * StatusResult / CheckResult: overall 1=Verified, 0=Not verified, 2=Not checked;
 * check 1=Pass, 0=Fail, 2=Not checked.
 * Canonical demo UI uses FacePlugin codes: 0=OK/Pass, 1=fail, 2=was-not-done.
 */
function opticalOverallToFacePlugin(code: number): number {
  if (code === 1) return 0;
  if (code === 0) return 1;
  return code;
}

function opticalCheckToFacePlugin(code: number): number {
  if (code === 1) return 0;
  if (code === 0) return 1;
  return code;
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

function verificationFromStatus(
  status: Record<string, unknown>
): DocVerification | null {
  const v: DocVerification = {};
  if (status.overallStatus != null) {
    const n = statusCode(status.overallStatus);
    // status.detailsOptical on Android is already FacePlugin-shaped in some
    // packs; overallStatus uses 1=OK — remap when we only have status.
    if (n != null) v.overall = opticalOverallToFacePlugin(n);
  }
  const opt = asObject(status.detailsOptical);
  if (opt) {
    for (const key of VERIFY_CHECK_KEYS) {
      if (key === 'portrait') continue;
      if (opt[key] != null) {
        const n = statusCode(opt[key]);
        if (n != null) v[key] = opticalCheckToFacePlugin(n);
        else v[key] = opt[key] as number;
      }
    }
  }
  if (status.portrait != null) {
    const n = statusCode(status.portrait);
    v.portrait = n != null ? opticalCheckToFacePlugin(n) : (status.portrait as number);
  } else if (opt?.portrait != null) {
    const n = statusCode(opt.portrait);
    v.portrait = n != null ? opticalCheckToFacePlugin(n) : (opt.portrait as number);
  }
  return Object.keys(v).length ? v : null;
}

/**
 * Flatten Android nested `verification.checks` → flat keys, and remap optical
 * StatusResult / CheckResult (1=OK, 0=Fail) → FacePlugin (0=Pass, 1=Fail).
 *
 * Both Android nested checks and iOS flat `verification` use optical codes from
 * the engine; the Result UI always expects FacePlugin. Remap nested checks and
 * status.detailsOptical only — flat FacePlugin verification is left unchanged
 * so normalizeResult stays idempotent (matches iOS adaptUnifiedWire).
 */
function canonicalizeVerification(
  raw: Record<string, unknown>
): DocVerification | null {
  const checks = asObject(raw.checks);
  const looksNested =
    !!checks &&
    Object.values(checks).some(
      (c) => c && typeof c === 'object' && !Array.isArray(c)
    );

  if (!looksNested) {
    const v: DocVerification = { ...raw };
    if (v.overall == null && raw.result != null) {
      const n = statusCode(raw.result);
      if (n != null) v.overall = opticalOverallToFacePlugin(n);
    }
    delete (v as Record<string, unknown>).checks;
    delete (v as Record<string, unknown>).result;
    delete (v as Record<string, unknown>).label;
    return Object.keys(v).length ? v : null;
  }

  const v: DocVerification = {};
  const overallRaw = statusCode(raw.result ?? raw.overall);
  if (overallRaw != null) {
    v.overall = opticalOverallToFacePlugin(overallRaw);
  }

  const reasons: Record<string, string[]> = {};
  const existingReasons = asObject(raw.reasons);
  if (existingReasons) {
    for (const [key, val] of Object.entries(existingReasons)) {
      const list = stringList(val);
      if (list.length) reasons[key] = list;
    }
  }
  for (const key of VERIFY_CHECK_KEYS) {
    const cell = checks![key];
    if (cell == null) continue;
    if (typeof cell === 'object' && !Array.isArray(cell)) {
      const c = cell as Record<string, unknown>;
      const n = statusCode(c.result ?? c.Result);
      if (n != null) v[key] = opticalCheckToFacePlugin(n);
      const reason =
        (typeof c.reason === 'string' && c.reason) ||
        (typeof c.Reason === 'string' && c.Reason) ||
        '';
      if (reason.trim()) reasons[key] = [reason.trim()];
    } else {
      const n = statusCode(cell);
      if (n != null) v[key] = opticalCheckToFacePlugin(n);
    }
  }

  if (Object.keys(reasons).length) {
    v.reasons = reasons;
  }
  return Object.keys(v).length ? v : null;
}

function hasFlatVerification(obj: Record<string, unknown>): boolean {
  const v = asObject(obj.verification);
  if (!v || !Object.keys(v).length) return false;
  if (v.overall != null || VERIFY_CHECK_KEYS.some((k) => v[k] != null)) {
    const checks = asObject(v.checks);
    if (!checks) return true;
    // Nested checks means not yet flattened.
    return !Object.values(checks).some(
      (c) => c && typeof c === 'object' && !Array.isArray(c)
    );
  }
  return false;
}

function normalizeImages(value: unknown): DocImage[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: DocImage[] = [];
  for (const item of value) {
    if (typeof item === 'string') {
      if (item.length >= 32) out.push({ name: 'Image', image: item });
      continue;
    }
    const d = asObject(item);
    if (!d) continue;
    const image =
      (typeof d.image === 'string' && d.image) ||
      (typeof d.value === 'string' && d.value) ||
      (typeof d.data === 'string' && d.data) ||
      '';
    if (image.length < 32) continue;
    const name =
      (typeof d.name === 'string' && d.name) ||
      (typeof d.fieldName === 'string' && d.fieldName) ||
      (typeof d.role === 'string' && d.role) ||
      'Image';
    const source = typeof d.source === 'string' ? d.source : undefined;
    out.push(source ? { name, image, source } : { name, image });
  }
  return out;
}

/**
 * Parse + fold Android-oriented fields into the iOS/demo canonical schema.
 * Identity for payloads that already use `verification` + `{checks}` QA.
 */
export function normalizeResult(raw: string): DocResult {
  const obj = parseRoot(raw);
  if (!obj) {
    return {};
  }

  const out: DocResult = { ...obj };

  const rawVerification = asObject(out.verification);
  if (rawVerification) {
    const flat = canonicalizeVerification(rawVerification);
    if (flat) out.verification = flat;
  }

  if (!hasFlatVerification(out) && asObject(out.status)) {
    const mapped = verificationFromStatus(asObject(out.status)!);
    if (mapped) out.verification = mapped;
  }

  if (out.imageQuality != null) {
    const checks = extractImageQualityChecks(out.imageQuality);
    if (Object.keys(checks).length) {
      out.imageQuality = { checks: normalizeImageQualityChecks(checks) };
    }
  }

  if (Array.isArray(out.images)) {
    const images = normalizeImages(out.images);
    if (images) out.images = images;
  }

  return out;
}

/** Same as `normalizeResult`, returned as a JSON string (for Promise APIs). */
export function normalizeResultJson(raw: string): string {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) return raw ?? '';
  try {
    JSON.parse(trimmed);
  } catch {
    return raw;
  }
  return JSON.stringify(normalizeResult(trimmed));
}
