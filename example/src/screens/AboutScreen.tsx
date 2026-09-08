import { useEffect, useState } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getLicenseStatus } from 'document-reader-sdk';
import FacePluginLogo from '../components/FacePluginLogo';
import { colors } from '../theme';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'About'>;

export default function AboutScreen(_props: Props) {
  const [licenseText, setLicenseText] = useState('License: …');

  useEffect(() => {
    let cancelled = false;
    getLicenseStatus()
      .then((status) => {
        if (!cancelled) setLicenseText(`License: ${status.label}`);
      })
      .catch(() => {
        if (!cancelled) setLicenseText('License: Not licensed');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.pad}>
      <FacePluginLogo
        style={styles.logo}
        onPress={() => Linking.openURL('https://faceplugin.com')}
      />
      <Text style={styles.company}>FacePlugin</Text>
      <Text style={styles.product}>Document Reader SDK</Text>

      <View style={styles.licenseCard}>
        <Text style={styles.license}>{licenseText}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.body}>
          FacePlugin builds on-device identity technology — document
          recognition, face matching, and liveness — so biometric data never has
          to leave the phone.
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.body}>
          This app demos the Document Reader SDK for React Native: ID cards,
          passports, and driver licenses with OCR, MRZ, barcode, and optional
          authenticity checks. Everything runs fully on-premise.
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => Linking.openURL('https://faceplugin.com')}
      >
        <Text style={styles.link}>faceplugin.com</Text>
      </TouchableOpacity>
      <Text style={styles.copy}>© 2026 FacePlugin. All rights reserved.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: 16, paddingBottom: 40, alignItems: 'center' },
  logo: { marginTop: 8 },
  company: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
  },
  product: {
    color: colors.accent,
    fontSize: 15,
    marginTop: 4,
    marginBottom: 12,
  },
  licenseCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  license: {
    color: colors.text,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  body: { color: colors.text, fontSize: 14, lineHeight: 21 },
  link: {
    color: colors.accent,
    fontSize: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  copy: { color: colors.muted, fontSize: 12 },
});
