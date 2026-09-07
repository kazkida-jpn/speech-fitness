import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Remembers that this browser or device has entered the app at least once, so the root
// URL can show the landing page to newcomers and the home screen to everyone else.
// Exposed as a tiny external store so screens can read it with useSyncExternalStore.

const STARTED_KEY = 'speech-fitness:started';

let startedInMemory = false;
const listeners = new Set<() => void>();

export function subscribeStarted(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Synchronous check for web, so the home screen can be chosen before the first paint. */
export function hasStartedSync() {
  if (startedInMemory) return true;
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STARTED_KEY) === '1';
  } catch {
    return false;
  }
}

/** What the server-rendered HTML assumes: nobody has started yet. */
export function hasStartedServerSnapshot() {
  return false;
}

export async function hasStarted() {
  if (hasStartedSync()) return true;
  try {
    return (await AsyncStorage.getItem(STARTED_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markStarted() {
  startedInMemory = true;
  try {
    await AsyncStorage.setItem(STARTED_KEY, '1');
  } catch {
    // Storage can be unavailable in private browsing; the landing page just shows again.
  }
  listeners.forEach((listener) => listener());
}
