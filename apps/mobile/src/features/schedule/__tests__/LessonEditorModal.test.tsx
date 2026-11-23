import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { emptyPlannerState } from '../../../domain/types';
import { useLessons } from '../../../state/planner';
import { classOf } from '../../../test-utils/domainFixtures';
import { renderWithProviders } from '../../../test-utils/renderWithProviders';
import StatusList from '../../lessons/StatusList';
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
        <LessonEditorModal session={{ key: 1, visible: true, date: new Date(2026, 10, 20), lesson: null }} onClose={() => undefined} onDone={onDone} />
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
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ action: 'created', message: '13 lessons added.' })));
    expect(screen.getByTestId('lesson-count')).toHaveTextContent('13');
  });
});

describe('StatusList', () => {
  it('cycles a student to the next status', async () => {
    const onChange = jest.fn();
    const students = [{ id: 's1', name: 'Ana' }, { id: 's2', name: 'Ben' }];
    const statuses: Record<string, 'done' | 'missing'> = { s2: 'missing' };
    await renderWithProviders(
      <StatusList<'done' | 'missing'>
        title="Homework"
        students={students}
        statusOf={(id) => statuses[id]}
        next={(current) => (current ? undefined : 'done')}
        onChange={onChange}
        label={(status) => status ?? 'Not marked'}
        tone={{ done: 'success', missing: 'danger' }}
        accessibilityLabel={(name, status) => `${name}: ${status}`}
      />,
    );

    expect(screen.getByText('missing')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Ana: Not marked'));
    expect(onChange).toHaveBeenLastCalledWith('s1', 'done');
    await fireEvent.press(screen.getByLabelText('Ben: missing'));
    expect(onChange).toHaveBeenLastCalledWith('s2', undefined);
  });
});
