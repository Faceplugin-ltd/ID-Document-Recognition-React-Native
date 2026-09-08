import type { Camera } from 'react-native-vision-camera';
import { locateDocument } from '../index';
import {
  documentCorners,
  documentPercent,
  locateImageSize,
  mapUprightCornersToView,
  uprightSnapshotSize,
  type Point,
} from '../resultParser';

export type LocateSettings = {
  showThreshold?: number;
  highThreshold?: number;
  keepCaptureMin?: number;
  pollMs?: number;
};

export type LocateFrame = {
  scorePct: number;
  corners: Point[] | null;
  path: string;
  high: boolean;
  show: boolean;
};

export type LocateSessionOptions = {
  settings?: LocateSettings;
  onFrame: (frame: LocateFrame) => void;
};

export class LocateSession {
  readonly settings: Required<LocateSettings>;
  readonly onFrame: (frame: LocateFrame) => void;

  viewSize = { w: 0, h: 0 };

  private camera: Camera | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private locating = false;
  private stopped = false;

  constructor(opts: LocateSessionOptions) {
    this.settings = {
      showThreshold: opts.settings?.showThreshold ?? 50,
      highThreshold: opts.settings?.highThreshold ?? 85,
      keepCaptureMin: opts.settings?.keepCaptureMin ?? 50,
      pollMs: opts.settings?.pollMs ?? 450,
    };
    this.onFrame = opts.onFrame;
  }

  attach(camera: Camera): void {
    this.camera = camera;
  }

  updateViewSize(w: number, h: number): void {
    this.viewSize = { w, h };
  }

  start(): void {
    this.stopped = false;
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.settings.pollMs);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  dispose(): void {
    this.stop();
  }

  private async tick(): Promise<void> {
    if (this.stopped || this.locating || !this.camera) return;
    this.locating = true;
    try {
      const photo = await this.camera.takeSnapshot({ quality: 60 });
      const uri = photo.path.startsWith('file://')
        ? photo.path
        : `file://${photo.path}`;

      const locateJson = await locateDocument(uri);
      const pct = documentPercent(locateJson);
      const pts = documentCorners(locateJson);
      const show = pct >= this.settings.showThreshold && pts != null;
      const high = pct >= this.settings.highThreshold;

      const imageSize =
        locateImageSize(locateJson) ??
        uprightSnapshotSize(photo.width, photo.height, photo.orientation);

      const mapped =
        show && pts
          ? mapUprightCornersToView(
              pts,
              imageSize.width,
              imageSize.height,
              this.viewSize.w,
              this.viewSize.h
            )
          : null;

      this.onFrame({
        scorePct: pct,
        corners: mapped,
        path: uri,
        high,
        show,
      });
    } catch {
      // Transient snapshot/locate errors while framing.
    } finally {
      this.locating = false;
    }
  }
}
