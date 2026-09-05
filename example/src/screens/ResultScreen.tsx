import { useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  images,
  pretty,
  rows,
  securityRows,
  securitySummary,
  summary,
} from '../resultParser';
import { colors } from '../theme';
import type { RootStackParamList } from '../navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Result'>;
type Tab = 'result' | 'security' | 'images' | 'raw';

const TABS: readonly [Tab, string][] = [
  ['result', 'Result'],
  ['security', 'Security'],
  ['images', 'Images'],
  ['raw', 'Raw JSON'],
];

export default function ResultScreen({ route }: Props) {
  const { json } = route.params;
  const [tab, setTab] = useState<Tab>('result');
  const fieldRows = useMemo(() => rows(json), [json]);
  const secRows = useMemo(() => securityRows(json), [json]);
  const imgs = useMemo(() => images(json), [json]);
  const summaryText = useMemo(() => summary(json), [json]);
  const securityText = useMemo(() => securitySummary(json), [json]);
  const rawText = useMemo(() => pretty(json), [json]);

  return (
    <View style={styles.root}>
      <View style={styles.tabs}>
        {TABS.map(([id, label]) => (
          <TouchableOpacity
            key={id}
            style={[styles.tab, tab === id && styles.tabActive]}
            onPress={() => setTab(id)}
          >
            <Text
              style={[styles.tabText, tab === id && styles.tabTextActive]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'result' && (
        <ScrollView contentContainerStyle={styles.pad}>
          <Text style={styles.summary}>{summaryText}</Text>
          <View style={styles.headerRow}>
            <Text style={[styles.colSource, styles.header]}>Src</Text>
            <Text style={[styles.colKey, styles.header]}>Field</Text>
            <Text style={[styles.colValue, styles.header]}>Value</Text>
          </View>
          {fieldRows.map((r, i) => (
            <View
              key={`${r.source}-${r.key}-${i}`}
              style={[styles.row, i % 2 === 0 && styles.rowAlt]}
            >
              <Text style={styles.colSource} numberOfLines={1}>
                {r.source}
              </Text>
              <Text style={styles.colKey} numberOfLines={2}>
                {r.key}
              </Text>
              <Text style={styles.colValue} selectable>
                {r.value}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      {tab === 'security' && (
        <ScrollView contentContainerStyle={styles.pad}>
          <Text style={styles.summary}>{securityText}</Text>
          <View style={styles.headerRow}>
            <Text style={[styles.colPage, styles.header]}>Page</Text>
            <Text style={[styles.colCheck, styles.header]}>Check</Text>
            <Text style={[styles.colStatus, styles.header]}>Status</Text>
          </View>
          {secRows.length === 0 ? (
            <Text style={styles.muted}>No security checks in this response</Text>
          ) : (
            secRows.map((r, i) => (
              <View
                key={`${r.page}-${r.check}-${i}`}
                style={[styles.row, i % 2 === 0 && styles.rowAlt]}
              >
                <Text style={styles.colPage}>{r.page}</Text>
                <Text style={styles.colCheck}>{r.check}</Text>
                <Text style={styles.colStatus}>{r.status}</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {tab === 'images' && (
        <ScrollView contentContainerStyle={styles.pad}>
          {imgs.length === 0 ? (
            <Text style={styles.muted}>No images in response.</Text>
          ) : (
            imgs.map((img, i) => (
              <View key={`${img.category}-${i}`} style={styles.imgCard}>
                <Text style={styles.imgTitle}>
                  {img.category}
                  {img.source ? ` · ${img.source}` : ''}
                </Text>
                <Image
                  source={{ uri: img.uri }}
                  style={styles.img}
                  resizeMode="contain"
                />
              </View>
            ))
          )}
        </ScrollView>
      )}

      {tab === 'raw' && (
        <ScrollView contentContainerStyle={styles.pad}>
          <Text style={styles.raw} selectable>
            {rawText}
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginTop: 8,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.accent },
  tabText: { color: colors.text, fontWeight: '600', fontSize: 11 },
  tabTextActive: { color: '#000' },
  pad: { padding: 16, paddingBottom: 40 },
  summary: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  header: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  row: { flexDirection: 'row', paddingVertical: 10 },
  rowAlt: { backgroundColor: 'rgba(255,255,255,0.03)' },
  colSource: { width: 64, color: colors.muted, fontSize: 12 },
  colKey: { flex: 1, color: colors.text, fontSize: 13, paddingRight: 8 },
  colValue: { flex: 1.4, color: colors.accent, fontSize: 13 },
  colPage: { flex: 0.8, color: colors.muted, fontSize: 13, paddingRight: 6 },
  colCheck: { flex: 1.6, color: colors.text, fontSize: 13, paddingRight: 6 },
  colStatus: { flex: 1, color: colors.accent, fontSize: 13 },
  muted: { color: colors.muted, marginTop: 12 },
  imgCard: { marginBottom: 16 },
  imgTitle: {
    color: colors.text,
    fontWeight: '600',
    marginBottom: 8,
  },
  img: {
    width: '100%',
    height: 220,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  raw: {
    color: colors.text,
    fontFamily: 'Menlo',
    fontSize: 12,
    lineHeight: 18,
  },
});
