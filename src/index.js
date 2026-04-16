'use strict';

const { cadence, buildSchedule, runSchedule, DEFAULT_OPTIONS } = require('./core');
const { renderCadence } = require('./dom');

module.exports = {
  cadence,
  buildSchedule,
  runSchedule,
  renderCadence,
  DEFAULT_OPTIONS,
};

// React hook is not required here — callers import it directly:
// const { useCadence } = require('cadence-kit/src/react');
// This avoids a hard React dependency at package root.
