import { describe, expect, it } from 'vitest';

import { encodeMonoPcmWav } from '@/lib/wav';

async function bytes(blob: Blob) {
  return new DataView(await blob.arrayBuffer());
}

function ascii(view: DataView, offset: number, length: number) {
  let text = '';
  for (let index = 0; index < length; index += 1) {
    text += String.fromCharCode(view.getUint8(offset + index));
  }
  return text;
}

describe('encodeMonoPcmWav', () => {
  it('writes a 16-bit mono PCM header at the given sample rate', async () => {
    const blob = encodeMonoPcmWav(new Float32Array([0, 0.5, -0.5, 0]), 16000);
    const view = await bytes(blob);

    expect(blob.type).toBe('audio/wav');
    expect(blob.size).toBe(44 + 4 * 2);
    expect(ascii(view, 0, 4)).toBe('RIFF');
    expect(ascii(view, 8, 4)).toBe('WAVE');
    expect(view.getUint16(22, true)).toBe(1); // channels
    expect(view.getUint32(24, true)).toBe(16000); // sample rate
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
    expect(view.getUint32(40, true)).toBe(8); // data bytes
  });

  it('normalizes the peak toward full scale with the gain capped at 8x', async () => {
    // Samples are truncated toward zero when written as int16.
    const quiet = await bytes(encodeMonoPcmWav(new Float32Array([0.05]), 16000));
    // 0.05 * 8 = 0.4 of full scale
    expect(quiet.getInt16(44, true)).toBe(Math.trunc(0.4 * 0x7fff));

    const loud = await bytes(encodeMonoPcmWav(new Float32Array([0.5, -0.25]), 16000));
    // peak 0.5 is scaled to 0.92
    expect(loud.getInt16(44, true)).toBe(Math.trunc(0.92 * 0x7fff));
    expect(loud.getInt16(46, true)).toBe(Math.trunc(-0.46 * 0x8000));
  });
});
