/**
 * Every alert sound in the app, generated on the fly with the Web Audio
 * API — no audio files, no new dependency, no internet, works on any
 * machine offline just like the rest of this app. A "sound" here is just a
 * short recipe of one or more scheduled tones.
 */

const SOUND_KEY = 'pharmacy.soundsEnabled';

export function isSoundEnabled(): boolean {
  return localStorage.getItem(SOUND_KEY) !== 'false';
}

export function setSoundEnabled(enabled: boolean) {
  localStorage.setItem(SOUND_KEY, String(enabled));
}

interface ToneSpec {
  /** Hz. */
  freq: number;
  /** Seconds from when the sound starts. */
  start: number;
  /** Seconds. */
  duration: number;
  type?: OscillatorType;
  /** Peak volume, 0-1. */
  gain?: number;
}

// Lazy singleton: created on first use (some browsers start an AudioContext
// suspended until a real user gesture — every caller here is already
// downstream of one, a click, so resume() below is just a safety net) and
// reused after that, rather than spinning up a fresh context per sound.
let ctx: AudioContext | null = null;
function getContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function scheduleTone(audioCtx: AudioContext, now: number, spec: ToneSpec) {
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.type = spec.type ?? 'sine';
  osc.frequency.value = spec.freq;

  const startTime = now + spec.start;
  const endTime = startTime + spec.duration;
  const peakGain = spec.gain ?? 0.15;

  // Linear attack then exponential decay — a hard on/off would click.
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(peakGain, startTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  osc.start(startTime);
  osc.stop(endTime + 0.02);
}

/**
 * Best-effort: a blocked autoplay policy, a missing audio device, or a test
 * environment should leave the app silent, never break the save/sale/delete
 * the sound was only ever meant to accompany.
 */
function play(specs: ToneSpec[]) {
  if (!isSoundEnabled()) return;
  try {
    const audioCtx = getContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    for (const spec of specs) scheduleTone(audioCtx, now, spec);
  } catch {
    // Silence is an acceptable fallback for a tone whose only job is a hint.
  }
}

/** Generic confirmation — a save, an update, an addition: anywhere the app already shows a success toast. */
export function playSuccess() {
  play([
    { freq: 660, start: 0, duration: 0.09 },
    { freq: 880, start: 0.08, duration: 0.13 },
  ]);
}

/** Generic failure — gentler than a real alarm, since it gets heard many times a day. */
export function playError() {
  play([
    { freq: 320, start: 0, duration: 0.12, type: 'triangle' },
    { freq: 220, start: 0.1, duration: 0.16, type: 'triangle' },
  ]);
}

/** A removal that succeeded — distinct from failure, calmer than success. */
export function playDelete() {
  play([{ freq: 260, start: 0, duration: 0.14, gain: 0.13 }]);
}

/** The one signature sound in the app: a completed sale, the most frequent and most consequential action all day. */
export function playSaleComplete() {
  play([
    { freq: 523.25, start: 0, duration: 0.1 },
    { freq: 659.25, start: 0.09, duration: 0.1 },
    { freq: 783.99, start: 0.18, duration: 0.22, gain: 0.18 },
  ]);
}

/** The only way a busy cashier notices a scan that got silently capped at the remaining stock instead of adding another unit. */
export function playWarningBeep() {
  play([{ freq: 660, start: 0, duration: 0.18, type: 'square' }]);
}

/** The proactive "some stock is expiring soon" alert — deliberately its own recipe, not a reuse of playWarningBeep, so the two keep meaning different things. */
export function playExpiryAlert() {
  play([
    { freq: 440, start: 0, duration: 0.14, type: 'triangle', gain: 0.13 },
    { freq: 440, start: 0.2, duration: 0.14, type: 'triangle', gain: 0.13 },
  ]);
}
