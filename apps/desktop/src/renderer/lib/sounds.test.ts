// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * jsdom has no real audio stack, so this stands in for it — just enough of
 * the Web Audio API surface for sounds.ts to schedule tones against, with
 * every call recorded so a test can assert on the exact recipe (frequency,
 * timing, oscillator count) each named sound produces.
 */
class FakeOscillator {
  type = 'sine';
  frequency = { value: 0 };
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class FakeGain {
  gain = {
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  connect = vi.fn();
}

let oscillators: FakeOscillator[] = [];
let audioContextConstructions = 0;

class FakeAudioContext {
  currentTime = 0;
  destination = {};
  state = 'running';
  resume = vi.fn();

  constructor() {
    audioContextConstructions++;
  }

  createOscillator() {
    const osc = new FakeOscillator();
    oscillators.push(osc);
    return osc;
  }

  createGain() {
    return new FakeGain();
  }
}

beforeEach(() => {
  oscillators = [];
  audioContextConstructions = 0;
  localStorage.clear();
  vi.stubGlobal('AudioContext', FakeAudioContext);
  // sounds.ts keeps a module-level singleton AudioContext — a fresh module
  // instance per test is what makes "one shared context" actually testable
  // instead of leaking state (and a stale FakeAudioContext) between tests.
  vi.resetModules();
});

describe('sound enable/disable preference', () => {
  it('defaults to enabled when nothing has been set', async () => {
    const { isSoundEnabled } = await import('./sounds');
    expect(isSoundEnabled()).toBe(true);
  });

  it('persists a disabled preference across reads', async () => {
    const { isSoundEnabled, setSoundEnabled } = await import('./sounds');
    setSoundEnabled(false);
    expect(isSoundEnabled()).toBe(false);
    setSoundEnabled(true);
    expect(isSoundEnabled()).toBe(true);
  });
});

describe('named sounds', () => {
  it('playSuccess schedules two ascending notes', async () => {
    const { playSuccess } = await import('./sounds');
    playSuccess();
    expect(oscillators.map((o) => o.frequency.value)).toEqual([660, 880]);
  });

  it('playError schedules two descending notes, distinct from playSuccess', async () => {
    const { playError, playSuccess } = await import('./sounds');
    playError();
    const errorFreqs = oscillators.map((o) => o.frequency.value);
    expect(errorFreqs[1]).toBeLessThan(errorFreqs[0]);

    oscillators = [];
    playSuccess();
    const successFreqs = oscillators.map((o) => o.frequency.value);
    expect(errorFreqs).not.toEqual(successFreqs);
  });

  it('playDelete schedules exactly one note, distinct from error and success', async () => {
    const { playDelete } = await import('./sounds');
    playDelete();
    expect(oscillators).toHaveLength(1);
  });

  it('playExpiryAlert is distinct from playWarningBeep — reusing the stock-cap beep would blur two different meanings', async () => {
    const { playExpiryAlert, playWarningBeep } = await import('./sounds');
    playExpiryAlert();
    const expiryFreqs = oscillators.map((o) => o.frequency.value);

    oscillators = [];
    playWarningBeep();
    const warningFreqs = oscillators.map((o) => o.frequency.value);

    expect(expiryFreqs).not.toEqual(warningFreqs);
  });

  it('playSaleComplete schedules a longer, richer arpeggio than the generic success chime', async () => {
    const { playSaleComplete, playSuccess } = await import('./sounds');
    playSaleComplete();
    const saleFreqs = oscillators.map((o) => o.frequency.value);

    oscillators = [];
    playSuccess();
    const successFreqs = oscillators.map((o) => o.frequency.value);

    expect(saleFreqs.length).toBeGreaterThan(successFreqs.length);
  });

  it('reuses one shared AudioContext across multiple sounds instead of creating a new one each time', async () => {
    const { playSuccess, playError } = await import('./sounds');
    playSuccess();
    playError();
    playSuccess();
    expect(audioContextConstructions).toBe(1);
  });

  it('plays nothing at all when sound is disabled', async () => {
    const { playSuccess, setSoundEnabled } = await import('./sounds');
    setSoundEnabled(false);
    playSuccess();
    expect(oscillators).toHaveLength(0);
    expect(audioContextConstructions).toBe(0);
  });

  it('playWarningBeep schedules a single square-wave tone (the barcode-scan stock-limit hint)', async () => {
    const { playWarningBeep } = await import('./sounds');
    playWarningBeep();
    expect(oscillators).toHaveLength(1);
    expect(oscillators[0].type).toBe('square');
    expect(oscillators[0].frequency.value).toBe(660);
  });

  it('never throws even if the audio backend itself is broken, so a sound failure can never break the action it accompanies', async () => {
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new Error('no audio device');
        }
      },
    );
    const { playSuccess } = await import('./sounds');
    expect(() => playSuccess()).not.toThrow();
  });
});
