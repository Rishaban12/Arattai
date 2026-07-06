/**
 * Dev-server proxy for AI endpoints.
 * Intercepts POST /api/ai/chat and POST /api/ai/transform, calling OpenAI or Claude
 * directly so the AI features work even when the Java backend is not running.
 * Reads AI_PROVIDER and AI_API_KEY from ../../.env (project root).
 */
const fs    = require('fs');
const path  = require('path');
const https = require('https');

// ── System prompts for each transform mode ────────────────────────────────
const BASE_RULES = [
  '- Keep the user\'s original intent exactly. Never change facts, names, or meaning.',
  '- Return ONLY the transformed text. No explanations, no preamble, no commentary.',
  '- Do not wrap the output in quotes.',
  '- Output language must match the input language (Tamil in → Tamil out, English in → English out).',
  '- If the input is too short or already perfect, return it as-is.',
  '- Never add greetings, sign-offs, or filler phrases unless they were already there.',
].join('\n');

const TRANSFORM_PROMPTS = {
  polish: {
    temperature: 0.3,
    system: `You are a message assistant for Arattai, a chat application.
The user has typed a raw message. Clean it up for sending in chat.
- Fix grammar, spelling, and punctuation silently.
- Keep the tone matching the input: casual stays casual, serious stays serious.
- Make it concise and natural — like how a fluent speaker would say it in chat.
- Do not change the length significantly. A short message stays short.
- Return ONLY the polished message text.
${BASE_RULES}`,
  },
  summarize: {
    temperature: 0.3,
    system: `You are a message assistant for Arattai, a chat application.
The user has pasted a long piece of text. Summarize it for sending in chat.
- Condense into 1 to 3 sentences maximum.
- Keep only the most important points.
- Write in plain, natural chat language — not bullet points, not formal paragraphs.
- If the original is already short (under 30 words), return it as-is.
- Return ONLY the summarized text.
${BASE_RULES}`,
  },
  formal: {
    temperature: 0.2,
    system: `You are a message assistant for Arattai, a chat application.
The user wants to send this as a professional or formal message.
- Rewrite in a clear, respectful, professional tone.
- Suitable for work chats, client messages, or official communication.
- Correct all grammar and spelling.
- Remove slang, abbreviations, and informal language.
- Keep it concise — formal does not mean long.
- Return ONLY the formal message text.
${BASE_RULES}`,
  },
  casual: {
    temperature: 0.5,
    system: `You are a message assistant for Arattai, a chat application.
The user wants a relaxed, friendly version of their message.
- Rewrite in a warm, casual, conversational tone — like texting a friend.
- You may use natural contractions (I'm, it's, we'll).
- Keep it short and easy to read.
- Do not use formal vocabulary or stiff sentence structure.
- Return ONLY the casual message text.
${BASE_RULES}`,
  },
  translate: {
    temperature: 0.2,
    system: `You are a translation assistant for Arattai, a chat application.
The user wants to translate their message.
- If the input is in Tamil, translate to English.
- If the input is in English, translate to Tamil.
- If the input is mixed (Tanglish), translate the full meaning into clean Tamil or English — prefer the language that is more dominant in the input.
- Preserve the tone: casual input → casual translation, formal input → formal translation.
- Return ONLY the translated text. No notes, no alternatives, no explanations.
- Do not wrap the output in quotes.
- Never add greetings, sign-offs, or filler phrases.`,
  },
  fixCode: {
    temperature: 0.1,
    system: `You are a code formatting assistant for Arattai, a chat application.
The user's message contains a code snippet they want to clean up before sharing in chat.
- Fix indentation, spacing, and formatting only.
- Fix obvious syntax errors if they are clearly typos (missing bracket, semicolon, etc.).
- Do NOT change logic, variable names, or structure beyond formatting.
- Do NOT add comments or explanations.
- Return the cleaned code as plain text (no markdown fences, no backticks).
- If the input contains both text and code, clean the code portion and leave the text as-is.
- If there is no code in the input, return it unchanged.`,
  },
  shorten: {
    temperature: 0.3,
    system: `You are a message assistant for Arattai, a chat application.
The user's message is too long. Make it shorter without losing the point.
- Cut to the essential information only.
- Aim for roughly half the original length, or less.
- Keep the same tone as the original.
- Do not add new information.
- Return ONLY the shortened message text.
${BASE_RULES}`,
  },
  expand: {
    temperature: 0.5,
    system: `You are a message assistant for Arattai, a chat application.
The user has written something brief and wants it expanded into a fuller message.
- Flesh out the idea into a complete, clear message.
- Add natural context and detail that fits the user's intent — do not invent facts.
- Keep the tone matching the input: casual stays casual, formal stays formal.
- Do not over-expand — stop when the message is complete, not padded.
- Return ONLY the expanded message text.
${BASE_RULES}`,
  },
};

