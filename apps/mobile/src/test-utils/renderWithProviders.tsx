import { render } from '@testing-library/react-native';
import { ReactElement, ReactNode } from 'react';
import { emptyPlannerState, PlannerState } from '../domain/types';
import { I18nProvider } from '../i18n/I18nProvider';
import { PlannerProvider } from '../state/PlannerProvider';
import { PreferencesProvider } from '../state/PreferencesProvider';
import { ThemeProvider } from '../theme/ThemeProvider';

/**
 * Wraps UI under test in the real app providers, with planner data supplied directly
 * (no storage load). Storage writes go to the AsyncStorage jest mock.
 */
export function AppProviders({ children, state = emptyPlannerState }: { children: ReactNode; state?: PlannerState }) {
  return (
    <PreferencesProvider>
      <ThemeProvider>
        <I18nProvider>
          <PlannerProvider initialState={state}>{children}</PlannerProvider>
        </I18nProvider>
      </ThemeProvider>
    </PreferencesProvider>
  );
}

/** Renders `ui` inside the providers; `rerender` keeps the same providers (and planner store). */
export function renderWithProviders(ui: ReactElement, state?: PlannerState) {
  const wrapper = ({ children }: { children: ReactNode }) => <AppProviders state={state}>{children}</AppProviders>;
  return render(ui, { wrapper });
}
