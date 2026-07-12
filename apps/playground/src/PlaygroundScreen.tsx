import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { TableTemplateEditor } from './components/TableTemplateEditor';
import { CardTemplateEditor } from './components/CardTemplateEditor';
import { CardGallery } from './components/CardGallery';

export function PlaygroundScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Card Playground</Text>
      <TableTemplateEditor />
      <CardTemplateEditor />
      <CardGallery />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#12121f' },
  content: { paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#f4c542', textAlign: 'center', marginVertical: 16 },
});
