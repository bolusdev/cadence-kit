# Cadence Kit

**TTS-powered speech timing for LLM text rendering.**

LLM output rendered as instant text feels like a dump. Cadence Kit gives it the rhythm of a person thinking out loud — because the timing is borrowed from an actual voice reading the same words.

The insight: ElevenLabs reads your text and returns word-level timestamps. Those timestamps know where a speaker would pause, where they'd rush, where they'd breathe. Cadence Kit uses that data to pace the visual reveal of your text — no audio plays.

---

## How it works

```
text → ElevenLabs TTS (with-timestamps) → word timings
     → buildSchedule (non-linear scaling) → per-word delays
     → pre-render invisible spans → reveal in sequence
```

One API call per text string. After that, switch presets freely — zero API calls.

---

## Quick start

### HTML (no build step)

```html
<script src="cadence-kit.js"></script>
<script src="cadence-kit.config.js"></script>

<div id="output"></div>

<script>
  const ck = cadenceKit({ apiKey: CADENCE_KIT_CONFIG.apiKey });

  ck.fetch('Your text here').then(timing => {
    ck.play(timing, document.getElementById('output'), 'conversational');
  });
</script>
```

### Vanilla JS (ESM / bundler)

```js
import cadenceKit from './cadence-kit.js';

const ck = cadenceKit({ apiKey: 'sk_…' });

const timing = await ck.fetch(text);
const player = ck.play(timing, outputEl, 'dreamy');

// later:
player.cancel();
```

### React

```jsx
import { useEffect, useRef, useState } from 'react';
import cadenceKit from './cadence-kit.js';

const ck = cadenceKit({ apiKey: 'sk_…' }); // create once outside component

function CadenceOutput({ text }) {
  const outputRef = useRef(null);
  const playerRef = useRef(null);
  const [timing, setTiming] = useState(null);

  useEffect(() => {
    ck.fetch(text).then(setTiming);
  }, [text]);

  useEffect(() => {
    if (!timing || !outputRef.current) return;
    outputRef.current.innerHTML = '';
    playerRef.current?.cancel();
    playerRef.current = ck.play(timing, outputRef.current, 'conversational');
    return () => playerRef.current?.cancel();
  }, [timing]);

  return <div ref={outputRef} />;
}
```

---

## Visual Editor

`demo.html` is a standalone browser app — no server required.

```bash
open src/cadence-kit/demo.html
# or serve it:
npx serve src/cadence-kit
```

**What you can do in the editor:**

1. **Paste your API key** (or pre-fill it in `cadence-kit.config.js`)
2. **Write your text**
3. **Fetch Timing** — one API call, cached until text changes
4. **Choose a preset** — switch freely, no re-fetch
5. **Play** — watch the words crystallise in sequence
6. **Annotate** — assign different presets to different words
7. **Export JSON** — save your annotations for use in code

---

## CLI annotation workflow (for developers)

You don't need the browser editor. Annotations are plain JSON.

### Format

```json
{
  "version": "3",
  "text": "Not everything worth doing is hard. But the things that matter…",
  "defaultPreset": "conversational",
  "voice": "21m00Tcm4TlvDq8ikWAM",
  "annotations": [
    { "wordIndex": 3, "preset": "deliberate" },
    { "wordIndex": 4, "preset": "deliberate" },
    { "wordIndex": 12, "preset": "dreamy" }
  ]
}
```

**Word indices are 0-based**, counting only words (not paragraph breaks).

### Create annotations in VS Code

1. Run your text through the tokeniser to get word indices:

```js
// In Node.js:
const text = require('fs').readFileSync('my-text.txt', 'utf8');
const words = text.split(/\n\n+/).flatMap((p, i) => {
  const ws = p.split(/\s+/).filter(Boolean);
  return ws.map((w, j) => ({ index: i * 100 + j, word: w }));
});
// Map each word to its sequential index
let idx = 0;
text.split(/\n\n+/).forEach(para => {
  para.split(/\s+/).filter(Boolean).forEach(w => {
    console.log(`${idx++}: ${w}`);
  });
});
```

2. Create your `.cadence.json` file by hand or with the browser editor
3. Import it in your app:

```js
import annotation from './my-text.cadence.json';
import cadenceKit from './cadence-kit.js';

const ck = cadenceKit({ apiKey: 'sk_…' });

// Build wordPresets map from annotation
const wordPresets = {};
annotation.annotations.forEach(a => {
  wordPresets[a.wordIndex] = a.preset;
});

// Fetch once
const timing = await ck.fetch(annotation.text);

// Play with mixed presets
ck.play(timing, outputEl, {
  preset: annotation.defaultPreset,
  wordPresets,
});
```

---

## Configuration

Set defaults in `cadence-kit.config.js`:

```js
window.CADENCE_KIT_CONFIG = {
  apiKey: 'sk_…',          // your ElevenLabs key
  defaultPreset: 'conversational', // starting preset in the editor
  voiceId: '21m00Tcm4TlvDq8ikWAM', // voice used for timing
};
```

