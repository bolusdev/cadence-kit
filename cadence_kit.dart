/// Cadence Kit v3.0 — Dart/Flutter port
///
/// TTS-derived speech timing for LLM text rendering.
///
/// Usage (Flutter):
///   final ck = CadenceKit(apiKey: 'sk_…');
///   final timing = await ck.fetch('Your text here');
///
///   // In a widget:
///   CadenceText(
///     timing: timing,
///     preset: CadencePreset.dreamy,
///     style: TextStyle(fontSize: 18),
///   )
///
/// Or use scheduleItems directly for custom rendering:
///   final items = ck.buildSchedule(timing, CadencePreset.conversational);
///   for (final item in items) { ... }
///
/// Via proxy (recommended for production — keeps API key off device):
///   final ck = CadenceKit(proxyUrl: 'https://your-server.com/tts-timing');

library cadence_kit;

import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

// ── Preset ────────────────────────────────────────────────────────────────────

class CadencePreset {
  final String id;
  final String name;
  final String description;
  final int delayDivisor;
  final double globalMultiplier;
  final int minWordDelay;
  final int lastWordDelay;
  final int paragraphPause;
  final int transitionMs;
  final double blurPx;
  final Curve curve;

  const CadencePreset({
    required this.id,
    required this.name,
    required this.description,
    required this.delayDivisor,
    required this.globalMultiplier,
    required this.minWordDelay,
    required this.lastWordDelay,
    required this.paragraphPause,
    required this.transitionMs,
    required this.blurPx,
    required this.curve,
  });

  static const instant = CadencePreset(
    id: 'instant', name: 'Instant',
    description: 'No waiting. Words arrive immediately.',
    delayDivisor: 3000, globalMultiplier: 0.1,
    minWordDelay: 0, lastWordDelay: 300, paragraphPause: 150,
    transitionMs: 100, blurPx: 0, curve: Curves.easeOut,
  );
  static const swift = CadencePreset(
    id: 'swift', name: 'Swift',
    description: 'Fast and clean. Subtitle pace.',
    delayDivisor: 1200, globalMultiplier: 0.55,
    minWordDelay: 40, lastWordDelay: 600, paragraphPause: 400,
    transitionMs: 140, blurPx: 0, curve: Curves.easeOut,
  );
  static const conversational = CadencePreset(
    id: 'conversational', name: 'Conversational',
    description: 'Natural speech pace. The default.',
    delayDivisor: 700, globalMultiplier: 0.9,
    minWordDelay: 80, lastWordDelay: 900, paragraphPause: 700,
    transitionMs: 220, blurPx: 1, curve: Curves.ease,
  );
  static const deliberate = CadencePreset(
    id: 'deliberate', name: 'Deliberate',
    description: 'Measured. Every word gets its moment.',
    delayDivisor: 600, globalMultiplier: 1.1,
    minWordDelay: 100, lastWordDelay: 1000, paragraphPause: 800,
    transitionMs: 280, blurPx: 2, curve: Curves.ease,
  );
  static const grounded = CadencePreset(
    id: 'grounded', name: 'Grounded',
    description: 'Confident. Pauses land with weight.',
    delayDivisor: 500, globalMultiplier: 1.3,
    minWordDelay: 100, lastWordDelay: 1100, paragraphPause: 900,
    transitionMs: 180, blurPx: 0, curve: Curves.easeOut,
  );
  static const intimate = CadencePreset(
    id: 'intimate', name: 'Intimate',
    description: 'Warm and close. Soft edges, unhurried.',
    delayDivisor: 500, globalMultiplier: 1.4,
    minWordDelay: 110, lastWordDelay: 1100, paragraphPause: 950,
    transitionMs: 400, blurPx: 3, curve: Curves.ease,
  );
  static const dreamy = CadencePreset(
    id: 'dreamy', name: 'Dreamy',
    description: 'Words emerge from fog. Slow and soft.',
    delayDivisor: 400, globalMultiplier: 1.6,
    minWordDelay: 130, lastWordDelay: 1300, paragraphPause: 1100,
    transitionMs: 600, blurPx: 5, curve: Curves.ease,
  );
  static const poetic = CadencePreset(
    id: 'poetic', name: 'Poetic',
    description: 'Very slow. Each word is an event.',
    delayDivisor: 350, globalMultiplier: 2.0,
    minWordDelay: 150, lastWordDelay: 1500, paragraphPause: 1400,
    transitionMs: 500, blurPx: 3, curve: Curves.ease,
  );
  static const reverent = CadencePreset(
    id: 'reverent', name: 'Reverent',
    description: 'Ceremonial. Long silences. Words carry weight.',
    delayDivisor: 300, globalMultiplier: 2.5,
    minWordDelay: 180, lastWordDelay: 2000, paragraphPause: 1800,
    transitionMs: 800, blurPx: 6, curve: Curves.ease,
  );
  static const meditative = CadencePreset(
    id: 'meditative', name: 'Meditative',
    description: 'Ultra slow. Each word given space to breathe.',
    delayDivisor: 250, globalMultiplier: 3.5,
    minWordDelay: 220, lastWordDelay: 2500, paragraphPause: 2500,
    transitionMs: 1200, blurPx: 8, curve: Curves.ease,
  );

