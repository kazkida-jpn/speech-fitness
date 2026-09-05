import type { RecordingInput } from 'expo-audio';

// Pure helpers for microphone input lists. No runtime imports so they can be unit-tested.

export const DEFAULT_INPUT_LABEL = 'ブラウザ・端末の既定マイク';

export function inputDisplayName(input: { name: string; type: string }) {
  return input.name || input.type || '既定のマイク';
}

const ALIAS_PREFIX = /^(既定|通信|default|communications?)\s*[-–—:]/i;

function normalizeInputName(name: string) {
  return name
    .replace(/^(既定|通信|default|communications?)\s*[-–—:]\s*/i, '')
    .trim()
    .toLocaleLowerCase();
}

function isInputAlias(input: RecordingInput) {
  return input.type.toLocaleLowerCase() === 'default' || ALIAS_PREFIX.test(input.name);
}

/**
 * Browsers list the same physical microphone several times ("既定 - X", "通信 - X", "X").
 * Keep one entry per device, preferring the concrete one over the alias.
 */
export function deduplicateInputs(inputs: RecordingInput[]) {
  const uniqueInputs = new Map<string, RecordingInput>();
  for (const input of inputs) {
    const key = normalizeInputName(input.name);
    const existing = uniqueInputs.get(key);
    if (!existing || (isInputAlias(existing) && !isInputAlias(input))) {
      uniqueInputs.set(key, input);
    }
  }
  return Array.from(uniqueInputs.values());
}
