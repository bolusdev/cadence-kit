/**
 * Cadence Kit v3.0 — TypeScript definitions
 */

export interface Preset {
  id: string;
  name: string;
  description: string;
  delayDivisor: number;
  globalMultiplier: number;
  minWordDelay: number;
  lastWordDelay: number;
  paragraphPause: number;
  transitionMs: number;
  blurPx: number;
  easing: string;
}

export interface WordTiming {
  text: string;
  startTime: number; // seconds
}

export interface Token {
  type: 'word' | 'break';
  text?: string;
}

export interface TimingData {
  tokens: Token[];
  ttsWords: WordTiming[];
  charCount: number;
  wordCount: number;
}

export interface ScheduleItem {
  type: 'word' | 'break';
  text?: string;
  delay: number;
  presetId?: string;
}

/** Per-word preset overrides. Keys are word indices (0-based). */
export type WordPresets = Record<number, string>;

export interface PlayOptions {
  /** Global preset id. Applied to all words without a per-word override. Default: 'conversational'. */
  preset?: string;
  /** Per-word preset overrides. */
  wordPresets?: WordPresets;
}

export interface PlayerHandle {
  cancel(): void;
}

export interface CadenceKitOptions {
  /** ElevenLabs API key. Required for .fetch(). Not needed if using a proxy. */
  apiKey?: string;
  /** ElevenLabs voice id. Default: Rachel (21m00Tcm4TlvDq8ikWAM). */
  voiceId?: string;
  /** ElevenLabs model id. Default: eleven_multilingual_v2. */
  modelId?: string;
}

export interface CadenceKitInstance {
  /**
   * Fetch timing data from ElevenLabs. Call once per text string — cache the result.
   * One API call, charged at ElevenLabs per-character rate.
   */
  fetch(text: string): Promise<TimingData>;

  /**
   * Animate a cached timing object into a DOM element. Zero API calls.
   *
   * @param timing   — result of .fetch()
   * @param element  — DOM element to render into (will be populated with word spans)
   * @param opts     — preset id string, or PlayOptions object for per-word control
   */
  play(timing: TimingData, element: HTMLElement, opts?: string | PlayOptions): PlayerHandle;

  /**
   * Build the animation schedule without touching the DOM.
   * Useful for custom renderers (React, Canvas, server-side, etc).
   */
  schedule(timing: TimingData, opts?: string | PlayOptions): ScheduleItem[];
}

export interface CadenceKitFactory {
  (options?: CadenceKitOptions): CadenceKitInstance;
  presets: Preset[];
  getPreset(id: string): Preset | null;
}

/**
 * Create a Cadence Kit instance.
 *
 * @example
 * const ck = cadenceKit({ apiKey: 'sk_…' });
 * const timing = await ck.fetch(myText);
 * const player = ck.play(timing, document.getElementById('output'), 'dreamy');
 * // later:
 * player.cancel();
 */
declare const cadenceKit: CadenceKitFactory;

export default cadenceKit;
export = cadenceKit;
