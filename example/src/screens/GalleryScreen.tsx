import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { recognize } from 'document-reader-sdk';
import { colors } from '../theme';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Gallery'>;

export default function GalleryScreen({ navigation }: Props) {
  const [front, setFront] = useState<string | null>(null);
  const [back, setBack] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = useCallback(async (side: 'front' | 'back') => {
    const picked = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      includeBase64: false,
    });
    if (picked.didCancel || !picked.assets?.[0]?.uri) return;
    const uri = picked.assets[0].uri;
    if (side === 'front') setFront(uri);
    else setBack(uri);
    setError('');
  }, []);

  const onRecognize = useCallback(async () => {
    if (!front || busy) return;
    setBusy(true);
    setError('');
    try {
      // Match iOS native demo: authenticity checks on.
      const json = await recognize(front, back);
      navigation.replace('Result', { json });
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }, [front, back, busy, navigation]);

  return (
    <View style={styles.root}>
      <Text style={styles.hint}>
        Front image is required. Back is optional (ID cards).
      </Text>

      <View style={styles.row}>
        <SideCard
          label="Front"
          uri={front}
          onPick={() => pick('front')}
          onClear={() => setFront(null)}
        />
        <SideCard
          label="Back (optional)"
          uri={back}
          onPick={() => pick('back')}
          onClear={() => setBack(null)}
        />
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, (!front || busy) && styles.buttonDisabled]}
        disabled={!front || busy}
        onPress={onRecognize}
      >
        {busy ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.buttonText}>Recognize</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function SideCard({
  label,
  uri,
  onPick,
  onClear,
}: {
  label: string;
  uri: string | null;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <TouchableOpacity style={styles.preview} onPress={onPick}>
        {uri ? (
          <Image source={{ uri }} style={styles.image} resizeMode="cover" />
        ) : (
          <Text style={styles.placeholder}>Tap to pick</Text>
        )}
      </TouchableOpacity>
      {uri ? (
        <TouchableOpacity onPress={onClear}>
          <Text style={styles.clear}>Clear</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.clearSpacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 16,
  },
  hint: { color: colors.muted, marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12 },
  card: { flex: 1 },
  cardLabel: {
    color: colors.text,
    fontWeight: '600',
    marginBottom: 8,
  },
  preview: {
    height: 200,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  placeholder: { color: colors.muted },
  clear: {
    color: colors.accent,
    marginTop: 8,
    textAlign: 'center',
    fontSize: 13,
  },
  clearSpacer: { height: 18 },
  error: { color: '#f87171', marginTop: 16 },
  button: {
    marginTop: 24,
    backgroundColor: colors.accent,
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#000', fontWeight: '700', fontSize: 16 },
});
