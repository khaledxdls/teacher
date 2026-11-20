import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { emptyPlannerState } from '../../../domain/types';
import { useLessons } from '../../../state/planner';
import { classOf } from '../../../test-utils/domainFixtures';
import { renderWithProviders } from '../../../test-utils/renderWithProviders';
import AttendanceList from '../components/AttendanceList';
import LessonEditorModal from '../components/LessonEditorModal';

jest.mock('../../../services/errorReporting', () => ({ reportError: jest.fn() }));
jest.mock('@react-native-community/datetimepicker', () => () => null);

/** Shows how many lessons are in the store, so the test can observe the editor's effect. */
function LessonCount() {
  return <Text testID="lesson-count">{useLessons().length}</Text>;
}

const pressSubmit = () => fireEvent.press(screen.getAllByText('Add lesson').at(-1)!);

describe('LessonEditorModal', () => {
  it('validates, then creates a repeating lesson for the chosen class', async () => {
    const onDone = jest.fn();
    await renderWithProviders(
      <>
        <LessonEditorModal
          session={{ key: 1, visible: true, date: new Date(2026, 10, 20), lesson: null }}
          onClose={() => undefined}
          onDone={onDone}
          onManageStudents={() => undefined}
        />
        <LessonCount />
      </>,
      { ...emptyPlannerState, classes: [classOf('c7b', '7B')] },
    );

    await pressSubmit();
    expect(await screen.findByText('Add a subject first.')).toBeTruthy();

    await fireEvent.changeText(screen.getByPlaceholderText('Subject'), 'Geometry');
    await fireEvent.press(screen.getByText('Select a class'));
    await fireEvent.press(screen.getByText('7B'));
    await fireEvent.press(screen.getByText('Every week'));
    await pressSubmit();

    // Weekly for the default 12 weeks after the first lesson: 13 lessons.
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('13 lessons added.'));
    expect(screen.getByTestId('lesson-count')).toHaveTextContent('13');
  });
});

describe('AttendanceList', () => {
  it('cycles a student through the statuses and marks everyone present', async () => {
    const onChange = jest.fn();
    const students = [{ id: 's1', name: 'Ana' }, { id: 's2', name: 'Ben' }];
    const { rerender } = await renderWithProviders(<AttendanceList students={students} attendance={{}} onChange={onChange} />);

    await fireEvent.press(screen.getByText('Ana'));
    expect(onChange).toHaveBeenLastCalledWith({ s1: 'present' });

    await rerender(<AttendanceList students={students} attendance={{ s1: 'absent' }} onChange={onChange} />);
    await fireEvent.press(screen.getByText('Ana'));
    expect(onChange).toHaveBeenLastCalledWith({});

    await fireEvent.press(screen.getByText('Mark all present'));
    expect(onChange).toHaveBeenLastCalledWith({ s1: 'present', s2: 'present' });
  });
});
