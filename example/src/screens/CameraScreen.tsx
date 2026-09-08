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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Polygon } from 'react-native-svg';
import { recognize, type Point } from 'document-reader-sdk';
import { LocateSession } from 'document-reader-sdk/locate';
import { colors } from '../theme';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Camera'>;

const HIGH_THRESHOLD = 85;
const KEEP_CAPTURE_MIN = 50;

export default function CameraScreen({ navigation }: Props) {
  const { width, height } = useWindowDimensions();
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const cameraRef = useRef<Camera>(null);
  const capturedRef = useRef(false);
  const latestUriRef = useRef<string | null>(null);
  const lastStillMsRef = useRef(0);
  const sessionRef = useRef<LocateSession | null>(null);
  const viewSizeRef = useRef({ w: width, h: height });

  const [scorePct, setScorePct] = useState(0);
  const [corners, setCorners] = useState<Point[] | null>(null);
  const [hint, setHint] = useState('Align the ID inside the frame');
  const [busy, setBusy] = useState(false);
  const [captureEnabled, setCaptureEnabled] = useState(false);

  useEffect(() => {
    viewSizeRef.current = { w: width, h: height };
    sessionRef.current?.updateViewSize(width, height);
  }, [width, height]);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const beginRecognize = useCallback(
    async (uri: string) => {
      if (capturedRef.current) return;
      capturedRef.current = true;
      setBusy(true);
      setHint('Reading document…');
      try {
        sessionRef.current?.stop();
        const json = await recognize(uri);
        navigation.replace('Result', { json });
      } catch (e: any) {
        capturedRef.current = false;
        setBusy(false);
        setHint(e?.message ?? String(e));
      }
    },
    [navigation]
  );

  useEffect(() => {
    if (!hasPermission || !device || busy) return;
    const session = new LocateSession({
      onFrame: (frame) => {
        if (capturedRef.current) return;
        setScorePct(frame.scorePct);
        setCorners(frame.corners);
        if (frame.scorePct >= KEEP_CAPTURE_MIN) {
          const now = Date.now();
          if (frame.high || now - lastStillMsRef.current > 500) {
            latestUriRef.current = frame.path;
            lastStillMsRef.current = now;
          }
          setCaptureEnabled(true);
          setHint('Ready — tap Capture or keep holding');
        } else {
          setCaptureEnabled(false);
          setHint('Align the ID inside the frame');
        }
      },
    });
    session.updateViewSize(viewSizeRef.current.w, viewSizeRef.current.h);
    sessionRef.current = session;
    const attachTimer = setInterval(() => {
      const cam = cameraRef.current;
      if (cam) {
        session.attach(cam);
        session.start();
        clearInterval(attachTimer);
      }
    }, 80);
    return () => {
      clearInterval(attachTimer);
      session.dispose();
      sessionRef.current = null;
    };
  }, [hasPermission, device, busy]);

  const onCapture = useCallback(() => {
    const uri = latestUriRef.current;
    if (!uri) return;
    beginRecognize(uri);
  }, [beginRecognize]);

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>Camera permission is required</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Allow camera</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>No back camera found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const locked = scorePct >= HIGH_THRESHOLD && corners != null;

  return (
    <View
      style={styles.root}
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        viewSizeRef.current = { w, h };
      }}
    >
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={!busy}
        photo={true}
        video={true}
        resizeMode="cover"
        outputOrientation="device"
      />

      {corners && (
        <QuadOverlay corners={corners} locked={locked} />
      )}

      <TouchableOpacity
        style={styles.close}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>

      <View style={styles.badge}>
        <Text style={styles.badgeText}>{scorePct}%</Text>
      </View>

      <Text style={styles.hint}>{hint}</Text>

      <TouchableOpacity
        style={[styles.capture, !captureEnabled && styles.captureDisabled]}
        disabled={!captureEnabled || busy}
        onPress={onCapture}
      >
        {busy ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.captureText}>Capture</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

/** Document quad in preview coordinates (matches native DocumentGuideView stroke). */
function QuadOverlay({
  corners,
  locked,
}: {
  corners: Point[];
  locked: boolean;
}) {
  const points = corners.map((c) => `${c.x},${c.y}`).join(' ');
  const stroke = locked ? colors.accent : '#60a5fa';
  const strokeWidth = locked ? 8 : 5;

  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Polygon
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  msg: { color: colors.text, fontSize: 16, textAlign: 'center' },
  btn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnText: { color: '#000', fontWeight: '700' },
  link: { color: colors.accent, marginTop: 8 },
  close: {
    position: 'absolute',
    top: 56,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  badge: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    minWidth: 72,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  badgeText: { color: colors.accent, fontSize: 20, fontWeight: '700' },
  hint: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 110,
    color: '#fff',
    fontSize: 15,
    textAlign: 'center',
  },
  capture: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    width: 180,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureDisabled: { opacity: 0.4 },
  captureText: { color: '#000', fontWeight: '700', fontSize: 16 },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
