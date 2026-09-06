import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Remembers that this browser or device has entered the app at least once, so the root
// URL can show the landing page to newcomers and the home screen to everyone else.

const STARTED_KEY = 'speech-fitness:started';

/** Synchronous check for web, so the home screen can be chosen before the first paint. */
export function hasStartedSync() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STARTED_KEY) === '1';
  } catch {
    return false;
  }
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
  try {
    await AsyncStorage.setItem(STARTED_KEY, '1');
  } catch {
    // Storage can be unavailable in private browsing; the landing page just shows again.
  }
}
