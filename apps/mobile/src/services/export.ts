import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export class SharingUnavailableError extends Error {}

/** Keeps file names portable: letters, digits, dashes and underscores. */
export const safeFileName = (name: string) => name.normalize('NFKD').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'export';

type FileKind = { extension: string; mimeType: string; uti: string };

export const FILE_KINDS = {
  csv: { extension: 'csv', mimeType: 'text/csv', uti: 'public.comma-separated-values-text' },
  ics: { extension: 'ics', mimeType: 'text/calendar', uti: 'public.calendar-event' },
  json: { extension: 'json', mimeType: 'application/json', uti: 'public.json' },
} satisfies Record<string, FileKind>;

function downloadOnWeb(fileName: string, content: string, mimeType: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${mimeType};charset=utf-8` }));
  const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
  link.click();
  URL.revokeObjectURL(url);
}

async function shareFile(uri: string, kind: Pick<FileKind, 'mimeType' | 'uti'>, dialogTitle: string) {
  if (!(await Sharing.isAvailableAsync())) throw new SharingUnavailableError();
  await Sharing.shareAsync(uri, { mimeType: kind.mimeType, UTI: kind.uti, dialogTitle });
}

/** Writes a text file to the cache and opens the share sheet (downloads it on web). */
export async function shareTextFile(fileName: string, content: string, kind: FileKind, dialogTitle: string) {
  const name = `${safeFileName(fileName)}.${kind.extension}`;
  if (Platform.OS === 'web') {
    downloadOnWeb(name, content, kind.mimeType);
    return;
  }
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  await file.write(content);
  await shareFile(file.uri, kind, dialogTitle);
}

/** Renders HTML to a PDF and opens the share sheet (opens the print dialog on web). */
export async function sharePdf(html: string, dialogTitle: string) {
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  await shareFile(uri, { mimeType: 'application/pdf', uti: 'com.adobe.pdf' }, dialogTitle);
}

/** Lets the user pick a file and returns its text, or null if they cancelled. */
export async function pickTextFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (result.canceled || !result.assets.length) return null;
  const asset = result.assets[0];
  if (Platform.OS === 'web') return (await fetch(asset.uri)).text();
  return new File(asset.uri).text();
}