Available voices: [elevenlabs.io/voice-library](https://elevenlabs.io/voice-library)

---

## Presets

| Preset | Character | Speed |
|--------|-----------|-------|
| `instant` | No waiting. Words arrive immediately. | Fastest |
| `swift` | Fast and clean. Subtitle pace. | |
| `conversational` | Natural speech pace. **The default.** | |
| `deliberate` | Measured. Every word gets its moment. | |
| `grounded` | Confident. Pauses land with weight. | |
| `intimate` | Warm and close. Soft edges, unhurried. | |
| `dreamy` | Words emerge from fog. Slow and soft. | |
| `poetic` | Very slow. Each word is an event. | |
| `reverent` | Ceremonial. Long silences. | |
| `meditative` | Ultra slow. Each word given space to breathe. | Slowest |

List and inspect presets:

```js
cadenceKit.presets           // array of all 10 preset objects
cadenceKit.getPreset('dreamy') // { id, name, description, transitionMs, blurPx, … }
```

---

## API reference

### `cadenceKit(options)`

Create an instance.

```ts
cadenceKit({
  apiKey?:  string;  // ElevenLabs API key
  voiceId?: string;  // voice id (default: Rachel)
  modelId?: string;  // model id (default: eleven_multilingual_v2)
})
```

### `.fetch(text)`

Fetch timing from ElevenLabs. Returns a promise.

```ts
fetch(text: string): Promise<{
  tokens:    Array<{ type: 'word' | 'break', text?: string }>;
  ttsWords:  Array<{ text: string, startTime: number }>;
  charCount: number;
  wordCount: number;
}>
```

**Cache this result.** Every `.fetch()` call is one ElevenLabs API call.

### `.play(timing, element, opts?)`

Animate a cached timing object. Returns `{ cancel }`.

```ts
play(
  timing:  TimingData,
  element: HTMLElement,
  opts?:   string | {
    preset?:      string;               // global preset id
    wordPresets?: Record<number, string>; // per-word overrides
  }
): { cancel: () => void }
```

### `.schedule(timing, opts?)`

Build the schedule without rendering. Useful for custom renderers.

```ts
schedule(timing, opts?): Array<{
  type:     'word' | 'break';
  text?:    string;
  delay:    number; // ms
  presetId?: string;
}>
```

---

## Security

**Never ship your API key to production in client-side code.** The browser editor is for development. For production:

### Option 1 — Server proxy (recommended)

The included `server/proxy.js` holds your key server-side:

```bash
ELEVENLABS_API_KEY=sk_… ALLOWED_ORIGIN=https://yoursite.com node server/proxy.js
```

In your client, point fetch calls to the proxy:

```js
// Instead of calling ElevenLabs directly, call your proxy:
const res  = await fetch('https://your-server.com/tts-timing', {
  method:  'POST',
  headers: { 'Content-Type': 'application/json' },
  body:    JSON.stringify({ text, voice_id: '21m00Tcm4TlvDq8ikWAM' }),
});
const data = await res.json();
```

Or use the `CadenceKit` Dart class with `proxyUrl` for Flutter.

### Option 2 — Pre-generate timings at build time

Run `.fetch()` during your build process and ship the JSON. No API calls at runtime.

```js
// build.js
const ck     = cadenceKit({ apiKey: process.env.ELEVENLABS_API_KEY });
const timing = await ck.fetch(pageText);
fs.writeFileSync('public/timing.json', JSON.stringify(timing));
```

```js
// client.js — zero API calls
const timing = await fetch('/timing.json').then(r => r.json());
ck.play(timing, outputEl, 'dreamy');
```

---

## Flutter / Dart

The `cadence_kit.dart` file is a Flutter widget library.

**Add to `pubspec.yaml`:**

```yaml
dependencies:
  http: ^1.0.0
```

**Usage:**

```dart
import 'cadence_kit.dart';

// Via proxy (production)
final ck = CadenceKit(proxyUrl: 'https://your-server.com/tts-timing');

// Or direct API key (development only)
final ck = CadenceKit(apiKey: 'sk_…');

final timing = await ck.fetch('Your text here');

// In a widget tree:
CadenceText(
  timing: timing,
  preset: CadencePreset.dreamy,
  style: TextStyle(fontSize: 18, height: 1.75),
)
```

Mixed presets in Flutter:

```dart
CadenceText(
  timing: timing,
  preset: CadencePreset.conversational,
  wordPresets: {
    5: CadencePreset.dreamy,
    6: CadencePreset.dreamy,
  },
)
```

Or use `buildSchedule()` directly for custom rendering:

```dart
final schedule = ck.buildSchedule(timing, CadencePreset.poetic);
```

---

## Getting an ElevenLabs API key

1. Create a free account at [elevenlabs.io](https://elevenlabs.io)
2. Click your avatar → **API Keys** → **Create**
3. Enable: **Text to Speech** only
4. Copy the key

Free tier: 10,000 characters/month. Cadence Kit charges once per text string — not per play, not per preset change.

---

## GitHub setup

```bash
# 1. Create a new repo on github.com (cadence-kit)
# 2. In this directory:
git init
git add .
git commit -m "feat: Cadence Kit v3.0"
git remote add origin https://github.com/YOUR_USERNAME/cadence-kit.git
git push -u origin main
```

**What to include:**

```
cadence-kit/
  cadence-kit.js          ← main library
  cadence-kit.d.ts        ← TypeScript definitions
  cadence-kit.config.js   ← user config (set your API key here)
  cadence_kit.dart        ← Flutter/Dart port
  demo.html               ← visual editor
  server/
    proxy.js              ← API key proxy for production
  README.md
  package.json
```

**What NOT to commit:**
- `.env` files
- Any file containing your API key
- `node_modules/`

Add to `.gitignore`:

```
node_modules/
.env
*.env.local
```

---

## License

MIT
