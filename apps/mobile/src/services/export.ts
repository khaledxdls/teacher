import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export class SharingUnavailableError extends Error {}

/** Keeps file names portable: letters, digits, dashes and underscores. */
export const safeFileName = (name: string) => name.normalize('NFKD').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'report';

function downloadOnWeb(fileName: string, content: string, mimeType: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
  link.click();
  URL.revokeObjectURL(url);
}

async function shareFile(uri: string, mimeType: string, uti: string, dialogTitle: string) {
  if (!(await Sharing.isAvailableAsync())) throw new SharingUnavailableError();
  await Sharing.shareAsync(uri, { mimeType, UTI: uti, dialogTitle });
}

/** Writes a CSV to the cache and opens the share sheet (downloads it on web). */
export async function shareCsv(fileName: string, content: string, dialogTitle: string) {
  const name = `${safeFileName(fileName)}.csv`;
  if (Platform.OS === 'web') {
    downloadOnWeb(name, content, 'text/csv;charset=utf-8');
    return;
  }
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  await file.write(content);
  await shareFile(file.uri, 'text/csv', 'public.comma-separated-values-text', dialogTitle);
}

/** Renders HTML to a PDF and opens the share sheet (opens the print dialog on web). */
export async function sharePdf(html: string, dialogTitle: string) {
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  await shareFile(uri, 'application/pdf', 'com.adobe.pdf', dialogTitle);
}