// ── Env loader ────────────────────────────────────────────────────────────
function loadEnv() {
  const candidates = [
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../../.env'),
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    const env = {};
    fs.readFileSync(p, 'utf8').split('\n').forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      const eq = line.indexOf('=');
      if (eq < 1) return;
      env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    });
    return env;
  }
  return {};
}

// ── HTTP helper ───────────────────────────────────────────────────────────
function httpsPost(hostname, urlPath, headers, bodyStr) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path: urlPath, method: 'POST', headers }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

// ── Provider calls ────────────────────────────────────────────────────────
async function callOpenAI(apiKey, messages, temperature = 0.3) {
  const body = JSON.stringify({ model: 'gpt-4o-mini', messages, temperature, max_tokens: 500 });
  const { status, body: resp } = await httpsPost(
    'api.openai.com',
    '/v1/chat/completions',
    { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`, 'Content-Length': Buffer.byteLength(body) },
    body,
  );
  if (status !== 200) throw new Error(`OpenAI ${status}: ${resp}`);
  return JSON.parse(resp).choices[0].message.content.trim();
}

async function callClaude(apiKey, messages, temperature = 0.3) {
  const systemMsg = messages.find(m => m.role === 'system');
  const chatMsgs  = messages.filter(m => m.role !== 'system');
  const payload   = { model: 'claude-sonnet-4-6', max_tokens: 500, messages: chatMsgs, temperature };
  if (systemMsg) payload.system = systemMsg.content;
  const body = JSON.stringify(payload);
  const { status, body: resp } = await httpsPost(
    'api.anthropic.com',
    '/v1/messages',
    { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(body) },
    body,
  );
  if (status !== 200) throw new Error(`Claude ${status}: ${resp}`);
  return JSON.parse(resp).content[0].text.trim();
}

// ── Shared middleware helpers ──────────────────────────────────────────────
function readBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => resolve(body));
  });
}

function getCredentials() {
  const env      = loadEnv();
  const apiKey   = process.env.AI_API_KEY  || env.AI_API_KEY  || '';
  const provider = (process.env.AI_PROVIDER || env.AI_PROVIDER || 'openai').toLowerCase();
  return { apiKey, provider };
}

async function callProvider(provider, apiKey, messages, temperature) {
  return provider === 'claude'
    ? callClaude(apiKey, messages, temperature)
    : callOpenAI(apiKey, messages, temperature);
}

// ── Express middleware ────────────────────────────────────────────────────
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {

  // NOTE: the AI handlers are registered BEFORE the catch-all /api proxy.
  // Express matches middleware in registration order, so /api/ai/* is served
  // here and everything else falls through to the Java backend proxy below.

  // POST /api/ai/chat — conversational AI (Arattai AI chat)
  app.use('/api/ai/chat', async (req, res) => {
    if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }
    if (req.method !== 'POST')    { res.writeHead(405); res.end(); return; }
    cors(res);
    res.setHeader('Content-Type', 'application/json');

    let parsed;
    try { parsed = JSON.parse(await readBody(req)); } catch {
      return void (res.writeHead(400), res.end(JSON.stringify({ error: 'Invalid JSON' })));
    }

    const { apiKey, provider } = getCredentials();
    if (!apiKey) return void (res.writeHead(500), res.end(JSON.stringify({ error: 'AI_API_KEY not set' })));

    try {
      const reply = await callProvider(provider, apiKey, parsed.messages, 0.7);
      res.writeHead(200);
      res.end(JSON.stringify({ reply }));
    } catch (e) {
      console.error('[AI chat proxy]', e.message);
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
  });

  // POST /api/ai/transform — text transform (Polish, Formal, Translate, etc.)
  app.use('/api/ai/transform', async (req, res) => {
    if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }
    if (req.method !== 'POST')    { res.writeHead(405); res.end(); return; }
    cors(res);
    res.setHeader('Content-Type', 'application/json');

    let parsed;
    try { parsed = JSON.parse(await readBody(req)); } catch {
      return void (res.writeHead(400), res.end(JSON.stringify({ error: 'Invalid JSON' })));
    }

    const { text, mode } = parsed;
    if (!text || !text.trim()) {
      return void (res.writeHead(400), res.end(JSON.stringify({ error: 'text is required' })));
    }

    const modeConfig = TRANSFORM_PROMPTS[mode] || TRANSFORM_PROMPTS.polish;
    const { apiKey, provider } = getCredentials();
    if (!apiKey) return void (res.writeHead(500), res.end(JSON.stringify({ error: 'AI_API_KEY not set' })));

    const messages = [
      { role: 'system', content: modeConfig.system },
      { role: 'user',   content: text },
    ];

    try {
      const result = await callProvider(provider, apiKey, messages, modeConfig.temperature);
      res.writeHead(200);
      res.end(JSON.stringify({ result }));
    } catch (e) {
      console.error('[AI transform proxy]', e.message);
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    }
  });

  // Proxy every other /api/* call to the Java backend. Registered last so the
  // AI handlers above take precedence. Same-origin for the browser → no CORS.
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:8080',
      changeOrigin: true,
    })
  );
};

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}