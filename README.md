# Cadence Kit

TTS-powered speech timing for LLM text rendering. Words reveal one at a time, paced by real voice data from ElevenLabs — no audio plays.

---

## 1. Get an ElevenLabs API key

1. Create an account at [elevenlabs.io](https://elevenlabs.io)
2. Left sidebar → Bottom → **Developers** → **API Keys** → **Create Key**
3. Enable: **Text to Speech** only
4. Copy the key

Free tier: 10,000 characters/month. Cadence Kit uses one API call per text string — not per play, not per preset change.

---

## 2. Set your config

Open `cadence-kit.config.js` and paste your key:

```js
window.CADENCE_KIT_CONFIG = {
  apiKey: 'sk_…',                    // your ElevenLabs key
  defaultPreset: 'conversational',   // starting preset
  voiceId: '21m00Tcm4TlvDq8ikWAM',  // voice used for timing (Rachel)
};
```

Other voices available at [elevenlabs.io/voice-library](https://elevenlabs.io/voice-library).

---

## 3. Try the visual editor

Open `demo.html` in a browser — no server needed.

```bash
open demo.html
# or
npx serve .
```

1. Your API key pre-fills from config
2. Write or paste your text
3. **Fetch Timing** — one API call, cached until text changes
4. Choose a preset and hit **Play**
5. Switch to **Annotate** to assign different presets to different words
6. **Export JSON** to save annotations for use in code

---

## 4. Use in your project

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

### Vanilla JS / bundler

```js
import cadenceKit from './cadence-kit.js';

const ck = cadenceKit({ apiKey: 'sk_…' });

const timing = await ck.fetch(text); // fetch once, cache
const player = ck.play(timing, outputEl, 'dreamy');

player.cancel(); // stop mid-animation if needed
```

### React

```jsx
import { useEffect, useRef, useState } from 'react';
import cadenceKit from './cadence-kit.js';

const ck = cadenceKit({ apiKey: 'sk_…' }); // create once outside component

function CadenceOutput({ text }) {
  const ref    = useRef(null);
  const player = useRef(null);
  const [timing, setTiming] = useState(null);

  useEffect(() => { ck.fetch(text).then(setTiming); }, [text]);

  useEffect(() => {
    if (!timing || !ref.current) return;
    ref.current.innerHTML = '';
    player.current?.cancel();
    player.current = ck.play(timing, ref.current, 'conversational');
    return () => player.current?.cancel();
  }, [timing]);

  return <div ref={ref} />;
}
```

### Flutter / Dart

Add to `pubspec.yaml`:

```yaml
dependencies:
  http: ^1.0.0
```

```dart
import 'cadence_kit.dart';

final ck = CadenceKit(apiKey: 'sk_…'); // or use proxyUrl for production
final timing = await ck.fetch('Your text here');

// In your widget tree:
CadenceText(
  timing: timing,
  preset: CadencePreset.dreamy,
  style: TextStyle(fontSize: 18, height: 1.75),
)
```

---

## Presets

| Preset | Feel |
|--------|------|
| `instant` | No delay. Words arrive immediately. |
| `swift` | Fast, clean. Subtitle pace. |
| `conversational` | Natural speech. **The default.** |
| `deliberate` | Measured. Every word gets its moment. |
| `grounded` | Confident. Pauses land with weight. |
| `intimate` | Warm, unhurried. Soft edges. |
| `dreamy` | Words emerge from fog. |
| `poetic` | Very slow. Each word is an event. |
| `reverent` | Ceremonial. Long silences. |
| `meditative` | Ultra slow. Each word given space. |

Per-word mixed presets — use the Annotate tab in the editor, then export the JSON:

```js
ck.play(timing, outputEl, {
  preset: 'conversational',
  wordPresets: { 5: 'dreamy', 6: 'dreamy', 12: 'poetic' },
});
```

---

## Security

**Don't ship your API key in client-side code for production.** Two options:

**Option 1 — Proxy server** (included). Holds the key server-side:

```bash
ELEVENLABS_API_KEY=sk_… ALLOWED_ORIGIN=https://yoursite.com node server/proxy.js
```

**Option 2 — Pre-generate at build time.** Run `.fetch()` once during your build and ship the JSON. Zero API calls at runtime:

```js
// build.js
const timing = await ck.fetch(pageText);
fs.writeFileSync('public/timing.json', JSON.stringify(timing));

// client.js
const timing = await fetch('/timing.json').then(r => r.json());
ck.play(timing, outputEl, 'dreamy');
```

---

## License

MIT
