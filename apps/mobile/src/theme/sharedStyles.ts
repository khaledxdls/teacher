import { StyleSheet } from 'react-native';
import { colors } from './colors';

/** Styles reused across modals and form controls. */
export const sharedStyles = StyleSheet.create({
  modalBackdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  modalTitle: { color: colors.navy, fontSize: 24, fontWeight: '800' },
  modalSubtitle: { color: colors.textMuted, marginTop: 4 },
  closeButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.closeButton, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.textMuted, fontSize: 25, lineHeight: 27 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 13, marginBottom: 10 },
  fieldLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 7 },
  inlineAddRow: { flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: colors.surfaceMuted },
  inlineAddInput: { flex: 1, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 8, padding: 9, marginRight: 8 },
  inlineAddButton: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
  inlineAddText: { color: colors.surface, fontWeight: '800' },
  emptyText: { color: colors.textSubtle, textAlign: 'center', paddingVertical: 28 },
  classSubject: { color: colors.navy, fontSize: 16, fontWeight: '800', marginTop: 4 },
  classMeta: { color: colors.textMuted, marginTop: 3, fontSize: 12 },
});
