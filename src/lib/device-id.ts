import AsyncStorage from '@react-native-async-storage/async-storage';

// A random id kept on this device and sent with speech check requests. It lets the server hold
// a signed-out visitor to the single free check without an account.

const DEVICE_ID_KEY = 'speech-fitness:device-id';

let cached: string | null = null;

function createDeviceId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

/** Returns the stored id, creating it on first use; null when storage is unavailable. */
export async function getDeviceId() {
  if (cached) return cached;
  try {
    let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = createDeviceId();
      await AsyncStorage.setItem(DEVICE_ID_KEY, id);
    }
    cached = id;
    return id;
  } catch {
    // Storage can be blocked in private browsing; the server then goes by the IP address.
    return null;
  }
}
