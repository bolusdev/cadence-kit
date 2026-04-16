// ─────────────────────────────────────────────────────────────────────────────
//  Cadence Kit — Configuration
// ─────────────────────────────────────────────────────────────────────────────
//
//  Step 1: Get an ElevenLabs API key
//    → elevenlabs.io → click your avatar (bottom left) → API Keys → Create
//    → Enable: Text to Speech only
//
//  Step 2: Paste your key below and save this file
//
//  That's it. Open demo.html in a browser.
//
// ─────────────────────────────────────────────────────────────────────────────

window.CADENCE_KIT_CONFIG = {

  // Your ElevenLabs API key ↓
  apiKey: '',

  // Starting preset — change to any of the 10 options below (or pick in the UI)
  // instant | swift | conversational | deliberate | grounded |
  // intimate | dreamy | poetic | reverent | meditative
  defaultPreset: 'conversational',

  // Voice used to generate timing data
  // Default: Rachel (neutral English). More voices at elevenlabs.io/voice-library
  voiceId: '21m00Tcm4TlvDq8ikWAM',

};
