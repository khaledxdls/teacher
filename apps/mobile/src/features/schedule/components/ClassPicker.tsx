import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SavedClass } from '../../../domain/schedule';
import { colors } from '../../../theme/colors';
import { sharedStyles } from '../../../theme/sharedStyles';

type Props = {
  classes: SavedClass[];
  value: string;
  onSelect: (name: string) => void;
  /** Creates (or finds) a class with this name and returns it. */
  onAddClass: (name: string) => SavedClass;
  onError: (message: string) => void;
};

export default function ClassPicker({ classes, value, onSelect, onAddClass, onError }: Props) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');

  function select(name: string) {
    onSelect(name);
    setOpen(false);
    setNewName('');
  }

  function addClass() {
    const name = newName.trim();
    if (!name) {
      onError('Enter a class name first.');
      return;
    }
    select(onAddClass(name).name);
  }

  return (
    <>
      <Pressable
        style={styles.selector}
        onPress={() => setOpen((current) => !current)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={value ? styles.value : styles.placeholder}>
          {value || (classes.length ? 'Select a saved class' : 'Add your first class')}
        </Text>
        <Text style={styles.arrow}>{open ? '⌃' : '⌄'}</Text>
      </Pressable>
      {open && (
        <View style={styles.dropdown}>
          {classes.map((item) => (
            <Pressable key={item.id} style={styles.option} onPress={() => select(item.name)} accessibilityRole="button">
              <Text style={styles.optionText}>{item.name}</Text>
            </Pressable>
          ))}
          <View style={sharedStyles.inlineAddRow}>
            <TextInput
              style={sharedStyles.inlineAddInput}
              placeholder="New class name"
              value={newName}
              onChangeText={setNewName}
              onSubmitEditing={addClass}
              returnKeyType="done"
            />
            <Pressable style={sharedStyles.inlineAddButton} onPress={addClass} accessibilityRole="button">
              <Text style={sharedStyles.inlineAddText}>Add</Text>
            </Pressable>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  selector: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 13, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  value: { color: colors.navy, fontSize: 15 },
  placeholder: { color: colors.textFaint, fontSize: 15 },
  arrow: { color: colors.primary, fontSize: 18, fontWeight: '800' },
  dropdown: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, marginTop: -4, marginBottom: 12, overflow: 'hidden' },
  option: { padding: 13, borderBottomWidth: 1, borderBottomColor: colors.divider },
  optionText: { color: colors.navy, fontSize: 15, fontWeight: '600' },
});
