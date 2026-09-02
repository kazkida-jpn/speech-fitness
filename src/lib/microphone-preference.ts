import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RecordingInput } from 'expo-audio';

const MICROPHONE_PREFERENCE_KEY = 'speech-fitness:preferred-microphone';

export type MicrophonePreference = {
  uid: string;
  name: string;
  type: string;
};

export async function getMicrophonePreference() {
  try {
    const value = await AsyncStorage.getItem(MICROPHONE_PREFERENCE_KEY);
    return value ? (JSON.parse(value) as MicrophonePreference) : null;
  } catch {
    return null;
  }
}

export async function saveMicrophonePreference(input: RecordingInput) {
  const preference: MicrophonePreference = {
    uid: input.uid,
    name: input.name,
    type: input.type,
  };
  await AsyncStorage.setItem(MICROPHONE_PREFERENCE_KEY, JSON.stringify(preference));
  return preference;
}

export function resolveMicrophonePreference(
  inputs: RecordingInput[],
  preference: MicrophonePreference | null
) {
  if (!preference) return null;
  return (
    inputs.find((input) => input.uid === preference.uid) ??
    inputs.find(
      (input) =>
        input.name.toLocaleLowerCase() === preference.name.toLocaleLowerCase() &&
        input.type.toLocaleLowerCase() === preference.type.toLocaleLowerCase()
    ) ??
    null
  );
}
