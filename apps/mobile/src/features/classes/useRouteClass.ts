import { useLocalSearchParams } from 'expo-router';
import { useClassById } from '../../state/planner';

/** The live class named by the `id` route param (undefined when missing or deleted). */
export function useRouteClass() {
  const params = useLocalSearchParams<{ id: string }>();
  const savedClass = useClassById().get(params.id ?? '');
  return { classId: params.id, savedClass: savedClass && !savedClass.deleted ? savedClass : undefined };
}
