/**
 * Cadence Kit — Server-side API proxy
 *
 * Keeps your ElevenLabs API key off the client.
 * The browser calls this proxy instead of ElevenLabs directly.
 *
 * Setup:
 *   1. Set ELEVENLABS_API_KEY in your environment
 *   2. node server/proxy.js
 *   3. In demo.html (or your app), point fetch calls to http://localhost:3001/tts-timing
 *
 * Environment variables:
 *   ELEVENLABS_API_KEY  — required
 *   PORT                — default 3001
 *   ALLOWED_ORIGIN      — CORS origin to allow (default: http://localhost:*). Use '*' for any.
 */

'use strict';

const http   = require('http');
const https  = require('https');
const PORT   = process.env.PORT || 3001;
const API_KEY         = process.env.ELEVENLABS_API_KEY;
const ALLOWED_ORIGIN  = process.env.ALLOWED_ORIGIN || 'http://localhost';

if (!API_KEY) {
  console.error('[cadence-proxy] ELEVENLABS_API_KEY is not set. Exiting.');
  process.exit(1);
}

function isCorsAllowed(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGIN === '*') return true;
  return origin.startsWith(ALLOWED_ORIGIN);
}

const server = http.createServer(function (req, res) {
  const origin = req.headers.origin || '';

  // CORS preflight
  if (req.method === 'OPTIONS') {
    if (isCorsAllowed(origin)) {
      res.writeHead(204, {
        'Access-Control-Allow-Origin':  origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age':       '86400',
      });
    } else {
      res.writeHead(403);
    }
    res.end();
    return;
  }

  // Only POST /tts-timing
  if (req.method !== 'POST' || req.url !== '/tts-timing') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  if (!isCorsAllowed(origin)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'CORS origin not allowed' }));
    return;
  }

  // Read request body
  let body = '';
  req.on('data', function (chunk) { body += chunk; });
  req.on('end', function () {
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    const { text, voice_id, model_id, voice_settings } = parsed;

    if (!text || typeof text !== 'string' || text.length > 5000) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'text is required and must be ≤ 5000 characters' }));
      return;
    }

    const vid   = (voice_id && /^[a-zA-Z0-9]{20,}$/.test(voice_id))
      ? voice_id
      : '21m00Tcm4TlvDq8ikWAM';
    const mid   = (model_id && typeof model_id === 'string')
      ? model_id
      : 'eleven_multilingual_v2';
    const vs    = (voice_settings && typeof voice_settings === 'object')
      ? voice_settings
      : { stability: 0.5, similarity_boost: 0.75 };

    const payload = JSON.stringify({ text, model_id: mid, voice_settings: vs });

    const options = {
      hostname: 'api.elevenlabs.io',
      path:     '/v1/text-to-speech/' + vid + '/with-timestamps',
      method:   'POST',
      headers:  {
        'xi-api-key':     API_KEY,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const upstream = https.request(options, function (upRes) {
      let data = '';
      upRes.on('data', function (c) { data += c; });
      upRes.on('end', function () {
        res.writeHead(upRes.statusCode, {
          'Content-Type':                'application/json',
          'Access-Control-Allow-Origin': origin,
        });
        res.end(data);
      });
    });

    upstream.on('error', function (err) {
      console.error('[cadence-proxy] Upstream error:', err.message);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Upstream request failed' }));
      }
    });

    upstream.write(payload);
    upstream.end();
  });
});

server.listen(PORT, function () {
  console.log('[cadence-proxy] Listening on http://localhost:' + PORT);
  console.log('[cadence-proxy] Forwarding to ElevenLabs with key ***' + API_KEY.slice(-4));
  console.log('[cadence-proxy] Allowed origin: ' + ALLOWED_ORIGIN);
});
