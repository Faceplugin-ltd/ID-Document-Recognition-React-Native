import {
  Alert,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import FacePluginLogo from '../components/FacePluginLogo';
import TileIcon, { type TileIconName } from '../components/TileIcons';
import { useSdk } from '../SdkContext';
import { colors } from '../theme';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

function Tile({
  title,
  icon,
  disabled,
  onPress,
}: {
  title: string;
  icon: TileIconName;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.tile, disabled && styles.tileDisabled]}
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <TileIcon name={icon} size={36} />
      <Text style={styles.tileTitle} numberOfLines={1} adjustsFontSizeToFit>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen({ navigation }: Props) {
  const { status, ready } = useSdk();

  const guard = (go: () => void) => {
    if (!ready) {
      Alert.alert('SDK not ready', status);
      return;
    }
    go();
  };

  const statusStyle = ready
    ? styles.statusOk
    : status.toLowerCase().includes('loading')
      ? styles.statusInfo
      : styles.statusError;

  return (
    <View style={styles.root}>
      <View style={styles.body}>
        <FacePluginLogo
          onPress={() => Linking.openURL('https://faceplugin.com')}
        />
        <Text style={styles.title}>FacePlugin DocumentReader</Text>

        <View style={styles.grid}>
          <View style={styles.row}>
            <Tile
              title="CAMERA"
              icon="camera"
              disabled={!ready}
              onPress={() => guard(() => navigation.navigate('Camera'))}
            />
            <Tile
              title="GALLERY"
              icon="gallery"
              disabled={!ready}
              onPress={() => guard(() => navigation.navigate('Gallery'))}
            />
            <Tile
              title="ABOUT"
              icon="about"
              onPress={() => navigation.navigate('About')}
            />
          </View>
        </View>
      </View>

      <View style={[styles.statusBar, statusStyle]}>
        <Text style={styles.statusText}>{status}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 36,
    alignItems: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 28,
  },
  grid: {
    width: '100%',
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  tile: {
    flex: 1,
    height: 112,
    backgroundColor: colors.card,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tileDisabled: { opacity: 0.45 },
  tileTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  statusBar: {
    marginHorizontal: 16,
    marginBottom: 16,
    minHeight: 64,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  statusOk: { backgroundColor: colors.statusOk },
  statusInfo: { backgroundColor: colors.statusInfo },
  statusError: { backgroundColor: colors.statusError },
  statusText: {
    color: colors.text,
    textAlign: 'center',
    fontSize: 14,
  },
});
