'use strict';

const { buildSchedule, runSchedule, cadence, DEFAULT_OPTIONS } = require('../src/core');

describe('buildSchedule — base delay', () => {
  test('each character gets baseDelay', () => {
    const s = buildSchedule('hi', {});
    expect(s).toHaveLength(2);
    expect(s[0]).toEqual({ char: 'h', delay: 40 });
    expect(s[1]).toEqual({ char: 'i', delay: 40 });
  });

  test('baseDelay is overridable via options', () => {
    const s = buildSchedule('a', { baseDelay: 20 });
    expect(s[0].delay).toBe(20);
  });
});

describe('buildSchedule — punctuation pauses', () => {
  test('comma: +commaPause (200)', () => {
    const s = buildSchedule('a,', {});
    expect(s[1]).toEqual({ char: ',', delay: 240 });
  });

  test('colon: +commaPause (200)', () => {
    const s = buildSchedule('a:', {});
    expect(s[1]).toEqual({ char: ':', delay: 240 });
  });

  test('period: +periodPause (450)', () => {
    const s = buildSchedule('a.', {});
    expect(s[1]).toEqual({ char: '.', delay: 490 });
  });

  test('exclamation: +periodPause (450)', () => {
    const s = buildSchedule('a!', {});
    expect(s[1]).toEqual({ char: '!', delay: 490 });
  });

  test('question mark: +periodPause (450)', () => {
    const s = buildSchedule('a?', {});
    expect(s[1]).toEqual({ char: '?', delay: 490 });
  });

  test('em dash: +emDashPause (300)', () => {
    const s = buildSchedule('a\u2014', {});
    expect(s[1]).toEqual({ char: '\u2014', delay: 340 });
  });
});

describe('buildSchedule — paragraph break', () => {
  test('\\n\\n: first \\n gets paragraphPause, second gets 0 delay', () => {
    const s = buildSchedule('a\n\nb', {});
    expect(s[1]).toEqual({ char: '\n', delay: 740 }); // 40 + 700
    expect(s[2]).toEqual({ char: '\n', delay: 0 });
    expect(s[3]).toEqual({ char: 'b', delay: 40 });
  });

  test('single \\n: no extra pause', () => {
    const s = buildSchedule('a\nb', {});
    expect(s[1]).toEqual({ char: '\n', delay: 40 });
  });
});

describe('buildSchedule — word length bonus', () => {
  test('word of 6 chars or fewer: no length bonus', () => {
    // 'hello' = 5 chars — last char 'o' at index 4
    const s = buildSchedule('hello ', {});
    expect(s[4].delay).toBe(40);
  });

  test('word of exactly 6 chars: no length bonus (boundary)', () => {
    // 'really' = 6 chars — exactly at the threshold, extraChars = 0
    const s = buildSchedule('really ', {});
    expect(s[5].delay).toBe(40);
  });

  test('word of 7 chars: +8ms on last character', () => {
    // 'quickly' = 7 chars, 1 above 6 → +8ms on 'y'
    const s = buildSchedule('quickly ', {});
    expect(s[6].delay).toBe(40 + 8);
  });

  test('word of 13 chars: +56ms on last character', () => {
    // 'understanding' = 13 chars, 7 above 6 → +56ms on 'g'
    const s = buildSchedule('understanding ', {});
    expect(s[12].delay).toBe(40 + 56);
  });
});

describe('buildSchedule — weight words', () => {
  // Note: 'always' is exactly 6 chars — sits at the word-length boundary (no length bonus stacks).
  // If the threshold changes from 6 to 5, this test will catch the regression.
  test.each(['not', 'never', 'only', 'but', 'yet', 'just', 'no', 'yes', 'every', 'always'])(
    '"%s" adds weightPause (200ms) to its last character',
    (word) => {
      const s = buildSchedule(word + ' ', {});
      const lastWordCharIdx = word.length - 1;
      expect(s[lastWordCharIdx].delay).toBe(40 + 200);
    }
  );

  test('non-weight word gets no weight bonus', () => {
    const s = buildSchedule('hello ', {});
    expect(s[4].delay).toBe(40);
  });

  test('weight word followed by period: word gets weightPause, period gets periodPause', () => {
    // "not." → 't' gets +200, '.' gets +450
    const s = buildSchedule('not.', {});
    expect(s[2].delay).toBe(40 + 200); // 't'
    expect(s[3].delay).toBe(40 + 450); // '.'
  });

  test('weight word at end of string (no trailing space)', () => {
    const s = buildSchedule('not', {});
    expect(s[2].delay).toBe(40 + 200);
  });
});

describe('runSchedule', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('fires first character immediately', () => {
    const chars = [];
    runSchedule([{ char: 'h', delay: 50 }, { char: 'i', delay: 50 }], (c) => chars.push(c));
    expect(chars).toEqual(['h']);
  });

  test('fires subsequent characters after their delay', () => {
    const chars = [];
    runSchedule(
      [{ char: 'a', delay: 100 }, { char: 'b', delay: 200 }, { char: 'c', delay: 50 }],
      (c) => chars.push(c)
    );
    expect(chars).toEqual(['a']);
    jest.advanceTimersByTime(100);
    expect(chars).toEqual(['a', 'b']);
    jest.advanceTimersByTime(200);
    expect(chars).toEqual(['a', 'b', 'c']);
  });

  test('cancel() stops animation — subsequent chars do not fire', () => {
    const chars = [];
    const { cancel } = runSchedule(
      [{ char: 'a', delay: 100 }, { char: 'b', delay: 100 }, { char: 'c', delay: 100 }],
      (c) => chars.push(c)
    );
    jest.advanceTimersByTime(100); // fires 'b'
    cancel();
    jest.advanceTimersByTime(100); // 'c' should NOT fire
    expect(chars).toEqual(['a', 'b']);
  });

  test('empty schedule: onChar is never called', () => {
    const onChar = jest.fn();
    runSchedule([], onChar);
    jest.runAllTimers();
    expect(onChar).not.toHaveBeenCalled();
  });
});

describe('cadence()', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('does not fire until thinkingDelay has elapsed', () => {
    const chars = [];
    cadence('hi', (c) => chars.push(c), { thinkingDelay: 300 });
    expect(chars).toEqual([]);
    jest.advanceTimersByTime(299);
    expect(chars).toEqual([]);
    jest.advanceTimersByTime(1);
    expect(chars).toEqual(['h']);
  });

  test('fires all characters after thinkingDelay', () => {
    const chars = [];
    cadence('hi', (c) => chars.push(c), { thinkingDelay: 0, baseDelay: 50 });
    jest.advanceTimersByTime(0); // thinking delay = 0 resolves on next tick
    jest.runAllTimers();
    expect(chars).toEqual(['h', 'i']);
  });

  test('cancel() during thinkingDelay: no characters fire', () => {
    const chars = [];
    const { cancel } = cadence('hi', (c) => chars.push(c), { thinkingDelay: 300, baseDelay: 50 });
    jest.advanceTimersByTime(150);
    cancel();
    jest.runAllTimers();
    expect(chars).toEqual([]);
  });

  test('accepts async iterable: buffers then animates', async () => {
    const chars = [];
    async function* stream() {
      yield 'he';
      yield 'llo';
    }
    cadence(stream(), (c) => chars.push(c), { thinkingDelay: 0, baseDelay: 50 });
    // 2 yields × 2 microtask ticks each = 4 flushes; +2 for for-await loop overhead = 6 total
    for (let i = 0; i < 6; i++) await Promise.resolve();
    jest.runAllTimers();
    expect(chars).toEqual(['h', 'e', 'l', 'l', 'o']);
  });
});
