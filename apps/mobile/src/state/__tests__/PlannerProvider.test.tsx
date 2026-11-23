import { act, renderHook, waitFor } from '@testing-library/react-native';
import { ReactNode } from 'react';
import { emptyPlannerState, PlannerState } from '../../domain/types';
import { classOf, draft, lesson, student } from '../../test-utils/domainFixtures';
import { createMemoryRepository } from '../../test-utils/memoryRepository';
import { useClasses, useLessons, usePendingChanges, usePlannerActions, usePlannerHydrated, usePlannerStore, useStudents } from '../planner';
import { PlannerProvider } from '../PlannerProvider';

jest.mock('../../services/errorReporting', () => ({ reportError: jest.fn() }));

const usePlanner = () => ({
  hydrated: usePlannerHydrated(),
  lessons: useLessons(),
  classes: useClasses(),
  students: useStudents('c7b'),
  pending: usePendingChanges(),
  actions: usePlannerActions(),
  store: usePlannerStore(),
});

async function renderLoaded(data: Partial<PlannerState> = {}) {
  const repository = createMemoryRepository({ ...emptyPlannerState, ...data });
  const wrapper = ({ children }: { children: ReactNode }) => <PlannerProvider repository={repository}>{children}</PlannerProvider>;
  const hook = await renderHook(usePlanner, { wrapper });
  await waitFor(() => expect(hook.result.current.hydrated).toBe(true));
  return { ...hook, repository };
}

describe('PlannerProvider', () => {
  it('does not save anything until stored data has loaded', async () => {
    let resolveLoad: (data: PlannerState) => void = () => undefined;
    const repository = createMemoryRepository();
    repository.load.mockReturnValue(new Promise((resolve) => { resolveLoad = resolve; }));
    const wrapper = ({ children }: { children: ReactNode }) => <PlannerProvider repository={repository}>{children}</PlannerProvider>;

    const { result } = await renderHook(usePlanner, { wrapper });
    expect(result.current.hydrated).toBe(false);
    await act(async () => resolveLoad({ ...emptyPlannerState, classes: [classOf('c7b', '7B')] }));
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    expect(result.current.classes.map((item) => item.name)).toEqual(['7B']);
    expect(repository.saves).toHaveLength(0);
  });

  it('never saves when loading fails', async () => {
    const repository = createMemoryRepository();
    repository.load.mockRejectedValue(new Error('disk error'));
    const wrapper = ({ children }: { children: ReactNode }) => <PlannerProvider repository={repository}>{children}</PlannerProvider>;
    const { result } = await renderHook(usePlanner, { wrapper });
    await act(async () => undefined);
    expect(result.current.hydrated).toBe(false);
    expect(repository.saves).toHaveLength(0);
  });

  it('applies actions, re-renders subscribers and saves each change', async () => {
    const { result, repository } = await renderLoaded({ classes: [classOf('c7b', '7B')] });

    let outcome: ReturnType<typeof result.current.actions.saveLesson> | undefined;
    await act(async () => { outcome = result.current.actions.saveLesson({ draft: draft({ id: 'a', date: '2026-11-20' }) }); });

    expect(outcome).toEqual({ ok: true, value: { count: 1 } });
    expect(result.current.lessons.map((item) => item.id)).toEqual(['a']);
    expect(result.current.pending).toBe(1);
    expect(repository.saves).toHaveLength(1);
    expect(repository.saves[0].next.entries).toEqual([expect.objectContaining({ id: 'a', dirty: true })]);
  });

  it('returns validation errors without changing or saving state', async () => {
    const { result, repository } = await renderLoaded({ entries: [lesson({ id: 'x', date: '2026-11-20' })] });
    const before = result.current.store.getState();
    const outcome = result.current.actions.saveLesson({ draft: draft({ id: 'b', date: '2026-11-20' }) });
    expect(outcome).toEqual({ ok: false, error: { code: 'scheduleConflict', params: { subject: 'Math', date: '2026-11-20' } } });
    expect(result.current.store.getState()).toBe(before);
    expect(repository.saves).toHaveLength(0);
  });

  it('lets consecutive actions in one handler see each other’s changes', async () => {
    const { result } = await renderLoaded();
    await act(async () => {
      const created = result.current.actions.addClass({ name: '8A' });
      if (!created.ok) throw new Error('addClass failed');
      // No re-render happens between these calls; the store must already hold the new class.
      expect(result.current.actions.addStudent({ classId: created.value.id, name: 'Ana' }).ok).toBe(true);
    });
    expect(result.current.store.getState().students.map((item) => item.name)).toEqual(['Ana']);
  });

  it('hides deleted records from the live hooks', async () => {
    const { result } = await renderLoaded({
      classes: [classOf('c7b', '7B'), classOf('gone', 'Gone', { deleted: true })],
      students: [student('ana', 'Ana'), student('old', 'Old', 'c7b', { deleted: true })],
      entries: [lesson({ id: 'a', date: '2026-11-20' }), lesson({ id: 'b', date: '2026-11-21', deleted: true })],
    });
    expect(result.current.classes.map((item) => item.id)).toEqual(['c7b']);
    expect(result.current.students.map((item) => item.id)).toEqual(['ana']);
    expect(result.current.lessons.map((item) => item.id)).toEqual(['a']);
  });
});