  static const all = <CadencePreset>[
    instant, swift, conversational, deliberate, grounded,
    intimate, dreamy, poetic, reverent, meditative,
  ];

  static CadencePreset? byId(String id) {
    try {
      return all.firstWhere((p) => p.id == id);
    } catch (_) {
      return null;
    }
  }
}

// ── Data models ───────────────────────────────────────────────────────────────

class WordTiming {
  final String text;
  final double startTime; // seconds

  const WordTiming({required this.text, required this.startTime});
}

class TimingData {
  final List<String> wordTokens; // words in order (for schedule building)
  final List<bool> breakAfter;   // true if a paragraph break follows word[i]
  final List<WordTiming> ttsWords;
  final int charCount;

  const TimingData({
    required this.wordTokens,
    required this.breakAfter,
    required this.ttsWords,
    required this.charCount,
  });

  int get wordCount => ttsWords.length;
}

enum ScheduleItemType { word, paragraphBreak }

class ScheduleItem {
  final ScheduleItemType type;
  final String? text;
  final Duration delay;
  final CadencePreset? preset;

  const ScheduleItem({
    required this.type,
    this.text,
    required this.delay,
    this.preset,
  });
}

// ── Tokeniser ─────────────────────────────────────────────────────────────────

List<ScheduleItem> _buildSchedule(
  TimingData timing,
  CadencePreset globalPreset,
  Map<int, CadencePreset>? wordPresets,
) {
  final wp = wordPresets ?? {};
  final items = <ScheduleItem>[];
  final words = timing.ttsWords;

  int wi = 0;
  for (int idx = 0; idx < timing.wordTokens.length; idx++) {
    final preset = wp[idx] ?? globalPreset;
    final curr   = words[wi];
    final next   = wi + 1 < words.length ? words[wi + 1] : null;
    wi++;

    int delayMs;
    if (next != null) {
      final rawMs = ((next.startTime - curr.startTime) * 1000).round();
      delayMs = (rawMs * (1 + rawMs / preset.delayDivisor) * preset.globalMultiplier)
          .round()
          .clamp(preset.minWordDelay, 30000);
    } else {
      delayMs = preset.lastWordDelay;
    }

    items.add(ScheduleItem(
      type: ScheduleItemType.word,
      text: timing.wordTokens[idx],
      delay: Duration(milliseconds: delayMs),
      preset: preset,
    ));

    if (timing.breakAfter[idx]) {
      items.add(ScheduleItem(
        type: ScheduleItemType.paragraphBreak,
        delay: Duration(milliseconds: globalPreset.paragraphPause),
      ));
    }
  }

  return items;
}

List<WordTiming> _extractWordTimings(Map<String, dynamic> alignment) {
  final chars = (alignment['characters'] as List).cast<String>();
  final times = (alignment['character_start_times_seconds'] as List).cast<num>();
  final words = <WordTiming>[];
  var word    = '';
  var t0      = 0.0;

  for (var i = 0; i < chars.length; i++) {
    final ch = chars[i];
    if (RegExp(r'\s').hasMatch(ch)) {
      if (word.isNotEmpty) {
        words.add(WordTiming(text: word, startTime: t0));
        word = '';
      }
    } else {
      if (word.isEmpty) t0 = times[i].toDouble();
      word += ch;
    }
  }
  if (word.isNotEmpty) words.add(WordTiming(text: word, startTime: t0));
  return words;
}

TimingData _parseTimingData(String text, Map<String, dynamic> alignment) {
  final ttsWords   = _extractWordTimings(alignment);
  final wordTokens = <String>[];
  final breakAfter = <bool>[];

  final paragraphs = text.split(RegExp(r'\n\n+'));
  for (var pi = 0; pi < paragraphs.length; pi++) {
    final paraWords = paragraphs[pi].trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
    for (var wi = 0; wi < paraWords.length; wi++) {
      wordTokens.add(paraWords[wi]);
      // paragraph break after last word of each paragraph except the last
      breakAfter.add(wi == paraWords.length - 1 && pi < paragraphs.length - 1);
    }
  }

  return TimingData(
    wordTokens: wordTokens,
    breakAfter: breakAfter,
    ttsWords: ttsWords,
    charCount: text.length,
  );
}

// ── CadenceKit ────────────────────────────────────────────────────────────────

class CadenceKit {
  final String? apiKey;
  final String? proxyUrl;
  final String voiceId;
  final String modelId;

  CadenceKit({
    this.apiKey,
    this.proxyUrl,
    this.voiceId = '21m00Tcm4TlvDq8ikWAM',
    this.modelId = 'eleven_multilingual_v2',
  }) : assert(
    apiKey != null || proxyUrl != null,
    'Provide either apiKey (direct) or proxyUrl (server-side proxy)',
  );

