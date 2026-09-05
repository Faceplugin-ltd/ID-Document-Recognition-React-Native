import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import Svg, { Polygon } from 'react-native-svg';
import { recognize } from '../index';
import {
  LocateSession,
  type LocateSettings,
} from './LocateSession';
import type { Point } from '../resultParser';

export type DocumentCaptureProps = {
  settings?: LocateSettings;
  onRecognized: (json: string) => void;
  onCancel?: () => void;
  authenticity?: boolean | string;
};

/** Drop-in document camera: live locate + Capture → recognize. */
export function DocumentCapture({
  settings,
  onRecognized,
  onCancel,
  authenticity = true,
}: DocumentCaptureProps) {
  const { width, height } = useWindowDimensions();
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const cameraRef = useRef<Camera>(null);
  const sessionRef = useRef<LocateSession | null>(null);
  const latestUri = useRef<string | null>(null);
  const [scorePct, setScorePct] = useState(0);
  const [corners, setCorners] = useState<Point[] | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    if (!hasPermission || !device || busy) return;
    const session = new LocateSession({
      settings,
      onFrame: (frame) => {
        setScorePct(frame.scorePct);
        setCorners(frame.corners);
        setEnabled(frame.scorePct >= (settings?.keepCaptureMin ?? 50));
        if (frame.scorePct >= (settings?.keepCaptureMin ?? 50)) {
          latestUri.current = frame.path;
        }
      },
    });
    session.updateViewSize(width, height);
    sessionRef.current = session;
    const attach = setInterval(() => {
      const cam = cameraRef.current;
      if (cam) {
        session.attach(cam);
        session.start();
        clearInterval(attach);
      }
    }, 80);
    return () => {
      clearInterval(attach);
      session.dispose();
      sessionRef.current = null;
    };
  }, [hasPermission, device, busy, settings, width, height]);

  const onCapture = useCallback(async () => {
    const uri = latestUri.current;
    if (!uri || busy) return;
    setBusy(true);
    sessionRef.current?.stop();
    try {
      const json = await recognize(uri, null, authenticity);
      onRecognized(json);
    } catch {
      sessionRef.current?.start();
      setBusy(false);
    }
  }, [authenticity, busy, onRecognized]);

  if (!hasPermission || !device) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#D0BCFF" />
      </View>
    );
  }

  const points = corners?.map((c) => `${c.x},${c.y}`).join(' ') ?? '';

  return (
    <View style={styles.root}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={!busy}
        photo
        video
        resizeMode="cover"
        outputOrientation="device"
      />
      {corners ? (
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Polygon
            points={points}
            fill="none"
            stroke="#60a5fa"
            strokeWidth={5}
          />
        </Svg>
      ) : null}
      {onCancel ? (
        <TouchableOpacity style={styles.close} onPress={onCancel}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      ) : null}
      <Text style={styles.badge}>{scorePct}%</Text>
      <TouchableOpacity
        style={[styles.capture, !enabled && styles.disabled]}
        disabled={!enabled || busy}
        onPress={() => {
          void onCapture();
        }}
      >
        <Text style={styles.captureText}>{busy ? 'Reading…' : 'Capture'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  close: {
    position: 'absolute',
    top: 56,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4F378B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  badge: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    color: '#D0BCFF',
    fontSize: 20,
    fontWeight: '700',
  },
  capture: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    width: 180,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#D0BCFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  captureText: { color: '#000', fontWeight: '700', fontSize: 16 },
});
