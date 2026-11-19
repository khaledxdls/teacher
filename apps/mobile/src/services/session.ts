import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { User } from './api';

export type Session = { token: string; user: User };

const KEY = 'classpilot.session';

// The auth token lives in the OS keychain/keystore. expo-secure-store has no web
// implementation, so the web build falls back to AsyncStorage (localStorage).
const store = Platform.OS === 'web'
  ? { get: AsyncStorage.getItem, set: AsyncStorage.setItem, remove: AsyncStorage.removeItem }
  : { get: SecureStore.getItemAsync, set: SecureStore.setItemAsync, remove: SecureStore.deleteItemAsync };

export async function loadSession(): Promise<Session | null> {
  const raw = await store.get(KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as Session;
    return typeof session?.token === 'string' && typeof session.user?.id === 'string' ? session : null;
  } catch {
    return null;
  }
}

export const saveSession = (session: Session) => store.set(KEY, JSON.stringify(session));
export const clearSession = () => store.remove(KEY);
