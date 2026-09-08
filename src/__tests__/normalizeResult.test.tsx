import {
  normalizeResult,
  normalizeResultJson,
  extractImageQualityChecks,
} from '../normalizeResult';

describe('normalizeResult', () => {
  it('passes through flat FacePlugin verification unchanged (idempotent)', () => {
    const raw = JSON.stringify({
      errorCode: 0,
      documentName: 'US DL',
      countryName: 'USA',
      score: 0.95,
      verification: {
        overall: 0,
        docType: 0,
        expiry: 1,
        text: 0,
        mrz: 2,
        security: 0,
        imageQA: 1,
        portrait: 2,
        reasons: {
          expiry: ['expired'],
          imageQA: ['focus'],
        },
      },
      imageQuality: { checks: { focus: 0, glares: 1 } },
      ocr: { dateOfBirth: '1990' },
      images: [{ name: 'Portrait', image: 'a'.repeat(40) }],
    });
    const out = normalizeResult(raw);
    expect(out.verification?.overall).toBe(0);
    expect(out.verification?.docType).toBe(0);
    expect(out.verification?.expiry).toBe(1);
    expect(out.verification?.text).toBe(0);
    expect(out.verification?.mrz).toBe(2);
    expect(out.verification?.security).toBe(0);
    expect(out.verification?.imageQA).toBe(1);
    expect(out.verification?.portrait).toBe(2);
    expect(out.verification?.reasons?.expiry).toEqual(['expired']);
    expect(out.imageQuality?.checks?.focus).toBe(0);
    expect(out.images?.[0]!.name).toBe('Portrait');
    expect(out.documentName).toBe('US DL');
  });

  it('maps Android status.detailsOptical → verification (FacePlugin codes)', () => {
    // Native optical: overallStatus 1=OK, CheckResult 1=OK / 0=Error
    const raw = JSON.stringify({
      errorCode: 0,
      documentName: 'Android Doc',
      status: {
        overallStatus: 1,
        detailsOptical: {
          docType: 1,
          expiry: 1,
          text: 0,
          mrz: 2,
          security: 1,
          imageQA: 0,
        },
        portrait: 2,
      },
      imageQuality: {
        list: [
          { id: 'focus', result: 1 },
          { type: 0, result: 0 },
        ],
      },
      images: [{ fieldName: 'Portrait', data: 'b'.repeat(40), source: 'visual' }],
    });
    const out = normalizeResult(raw);
    expect(out.verification?.overall).toBe(0); // Verified
    expect(out.verification?.docType).toBe(0); // Pass
    expect(out.verification?.expiry).toBe(0); // Pass
    expect(out.verification?.text).toBe(1); // Fail
    expect(out.verification?.portrait).toBe(2);
    expect(out.imageQuality?.checks?.focus).toBe(1);
    expect(out.imageQuality?.checks?.glares).toBe(0);
    expect(out.images?.[0]).toEqual({
      name: 'Portrait',
      image: 'b'.repeat(40),
      source: 'visual',
    });
    // Keep original status for soft compatibility
    expect(out.status).toBeDefined();
  });

  it('flattens Android verification.checks → flat FacePlugin verification', () => {
    const raw = JSON.stringify({
      errorCode: 0,
      verification: {
        result: 1,
        label: 'VERIFIED',
        checks: {
          docType: { result: 1 },
          expiry: { result: 1 },
          text: { result: 0, reason: 'comparison failed' },
          mrz: { result: 2 },
          security: { result: 1 },
          imageQA: { result: 0, reason: 'focus; glares' },
          portrait: { result: 2 },
        },
      },
      imageQuality: {
        result: 0,
        checks: { focus: 0, glares: 1, resolution: 1 },
      },
    });
    const out = normalizeResult(raw);
    expect(out.verification?.overall).toBe(0);
    expect(out.verification?.docType).toBe(0);
    expect(out.verification?.expiry).toBe(0);
    expect(out.verification?.text).toBe(1);
    expect(out.verification?.mrz).toBe(2);
    expect(out.verification?.security).toBe(0);
    expect(out.verification?.imageQA).toBe(1);
    expect(out.verification?.portrait).toBe(2);
    expect(out.verification?.reasons?.text).toEqual(['comparison failed']);
    expect(out.verification?.reasons?.imageQA).toEqual(['focus; glares']);
    // Nested checks removed from canonical shape
    expect((out.verification as any)?.checks).toBeUndefined();
    expect(out.imageQuality?.checks?.focus).toBe(0);
    expect(out.imageQuality?.checks?.glares).toBe(1);
  });

  it('normalizeResultJson round-trips', () => {
    const raw = JSON.stringify({
      errorCode: 0,
      status: { overallStatus: 1, detailsOptical: { docType: 1 } },
    });
    const json = normalizeResultJson(raw);
    const again = JSON.parse(json);
    expect(again.verification.overall).toBe(0);
    expect(again.verification.docType).toBe(0);
  });

  it('extractImageQualityChecks handles flat named keys', () => {
    const checks = extractImageQualityChecks({ focus: 1, glares: 0 });
    expect(checks.focus).toBe(1);
    expect(checks.glares).toBe(0);
  });

  it('converts Android float QA scores to CheckResult ints', () => {
    const raw = JSON.stringify({
      verification: {
        result: 1,
        checks: { imageQA: { result: 0 } },
      },
      imageQuality: {
        checks: { focus: 0.973, glares: 0.512, bounds: 2 },
      },
    });
    const out = normalizeResult(raw);
    expect(out.imageQuality?.checks?.focus).toBe(1);
    expect(out.imageQuality?.checks?.glares).toBe(0);
    expect(out.imageQuality?.checks?.bounds).toBe(2);
  });

  it('merges pre-existing verification.reasons with nested checks', () => {
    const raw = JSON.stringify({
      verification: {
        result: 1,
        reasons: { expiry: ['expired'] },
        checks: {
          docType: { result: 1 },
          expiry: { result: 0 },
        },
      },
    });
    const out = normalizeResult(raw);
    expect(out.verification?.expiry).toBe(1);
    expect(out.verification?.reasons?.expiry).toEqual(['expired']);
  });
});
