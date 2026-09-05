import {
  rows,
  securityRows,
  securitySummary,
  summary,
} from '../../example/src/resultParser';

function rowValue(raw: string, key: string): string | undefined {
  return rows(raw).find((r) => r.key === key)?.value;
}

describe('resultParser iOS parity', () => {
  it('maps Android nested wire + float QA like iOS ResultParser', () => {
    const json = JSON.stringify({
      documentName: 'CA DL',
      countryName: 'United States',
      score: 0.9,
      errorCode: 0,
      verification: {
        result: 1,
        label: 'VERIFIED',
        checks: {
          docType: { result: 1 },
          expiry: { result: 1 },
          text: { result: 1 },
          mrz: { result: 2 },
          security: { result: 2 },
          imageQA: { result: 0 },
          portrait: { result: 2 },
        },
      },
      imageQuality: {
        checks: { focus: 0.973, glares: 0.512, bounds: 2, custom: 1.0 },
      },
      ocr: { documentNumber: 'X1', checkSums: 'skip' },
      mrz: {},
      barcode: { raw: 'ABC' },
    });
    expect(rowValue(json, 'overall')).toBe('Verified');
    expect(rowValue(json, 'imageQA')).toBe('Fail (glares)');
    expect(rowValue(json, 'focus')).toBe('Pass');
    expect(rowValue(json, 'glares')).toBe('Fail');
    expect(rowValue(json, 'bounds')).toBe('Not checked');
    expect(rowValue(json, 'custom')).toBe('Pass');
  });

  it('maps flat FacePlugin wire like iOS ResultParser', () => {
    const json = JSON.stringify({
      documentName: 'CA DL',
      countryName: 'United States',
      score: 0.9,
      errorCode: 0,
      verification: {
        overall: 0,
        docType: 0,
        expiry: 0,
        text: 0,
        mrz: 2,
        security: 2,
        imageQA: 1,
        portrait: 2,
      },
      imageQuality: {
        checks: { focus: 1, glares: 0, bounds: 2, custom: 1 },
      },
      ocr: { documentNumber: 'X1', checkSums: 'skip' },
      mrz: {},
      barcode: { raw: 'ABC' },
    });
    const parsed = rows(json);
    expect(parsed.map((r) => r.source)).toEqual([
      'meta',
      'meta',
      'meta',
      'meta',
      'Verify',
      'Verify',
      'Verify',
      'Verify',
      'Verify',
      'Verify',
      'Verify',
      'Verify',
      'Image QA',
      'Image QA',
      'Image QA',
      'Image QA',
      'OCR',
      'Barcode',
    ]);
    expect(parsed.map((r) => r.key)).toEqual([
      'documentName',
      'countryName',
      'score',
      'errorCode',
      'overall',
      'docType',
      'expiry',
      'text',
      'mrz',
      'security',
      'imageQA',
      'portrait',
      'focus',
      'glares',
      'bounds',
      'custom',
      'documentNumber',
      'raw',
    ]);
    expect(rowValue(json, 'overall')).toBe('Verified');
    expect(rowValue(json, 'imageQA')).toBe('Fail (glares)');
    expect(summary(json)).toContain('Verification: Verified');
  });

  it('derives imageQA Pass from CheckResult checks when all pass', () => {
    const json = JSON.stringify({
      verification: {
        overall: 0,
        imageQA: 1,
        reasons: { imageQA: ['focus', 'glares', 'resolution'] },
      },
      imageQuality: {
        checks: { focus: 1, glares: 1, resolution: 1 },
      },
    });
    expect(rowValue(json, 'imageQA')).toBe('Pass');
    expect(rowValue(json, 'focus')).toBe('Pass');
    expect(rowValue(json, 'glares')).toBe('Pass');
    expect(rowValue(json, 'resolution')).toBe('Pass');
  });
});

describe('security tab mapping', () => {
  it('maps per-page authenticity like native ResultParser', () => {
    const json = JSON.stringify({
      security: {
        overall: 'authentic',
        label: 'Authentic',
        pages: [
          {
            pageIndex: 0,
            overall: 'authentic',
            label: 'Authentic',
            photoOriginAnalysis: { result: 'success', title: 'Photo origin analysis' },
            securityPattern: { score: 94.2, title: 'Security pattern analysis' },
            liveness: {
              result: 'fail',
              title: 'Liveness',
              checks: {
                print: { result: 'fail', title: 'Print attack' },
                screen: { result: 'notChecked', title: 'Screen replay' },
              },
            },
          },
        ],
      },
    });
    expect(securitySummary(json)).toBe('Document: Authentic\nFront: Authentic');
    expect(securityRows(json)).toEqual([
      { page: 'Front', check: 'Overall', status: 'Authentic' },
      { page: 'Front', check: 'Photo origin analysis', status: 'Pass' },
      { page: 'Front', check: 'Security pattern analysis', status: '94.2%' },
      { page: 'Front', check: 'Liveness', status: 'Fail' },
      { page: 'Front', check: '  → Print attack', status: 'Fail' },
      { page: 'Front', check: '  → Screen replay', status: 'Not checked' },
    ]);
  });

  it('explains missing security when the payload has none', () => {
    expect(securitySummary('{"errorCode":0}')).toContain(
      'this license may not include liveness'
    );
    expect(securityRows('{"errorCode":0}')).toEqual([]);
  });
});
