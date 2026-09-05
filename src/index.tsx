import { NativeModules, Platform } from 'react-native';
import {
  authenticityModeValue,
  type AuthenticityArg,
} from './authenticityMode';
import {
  parseLicenseStatus,
  type LicenseStatus,
} from './licenseStatus';
import {
  normalizeResult,
  normalizeResultJson,
  type DocResult,
} from './normalizeResult';

const LINKING_ERROR =
  `The package 'document-reader-sdk' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

const DocumentReaderSdk = NativeModules.DocumentReaderSdk
  ? NativeModules.DocumentReaderSdk
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

export type ImageInput = string;

/** FPMC1.… machine code for license requests. */
export function getMachineCode(): Promise<string> {
  return DocumentReaderSdk.getMachineCode();
}

/** Activate with FP1.… bound to applicationId / bundle id. Returns SDK status code. */
export function setActivation(license: string): Promise<number> {
  return DocumentReaderSdk.setActivation(license);
}

/** Load engine + database (off JS thread). Returns SDK status code (0 = success). */
export function init(): Promise<number> {
  return DocumentReaderSdk.init();
}

export function deinit(): Promise<void> {
  return DocumentReaderSdk.deinit();
}

/** Open a process session. Prefer FullProcess before recognize. */
export function startNewSession(
  optionsJson: string = '{"scenario":"FullProcess","series":false}'
): Promise<string> {
  return DocumentReaderSdk.startNewSession(optionsJson);
}

/**
 * Live locate — JSON with score + position.corners.
 * Geometry hints (`_locateImageWidth/Height`) are already bridge-normalized.
 */
export function locateDocument(image: ImageInput): Promise<string> {
  return DocumentReaderSdk.locateDocument(image);
}

/**
 * Still OCR / MRZ / barcode.
 * Returns **canonical iOS-shaped** JSON (Android `status` folded into `verification`).
 * `image` is a content/file URI or base64 (optionally data: URL).
 * Starts a FullProcess session automatically (same as native demos).
 * Default authenticity matches the iOS DocumentReader demo (`true` → `normal`).
 * Pass `'normal'` / `'none'` (or `false` for none).
 */
export async function recognize(
  front: ImageInput,
  back?: ImageInput | null,
  authenticity: AuthenticityArg = true
): Promise<string> {
  const json = await DocumentReaderSdk.recognize(
    front,
    back ?? null,
    authenticityModeValue(authenticity)
  );
  return normalizeResultJson(typeof json === 'string' ? json : '');
}

/**
 * Typed recognize — same as `recognize` then `normalizeResult`.
 * Prefer this when you want a `DocResult` object instead of a JSON string.
 */
export async function recognizeResult(
  front: ImageInput,
  back?: ImageInput | null,
  authenticity: AuthenticityArg = true
): Promise<DocResult> {
  const json = await recognize(front, back, authenticity);
  return normalizeResult(json);
}

export function lastLicenseError(): Promise<string> {
  return DocumentReaderSdk.lastLicenseError();
}

/** Parsed license capabilities (`label` is what About / home status show). */
export async function getLicenseStatus(): Promise<LicenseStatus> {
  const json = await DocumentReaderSdk.getLicenseStatus();
  return parseLicenseStatus(typeof json === 'string' ? json : '');
}

/** Writes a JSON status blob to Documents/docreader_status.json (device debug). */
export function writeStatus(payload: Record<string, unknown>): Promise<void> {
  return DocumentReaderSdk.writeStatus(JSON.stringify(payload));
}

export {
  authenticityModeValue,
  type AuthenticityArg,
  type AuthenticityMode,
} from './authenticityMode';
export {
  parseLicenseStatus,
  readyStatusMessage,
  NOT_LICENSED,
  type LicenseStatus,
} from './licenseStatus';

export const SDK_SUCCESS = 0;
export const SDK_LICENSE_INVALID = 1;
export const SDK_LICENSE_EXPIRED = 2;
export const SDK_NOT_ACTIVATED = 3;
export const SDK_INIT_FAILED = 4;

export {
  normalizeResult,
  normalizeResultJson,
  extractImageQualityChecks,
  IMAGE_QA_ORDER,
  statusCode,
} from './normalizeResult';
export type {
  DocResult,
  DocVerification,
  DocImage,
} from './normalizeResult';
export {
  rows,
  summary,
  images,
  pretty,
  securityRows,
  securitySummary,
  documentPercent,
  documentCorners,
  locateImageSize,
  uprightSnapshotSize,
  mapUprightCornersToView,
} from './resultParser';
export type { FieldRow, ResultImage, Point, SecurityRow } from './resultParser';
export { DocumentReaderSdk };
