import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import type { CardImage } from '../types';

const DEFAULT_SCALE = 1;
const DEFAULT_OFFSET = 0;

export async function pickCardImage(): Promise<Pick<CardImage, 'uri' | 'kind' | 'svgXml'> | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/png', 'image/jpeg', 'image/svg+xml'],
    copyToCacheDirectory: true,
  });

  if (result.canceled) {
    return null;
  }

  const asset = result.assets[0];
  const isSvg = asset.mimeType === 'image/svg+xml' || asset.name.toLowerCase().endsWith('.svg');

  if (isSvg) {
    const file = new File(asset.uri);
    const svgXml = await file.text();
    return { uri: asset.uri, kind: 'svg', svgXml };
  }

  return { uri: asset.uri, kind: 'png' };
}

export function buildCardImage(picked: Pick<CardImage, 'uri' | 'kind' | 'svgXml'>): CardImage {
  return { ...picked, scale: DEFAULT_SCALE, offsetX: DEFAULT_OFFSET, offsetY: DEFAULT_OFFSET };
}
