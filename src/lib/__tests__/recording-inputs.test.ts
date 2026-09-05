import { describe, expect, it } from 'vitest';

import { deduplicateInputs, inputDisplayName } from '@/lib/recording-inputs';

describe('deduplicateInputs', () => {
  it('keeps the concrete device over its default and communications aliases', () => {
    const inputs = deduplicateInputs([
      { uid: 'default', name: '既定 - USB Microphone', type: 'default' },
      { uid: 'comm', name: '通信 - USB Microphone', type: 'communications' },
      { uid: 'usb', name: 'USB Microphone', type: 'audioinput' },
      { uid: 'builtin', name: 'Built-in Microphone', type: 'audioinput' },
    ]);
    expect(inputs.map((input) => input.uid)).toEqual(['usb', 'builtin']);
  });

  it('keeps an alias when no concrete entry exists', () => {
    const inputs = deduplicateInputs([{ uid: 'default', name: 'Default - Mic', type: 'default' }]);
    expect(inputs.map((input) => input.uid)).toEqual(['default']);
  });
});

describe('inputDisplayName', () => {
  it('falls back from name to type to a generic label', () => {
    expect(inputDisplayName({ name: 'USB Mic', type: 'audioinput' })).toBe('USB Mic');
    expect(inputDisplayName({ name: '', type: 'Bluetooth' })).toBe('Bluetooth');
    expect(inputDisplayName({ name: '', type: '' })).toBe('既定のマイク');
  });
});
