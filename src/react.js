'use strict';

const { useCallback, useEffect, useRef, useState } = require('react');
const { cadence } = require('./core');

/**
 * useCadence(options?)
 * Returns { text, write, reset }
 * write(text) — starts a new animation; cancels any in-progress animation first
 * reset()     — clears rendered text and stops
 * text        — the currently-rendered string, grows character by character
 *
 * Options are read via a ref so write() stays identity-stable even if the
 * caller passes a new options object each render.
 */
function useCadence(options) {
  const [text, setText] = useState('');
  const runnerRef = useRef(null);
  const optsRef = useRef(options);

  useEffect(() => {
    optsRef.current = options;
  });

  const write = useCallback((input) => {
    if (runnerRef.current) runnerRef.current.cancel();
    setText('');
    runnerRef.current = cadence(input, (char) => {
      setText((prev) => prev + char);
    }, optsRef.current);
  }, []); // stable — reads latest options via ref on each call

  // reset has no options dependency — empty dep array is correct and intentional
  const reset = useCallback(() => {
    if (runnerRef.current) runnerRef.current.cancel();
    runnerRef.current = null;
    setText('');
  }, []);

  return { text, write, reset };
}

module.exports = { useCadence };
