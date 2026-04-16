'use strict';

const DEFAULT_OPTIONS = {
  baseDelay: 40,
  thinkingDelay: 300,
  commaPause: 200,
  periodPause: 450,
  emDashPause: 300,
  paragraphPause: 700,
  wordLengthScale: 8,
  weightWords: ['not', 'never', 'only', 'but', 'yet', 'just', 'no', 'yes', 'every', 'always'],
  weightPause: 200,
};

function buildSchedule(text, options) {
  const opts = Object.assign({}, DEFAULT_OPTIONS, options);
  const schedule = [];
  let wordBuffer = '';

  function flushWord() {
    if (wordBuffer.length === 0) return;
    const word = wordBuffer.toLowerCase();
    const extraChars = Math.max(0, wordBuffer.length - 6);
    const lengthBonus = extraChars * opts.wordLengthScale;
    const weightBonus = opts.weightWords.includes(word) ? opts.weightPause : 0;
    if (schedule.length > 0) {
      schedule[schedule.length - 1].delay += lengthBonus + weightBonus;
    }
    wordBuffer = '';
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // Paragraph break: \n\n
    if (char === '\n' && i + 1 < text.length && text[i + 1] === '\n') {
      flushWord();
      schedule.push({ char: '\n', delay: opts.baseDelay + opts.paragraphPause });
      schedule.push({ char: '\n', delay: 0 });
      i++;
      continue;
    }

    const isWordChar = /\w/.test(char);
    if (!isWordChar && wordBuffer.length > 0) flushWord();
    if (isWordChar) wordBuffer += char;

    let pause = 0;
    if (char === ',' || char === ':') pause = opts.commaPause;
    else if (char === '.' || char === '!' || char === '?') pause = opts.periodPause;
    else if (char === '\u2014') pause = opts.emDashPause;

    schedule.push({ char, delay: opts.baseDelay + pause });
  }

  flushWord();
  return schedule;
}

function runSchedule(schedule, onChar) {
  let cancelled = false;
  let timeoutId = null;

  function fire(index) {
    if (cancelled || index >= schedule.length) return;
    const { char, delay } = schedule[index];
    // delay is the pause AFTER this char — it becomes the wait before the next char fires
    onChar(char);
    timeoutId = setTimeout(() => fire(index + 1), delay);
  }

  if (schedule.length > 0) fire(0);

  return {
    cancel() {
      cancelled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
    },
  };
}

async function _bufferStream(asyncIterable) {
  let text = '';
  for await (const chunk of asyncIterable) {
    text += chunk;
  }
  return text;
}

function cadence(text, onChar, options) {
  const opts = Object.assign({}, DEFAULT_OPTIONS, options);
  let cancelled = false;
  let thinkingTimeout = null;
  let runner = null;

  function startAnimation(fullText) {
    if (cancelled) return;
    thinkingTimeout = setTimeout(() => {
      if (cancelled) return;
      thinkingTimeout = null;
      const schedule = buildSchedule(fullText, opts);
      runner = runSchedule(schedule, onChar);
    }, opts.thinkingDelay);
  }

  if (typeof text === 'string') {
    startAnimation(text);
  } else {
    _bufferStream(text).then((fullText) => {
      startAnimation(fullText);
    }).catch(() => {
      // Stream failed — animation does not start.
    });
  }

  return {
    cancel() {
      cancelled = true;
      if (thinkingTimeout !== null) clearTimeout(thinkingTimeout);
      if (runner !== null) runner.cancel();
    },
  };
}

module.exports = { cadence, buildSchedule, runSchedule, DEFAULT_OPTIONS };
