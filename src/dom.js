'use strict';

const { cadence } = require('./core');

/**
 * renderCadence(text, element, options?)
 * Animates text into element.textContent with speech-like cadence.
 * Returns { cancel }.
 */
function renderCadence(text, element, options) {
  return cadence(text, (char) => {
    element.textContent += char;
  }, options);
}

module.exports = { renderCadence };
