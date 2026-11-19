import ScheduleScreen from './src/features/schedule/ScheduleScreen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
  return (
    <SafeAreaProvider>
      <ScheduleScreen />
    </SafeAreaProvider>
  );
}
