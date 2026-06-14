import { createServer } from 'node:http';
import { URL } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvFile() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const PORT = Number(process.env.PORT || 8787);
const NOTION_CLIENT_ID = process.env.NOTION_OAUTH_CLIENT_ID || '';
const NOTION_CLIENT_SECRET = process.env.NOTION_OAUTH_CLIENT_SECRET || '';
const NOTION_VERSION = process.env.NOTION_API_VERSION || '2026-03-11';
const ALLOWED_ORIGIN = process.env.NOTION_OAUTH_ALLOWED_ORIGIN || '*';

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, statusCode, payload) {
  setCorsHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

async function handleExchange(req, res) {
  if (!NOTION_CLIENT_ID || !NOTION_CLIENT_SECRET) {
    sendJson(res, 500, {
      message: 'Server missing NOTION_OAUTH_CLIENT_ID or NOTION_OAUTH_CLIENT_SECRET',
    });
    return;
  }

  let body;
  try {
    const raw = await readBody(req);
    body = JSON.parse(raw || '{}');
  } catch (error) {
    sendJson(res, 400, { message: 'Invalid JSON body' });
    return;
  }

  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const redirectUri = typeof body.redirect_uri === 'string' ? body.redirect_uri.trim() : '';

  if (!code) {
    sendJson(res, 400, { message: 'Missing authorization code' });
    return;
  }

  if (!redirectUri) {
    sendJson(res, 400, { message: 'Missing redirect_uri' });
    return;
  }

  const basic = Buffer.from(`${NOTION_CLIENT_ID}:${NOTION_CLIENT_SECRET}`).toString('base64');

  try {
    const notionResponse = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION,
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    const payload = await notionResponse.json();

    if (!notionResponse.ok) {
      sendJson(res, notionResponse.status, {
        error: payload?.error || 'oauth_exchange_failed',
        message: payload?.message || 'Notion token exchange failed',
        request_id: payload?.request_id,
      });
      return;
    }

    sendJson(res, 200, {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      workspace_name: payload.workspace_name,
      workspace_id: payload.workspace_id,
      workspace_icon: payload.workspace_icon,
      bot_id: payload.bot_id,
      duplicated_template_id: payload.duplicated_template_id,
    });
  } catch (error) {
    sendJson(res, 500, {
      message: error instanceof Error ? error.message : 'Unexpected token exchange error',
    });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, {
      ok: true,
      service: 'notion-oauth-exchange',
      redirect_example: 'ignite://oauth/notion',
      ready: Boolean(NOTION_CLIENT_ID && NOTION_CLIENT_SECRET),
      has_client_id: Boolean(NOTION_CLIENT_ID),
      has_client_secret: Boolean(NOTION_CLIENT_SECRET),
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/notion/oauth/exchange') {
    await handleExchange(req, res);
    return;
  }

  sendJson(res, 404, { message: 'Not Found' });
});

server.listen(PORT, () => {
  console.log(`[notion-oauth] listening on http://localhost:${PORT}`);
  console.log('[notion-oauth] POST /api/notion/oauth/exchange');
  console.log('[notion-oauth] GET  /health');
});
