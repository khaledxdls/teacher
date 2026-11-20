import { createStyles } from './createStyles';

/** Styles reused across screens, modals and form controls. */
export const useSharedStyles = createStyles((c) => ({
  modalBackdrop: { flex: 1, backgroundColor: c.backdrop, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 430, maxHeight: '90%', backgroundColor: c.surface, borderRadius: 24, padding: 24 },
  flex: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, gap: 12 },
  modalTitle: { color: c.text, fontSize: 24, fontWeight: '800' },
  modalSubtitle: { color: c.textMuted, marginTop: 4 },
  closeButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: c.textMuted, fontSize: 25, lineHeight: 27 },
  input: { borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 13, marginBottom: 10, color: c.text, backgroundColor: c.surface, textAlign: 'auto' },
  fieldLabel: { color: c.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 7, textAlign: 'auto' },
  inlineAddRow: { flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: c.surfaceMuted, gap: 8 },
  inlineAddInput: { flex: 1, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, color: c.text, borderRadius: 8, padding: 9 },
  inlineAddButton: { backgroundColor: c.primary, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
  inlineAddText: { color: c.onPrimary, fontWeight: '800' },
  emptyText: { color: c.textSubtle, textAlign: 'center', paddingVertical: 28 },
  hint: { color: c.textMuted, fontSize: 12 },
  title: { color: c.text, fontSize: 16, fontWeight: '800' },
  subtitle: { color: c.textMuted, fontSize: 12, marginTop: 3 },
  lessonSubject: { color: c.text, fontSize: 16, fontWeight: '800', marginTop: 4 },
  lessonMeta: { color: c.textMuted, marginTop: 3, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
}));
