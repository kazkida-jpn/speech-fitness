import Head from 'expo-router/head';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppFooter } from '@/components/AppFooter';
import { AppHeader } from '@/components/AppHeader';
import { palette } from '@/constants/palette';
import { LEGAL_UPDATED, SITE_NAME } from '@/constants/site';
import type { LegalBlock, LegalDocument } from '@/content/legal-types';

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === 'string') return <Text style={styles.paragraph}>{block}</Text>;
  return (
    <View style={styles.list}>
      {block.map((item, index) => (
        <View key={index} style={styles.listItem}>
          <Text style={styles.bullet}>・</Text>
          <Text style={styles.listText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

/** Shell shared by every legal page: header, title, last-updated line, body, footer. */
export function LegalPageShell({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <Head>
        <title>{`${title} | ${SITE_NAME}`}</title>
        <meta name="robots" content="noindex, follow" />
      </Head>
      <ScrollView contentContainerStyle={styles.container}>
        <AppHeader />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.updated}>最終更新日: {LEGAL_UPDATED}</Text>
        <Text style={styles.lead}>{lead}</Text>
        {children}
        <AppFooter />
      </ScrollView>
    </SafeAreaView>
  );
}

export function LegalDocumentPage({ document }: { document: LegalDocument }) {
  return (
    <LegalPageShell title={document.title} lead={document.lead}>
      {document.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text style={styles.heading}>{section.heading}</Text>
          {section.blocks.map((block, index) => (
            <Block key={index} block={block} />
          ))}
        </View>
      ))}
    </LegalPageShell>
  );
}

export const legalStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  rowLabel: { width: 160, color: palette.ink, fontSize: 13, fontWeight: '800', lineHeight: 22 },
  rowValue: { flex: 1, minWidth: 220, color: palette.ink, fontSize: 13, lineHeight: 22 },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.cream },
  container: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 22, paddingBottom: 50 },
  title: { color: palette.ink, fontSize: 26, fontWeight: '800' },
  updated: { color: palette.muted, fontSize: 12, marginTop: 6 },
  lead: { color: palette.ink, fontSize: 14, lineHeight: 24, marginTop: 16 },
  section: { marginTop: 26 },
  heading: { color: palette.ink, fontSize: 16, fontWeight: '800', marginBottom: 8 },
  paragraph: { color: palette.ink, fontSize: 14, lineHeight: 24, marginBottom: 8 },
  list: { marginBottom: 8, gap: 4 },
  listItem: { flexDirection: 'row' },
  bullet: { color: palette.muted, fontSize: 14, lineHeight: 24, width: 18 },
  listText: { flex: 1, color: palette.ink, fontSize: 14, lineHeight: 24 },
});
