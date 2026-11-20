import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import InlineAddField from '../../../components/ui/InlineAddField';
import { SavedClass } from '../../../domain/types';
import { useI18n } from '../../../i18n/I18nProvider';
import { createStyles } from '../../../theme/createStyles';

type Props = {
  classes: SavedClass[];
  /** Selected class id ('' when none). */
  value: string;
  /** Name to show for the selection (also covers classes deleted since). */
  selectedName?: string;
  onSelect: (classId: string) => void;
  /** Creates (or finds) a class with this name; returns its id, or null when it failed. */
  onCreate: (name: string) => string | null;
};

/** Dropdown of saved classes with an inline "new class" field. */
export default function ClassPicker({ classes, value, selectedName, onSelect, onCreate }: Props) {
  const styles = useStyles();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');

  function select(classId: string) {
    onSelect(classId);
    setOpen(false);
    setNewName('');
  }

  function create() {
    const id = onCreate(newName);
    if (id) select(id);
  }

  return (
    <>
      <Pressable style={styles.selector} onPress={() => setOpen((current) => !current)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Text style={value ? styles.value : styles.placeholder}>
          {value ? selectedName : t(classes.length ? 'editor.selectClass' : 'editor.addFirstClass')}
        </Text>
        <Text style={styles.arrow}>{open ? '⌃' : '⌄'}</Text>
      </Pressable>
      {open && (
        <View style={styles.dropdown}>
          {classes.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.option, item.id === value && styles.optionSelected]}
              onPress={() => select(item.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: item.id === value }}
            >
              <Text style={styles.optionText}>{item.name}</Text>
            </Pressable>
          ))}
          <InlineAddField value={newName} onChange={setNewName} onSubmit={create} placeholder={t('editor.newClassName')} />
        </View>
      )}
    </>
  );
}

const useStyles = createStyles((c) => ({
  selector: { minHeight: 48, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingHorizontal: 13, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.surface },
  value: { color: c.text, fontSize: 15 },
  placeholder: { color: c.textFaint, fontSize: 15 },
  arrow: { color: c.primary, fontSize: 18, fontWeight: '800' },
  dropdown: { borderWidth: 1, borderColor: c.border, borderRadius: 10, marginTop: -4, marginBottom: 12, overflow: 'hidden' },
  option: { padding: 13, borderBottomWidth: 1, borderBottomColor: c.divider, backgroundColor: c.surface },
  optionSelected: { backgroundColor: c.surfaceHighlight },
  optionText: { color: c.text, fontSize: 15, fontWeight: '600', textAlign: 'auto' },
}));