  /// Fetch timing data. Cache the result — one call per text string.
  Future<TimingData> fetch(String text) async {
    final Uri uri;
    final Map<String, String> headers;
    final Map<String, dynamic> body;

    if (proxyUrl != null) {
      // Via proxy — API key stays on the server
      uri     = Uri.parse(proxyUrl!);
      headers = {'Content-Type': 'application/json'};
      body    = {
        'text':           text,
        'voice_id':       voiceId,
        'model_id':       modelId,
        'voice_settings': {'stability': 0.5, 'similarity_boost': 0.75},
      };
    } else {
      // Direct — API key on device (dev/testing only)
      uri     = Uri.parse('https://api.elevenlabs.io/v1/text-to-speech/$voiceId/with-timestamps');
      headers = {'xi-api-key': apiKey!, 'Content-Type': 'application/json'};
      body    = {
        'text':           text,
        'model_id':       modelId,
        'voice_settings': {'stability': 0.5, 'similarity_boost': 0.75},
      };
    }

    final response = await http.post(uri, headers: headers, body: jsonEncode(body));

    if (response.statusCode != 200) {
      final err = jsonDecode(response.body);
      final msg = err?['detail']?['message'] ?? 'HTTP ${response.statusCode}';
      throw Exception('CadenceKit: $msg');
    }

    final data      = jsonDecode(response.body) as Map<String, dynamic>;
    final alignment = data['alignment'] as Map<String, dynamic>;
    return _parseTimingData(text, alignment);
  }

  /// Build the animation schedule (pure data, no rendering).
  List<ScheduleItem> buildSchedule(
    TimingData timing,
    CadencePreset preset, {
    Map<int, CadencePreset>? wordPresets,
  }) {
    return _buildSchedule(timing, preset, wordPresets);
  }
}

// ── CadenceText widget ────────────────────────────────────────────────────────

/// Animates a [TimingData] object as flowing text.
///
/// Words reveal one at a time, with per-word opacity/blur transitions
/// derived from the TTS timing data.
///
/// Example:
/// ```dart
/// CadenceText(
///   timing: myTimingData,
///   preset: CadencePreset.dreamy,
///   style: TextStyle(fontSize: 18, height: 1.7),
/// )
/// ```
class CadenceText extends StatefulWidget {
  final TimingData timing;
  final CadencePreset preset;
  final Map<int, CadencePreset>? wordPresets;
  final TextStyle? style;
  final bool autoPlay;
  final VoidCallback? onComplete;

  const CadenceText({
    super.key,
    required this.timing,
    this.preset = CadencePreset.conversational,
    this.wordPresets,
    this.style,
    this.autoPlay = true,
    this.onComplete,
  });

  @override
  State<CadenceText> createState() => _CadenceTextState();
}

class _CadenceTextState extends State<CadenceText> {
  late List<ScheduleItem> _schedule;
  final List<bool> _visible = [];
  int _revealedIndex = -1;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _buildAndInit();
    if (widget.autoPlay) _start();
  }

  @override
  void didUpdateWidget(CadenceText old) {
    super.didUpdateWidget(old);
    if (old.timing != widget.timing || old.preset != widget.preset) {
      _stop();
      _buildAndInit();
      if (widget.autoPlay) _start();
    }
  }

  void _buildAndInit() {
    _schedule = _buildSchedule(widget.timing, widget.preset, widget.wordPresets);
    _visible.clear();
    for (final item in _schedule) {
      if (item.type == ScheduleItemType.word) _visible.add(false);
    }
    _revealedIndex = -1;
  }

  void _start() {
    _tick();
  }

  void _stop() {
    _timer?.cancel();
    _timer = null;
  }

  void _tick() {
    // Find next word item
    int nextItemIdx = _revealedIndex + 1;
    if (nextItemIdx >= _schedule.length) {
      widget.onComplete?.call();
      return;
    }

    final item = _schedule[nextItemIdx];
    _timer = Timer(item.delay, () {
      if (!mounted) return;
      setState(() {
        if (item.type == ScheduleItemType.word) {
          // Count visible word index
          int wordIdx = 0;
          for (int i = 0; i <= nextItemIdx; i++) {
            if (_schedule[i].type == ScheduleItemType.word) {
              if (i == nextItemIdx) {
                _visible[wordIdx] = true;
              }
              wordIdx++;
            }
          }
        }
        _revealedIndex = nextItemIdx;
      });
      _tick();
    });
  }

  @override
  void dispose() {
    _stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final baseStyle = widget.style ?? const TextStyle();
    final spans     = <InlineSpan>[];
    int wordIdx     = 0;

    for (final item in _schedule) {
      if (item.type == ScheduleItemType.paragraphBreak) {
        spans.add(const TextSpan(text: '\n\n'));
      } else {
        final visible = wordIdx < _visible.length && _visible[wordIdx];
        final p       = item.preset ?? widget.preset;
        spans.add(WidgetSpan(
          child: AnimatedOpacity(
            duration: Duration(milliseconds: p.transitionMs),
            curve: p.curve,
            opacity: visible ? 1.0 : 0.0,
            child: Text('${item.text} ', style: baseStyle),
          ),
        ));
        wordIdx++;
      }
    }

    return RichText(
      text: TextSpan(children: spans),
      softWrap: true,
    );
  }
}
