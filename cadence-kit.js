/**
 * Cadence Kit v3.0
 * TTS-derived speech timing for LLM text rendering.
 *
 * API key usage:
 *   - One ElevenLabs API call per .fetch() — user-initiated only.
 *   - The returned timing object is raw TTS data. Cache it.
 *   - .play() uses cached data. Zero API calls. Switch presets freely.
 *   - Cost = character count of the text string (ElevenLabs charges per char).
 *
 * Quick start:
 *   const ck = cadenceKit({ apiKey: 'sk_…' });
 *
 *   // Fetch once — cache the result
 *   const timing = await ck.fetch(text);
 *
 *   // Play with any preset — no API call
 *   const player = ck.play(timing, element, 'dreamy');
 *   player.cancel();
 *
 *   // Per-word presets (mixed cadence)
 *   const player = ck.play(timing, element, {
 *     preset: 'conversational',
 *     wordPresets: { 5: 'dreamy', 6: 'dreamy', 7: 'poetic' },
 *   });
 *
 * Static:
 *   cadenceKit.presets        — array of all preset objects
 *   cadenceKit.getPreset(id)  — get preset by id string
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.cadenceKit = factory();
}(typeof self !== 'undefined' ? self : this, function () {

  // ── Presets ────────────────────────────────────────────────────────────────
  var PRESETS = [
    {
      id: 'instant',
      name: 'Instant',
      description: 'No waiting. Words arrive immediately.',
      delayDivisor: 3000, globalMultiplier: 0.1,
      minWordDelay: 0, lastWordDelay: 300, paragraphPause: 150,
      transitionMs: 100, blurPx: 0, easing: 'ease-out',
    },
    {
      id: 'swift',
      name: 'Swift',
      description: 'Fast and clean. Subtitle pace.',
      delayDivisor: 1200, globalMultiplier: 0.55,
      minWordDelay: 40, lastWordDelay: 600, paragraphPause: 400,
      transitionMs: 140, blurPx: 0, easing: 'ease-out',
    },
    {
      id: 'conversational',
      name: 'Conversational',
      description: 'Natural speech pace. The default.',
      delayDivisor: 700, globalMultiplier: 0.9,
      minWordDelay: 80, lastWordDelay: 900, paragraphPause: 700,
      transitionMs: 220, blurPx: 1, easing: 'ease',
    },
    {
      id: 'deliberate',
      name: 'Deliberate',
      description: 'Measured. Every word gets its moment.',
      delayDivisor: 600, globalMultiplier: 1.1,
      minWordDelay: 100, lastWordDelay: 1000, paragraphPause: 800,
      transitionMs: 280, blurPx: 2, easing: 'ease',
    },
    {
      id: 'grounded',
      name: 'Grounded',
      description: 'Confident. Pauses land with weight. Crisp reveal.',
      delayDivisor: 500, globalMultiplier: 1.3,
      minWordDelay: 100, lastWordDelay: 1100, paragraphPause: 900,
      transitionMs: 180, blurPx: 0, easing: 'ease-out',
    },
    {
      id: 'intimate',
      name: 'Intimate',
      description: 'Warm and close. Soft edges, unhurried.',
      delayDivisor: 500, globalMultiplier: 1.4,
      minWordDelay: 110, lastWordDelay: 1100, paragraphPause: 950,
      transitionMs: 400, blurPx: 3, easing: 'ease',
    },
    {
      id: 'dreamy',
      name: 'Dreamy',
      description: 'Words emerge from fog. Slow and soft.',
      delayDivisor: 400, globalMultiplier: 1.6,
      minWordDelay: 130, lastWordDelay: 1300, paragraphPause: 1100,
      transitionMs: 600, blurPx: 5, easing: 'ease',
    },
    {
      id: 'poetic',
      name: 'Poetic',
      description: 'Very slow. Each word is an event.',
      delayDivisor: 350, globalMultiplier: 2.0,
      minWordDelay: 150, lastWordDelay: 1500, paragraphPause: 1400,
      transitionMs: 500, blurPx: 3, easing: 'ease',
    },
    {
      id: 'reverent',
      name: 'Reverent',
      description: 'Ceremonial. Long silences. Words carry weight.',
      delayDivisor: 300, globalMultiplier: 2.5,
      minWordDelay: 180, lastWordDelay: 2000, paragraphPause: 1800,
      transitionMs: 800, blurPx: 6, easing: 'ease',
    },
    {
      id: 'meditative',
      name: 'Meditative',
      description: 'Ultra slow. Each word given space to breathe.',
      delayDivisor: 250, globalMultiplier: 3.5,
      minWordDelay: 220, lastWordDelay: 2500, paragraphPause: 2500,
      transitionMs: 1200, blurPx: 8, easing: 'ease',
    },
  ];

  var PRESET_MAP = {};
  PRESETS.forEach(function (p) { PRESET_MAP[p.id] = p; });
  var DEFAULT_PRESET = PRESET_MAP['conversational'];

  // ── Core ───────────────────────────────────────────────────────────────────
  function tokenize(text) {
    var tokens = [];
    text.split(/\n\n+/).forEach(function (para, i) {
      if (i > 0) tokens.push({ type: 'break' });
      para.split(/\s+/).filter(Boolean).forEach(function (w) {
        tokens.push({ type: 'word', text: w });
      });
    });
    return tokens;
  }

  function extractWordTimings(alignment) {
    var chars  = alignment.characters;
    var times  = alignment.character_start_times_seconds;
    var words  = [];
    var word   = '';
    var t0     = 0;
    for (var i = 0; i < chars.length; i++) {
      var ch = chars[i];
      if (/\s/.test(ch)) {
        if (word) { words.push({ text: word, startTime: t0 }); word = ''; }
      } else {
        if (!word) t0 = times[i];
        word += ch;
      }
    }
    if (word) words.push({ text: word, startTime: t0 });
    return words;
  }

  // wordPresets: plain object { wordIndex: presetId }
  function buildSchedule(tokens, ttsWords, globalPreset, wordPresets) {
    var wp = wordPresets || {};
    var schedule = [];
    var wi = 0, idx = 0;
    tokens.forEach(function (token) {
      if (token.type === 'break') {
        schedule.push({ type: 'break', delay: globalPreset.paragraphPause });
        return;
      }
      var preset = PRESET_MAP[wp[idx]] || globalPreset;
      idx++;
      var curr  = ttsWords[wi];
      var next  = ttsWords[wi + 1];
      wi++;
      var delay;
      if (next) {
        var raw = Math.round((next.startTime - curr.startTime) * 1000);
        delay = Math.max(
          preset.minWordDelay,
          Math.round(raw * (1 + raw / preset.delayDivisor) * preset.globalMultiplier)
        );
      } else {
        delay = preset.lastWordDelay;
      }
      schedule.push({ type: 'word', text: token.text, delay: delay, presetId: preset.id });
    });
    return schedule;
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  var _stylesInjected = false;
  function injectStyles() {
    if (_stylesInjected || typeof document === 'undefined') return;
    _stylesInjected = true;
    var s = document.createElement('style');
    s.textContent = '.ck-word{display:inline;opacity:0}.ck-word.ck-v{opacity:1}';
    document.head.appendChild(s);
  }

  // ── Public factory ─────────────────────────────────────────────────────────
  function cadenceKit(config) {
    var opts    = config || {};
    var voiceId = opts.voiceId || '21m00Tcm4TlvDq8ikWAM';
    var modelId = opts.modelId || 'eleven_multilingual_v2';

    return {
      /**
       * Fetch raw timing from ElevenLabs. Call once per text, cache the result.
       * @param {string} text
       * @returns {Promise<{ tokens, ttsWords, charCount, wordCount }>}
       */
      fetch: function (text) {
        if (!opts.apiKey) return Promise.reject(new Error('cadenceKit: apiKey is required'));
        return fetch(
          'https://api.elevenlabs.io/v1/text-to-speech/' + voiceId + '/with-timestamps',
          {
            method:  'POST',
            headers: { 'xi-api-key': opts.apiKey, 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              text:           text,
              model_id:       modelId,
              voice_settings: { stability: 0.5, similarity_boost: 0.75 },
            }),
          }
        ).then(function (res) {
          if (!res.ok) {
            return res.json().catch(function () { return {}; }).then(function (err) {
              throw new Error((err && err.detail && err.detail.message) || ('ElevenLabs HTTP ' + res.status));
            });
          }
          return res.json();
        }).then(function (data) {
          var ttsWords = extractWordTimings(data.alignment);
          var tokens   = tokenize(text);
          return {
            tokens:    tokens,
            ttsWords:  ttsWords,
            charCount: text.length,
            wordCount: ttsWords.length,
          };
        });
      },

      /**
       * Animate a cached timing object into a DOM element. Zero API calls.
       *
       * @param {Object} timing        — result of .fetch()
       * @param {Element} element      — DOM element to render into
       * @param {string|Object} opts   — preset id string, OR options object:
       *   {
       *     preset:     string,                    // global preset id (default: 'conversational')
       *     wordPresets: { [wordIndex]: presetId } // per-word overrides
       *   }
       * @returns {{ cancel: () => void }}
       */
      play: function (timing, element, playOpts) {
        if (typeof document === 'undefined') throw new Error('cadenceKit.play requires a browser environment');
        injectStyles();

        var presetId, wordPresets;
        if (typeof playOpts === 'string') {
          presetId    = playOpts;
          wordPresets = {};
        } else if (playOpts && typeof playOpts === 'object') {
          presetId    = playOpts.preset;
          wordPresets = playOpts.wordPresets || {};
        } else {
          presetId    = null;
          wordPresets = {};
        }

        var globalPreset = PRESET_MAP[presetId] || DEFAULT_PRESET;
        var schedule     = buildSchedule(timing.tokens, timing.ttsWords, globalPreset, wordPresets);
        var items        = [];

        schedule.forEach(function (item) {
          if (item.type === 'break') {
            element.appendChild(document.createElement('br'));
            element.appendChild(document.createElement('br'));
            items.push({ type: 'pause', delay: item.delay });
          } else {
            var p    = PRESET_MAP[item.presetId] || globalPreset;
            var span = document.createElement('span');
            span.className = 'ck-word';
            span.style.cssText = [
              'transition:opacity ' + p.transitionMs + 'ms ' + p.easing + ',',
              'filter ' + p.transitionMs + 'ms ' + p.easing + ';',
              'filter:blur(' + p.blurPx + 'px)',
            ].join('');
            span.textContent = item.text + ' ';
            element.appendChild(span);
            items.push({ type: 'word', span: span, delay: item.delay });
          }
        });

        var i = 0, tid = null, cancelled = false;

        function reveal() {
          if (cancelled || i >= items.length) return;
          var it = items[i++];
          if (it.type === 'word') {
            it.span.classList.add('ck-v');
            it.span.style.filter = 'blur(0)';
          }
          tid = setTimeout(reveal, it.delay);
        }

        reveal();
        return {
          cancel: function () { cancelled = true; clearTimeout(tid); },
        };
      },

      /**
       * Build the timing schedule without rendering anything.
       * Useful for server-side rendering or custom animation loops.
       *
       * @param {Object} timing        — result of .fetch()
       * @param {string|Object} opts   — same as .play()
       * @returns {Array<{ type: 'word'|'break', text?: string, delay: number, presetId?: string }>}
       */
      schedule: function (timing, opts) {
        var presetId, wordPresets;
        if (typeof opts === 'string') {
          presetId    = opts;
          wordPresets = {};
        } else if (opts && typeof opts === 'object') {
          presetId    = opts.preset;
          wordPresets = opts.wordPresets || {};
        } else {
          presetId    = null;
          wordPresets = {};
        }
        var globalPreset = PRESET_MAP[presetId] || DEFAULT_PRESET;
        return buildSchedule(timing.tokens, timing.ttsWords, globalPreset, wordPresets);
      },
    };
  }

  cadenceKit.presets   = PRESETS;
  cadenceKit.getPreset = function (id) { return PRESET_MAP[id] || null; };

  return cadenceKit;
}));
