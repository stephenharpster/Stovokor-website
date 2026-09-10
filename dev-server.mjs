// Local stand-in for Cloudflare Pages: static files + POST /api/contact.
//   node dev-server.mjs
// Submissions are saved to .local/contact-inbox.json. Live mail is Cloudflare
// Email Sending after the site is published — this server does not send email.

import http from 'node:http';
import fs from 'node:fs/promises';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildEmail, readContactFields } from './functions/api/contact.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8787;
const INBOX = path.join(ROOT, '.local', 'contact-inbox.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv(path.join(ROOT, '.dev.vars'));

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    ...headers,
  });
  res.end(payload);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function saveInbox(entry) {
  await fs.mkdir(path.dirname(INBOX), { recursive: true });
  let existing = [];
  try {
    existing = JSON.parse(await fs.readFile(INBOX, 'utf8'));
    if (!Array.isArray(existing)) existing = [];
  } catch {
    existing = [];
  }
  existing.push(entry);
  await fs.writeFile(INBOX, JSON.stringify(existing, null, 2));
}

async function handleContact(req, res) {
  if (req.method === 'GET') {
    send(res, 405, 'Method Not Allowed', { Allow: 'POST' });
    return;
  }
  if (req.method !== 'POST') {
    send(res, 405, 'Method Not Allowed', { Allow: 'POST' });
    return;
  }

  const contentType = req.headers['content-type'] || '';
  if (
    !contentType.includes('application/x-www-form-urlencoded') &&
    !contentType.includes('multipart/form-data')
  ) {
    send(res, 415, { ok: false, error: 'Unsupported content type.' });
    return;
  }

  let form;
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(await readBody(req));
    form = { get: (key) => params.get(key) };
  } else {
    send(res, 415, { ok: false, error: 'Use urlencoded form bodies in local dev.' });
    return;
  }

  const parsed = readContactFields(form);
  if (parsed.honeypot) {
    send(res, 200, { ok: true });
    return;
  }
  if (parsed.error) {
    send(res, parsed.status, { ok: false, error: parsed.error });
    return;
  }

  const mail = buildEmail(parsed.fields);
  const entry = {
    receivedAt: new Date().toISOString(),
    ...parsed.fields,
    emailSent: false,
    delivery: 'local inbox — Cloudflare Email Sending is used after publish',
    subject: mail.subject,
  };
  await saveInbox(entry);
  console.log(`[contact] ${parsed.fields.name} <${parsed.fields.email}> — saved to .local/contact-inbox.json`);
  send(res, 200, { ok: true, emailed: false, stored: true });
}

function safeFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const rel = decoded === '/' ? '/index.html' : decoded;
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) return null;
  return file;
}

function handleStatic(req, res) {
  const file = safeFile(new URL(req.url, `http://127.0.0.1:${PORT}`).pathname);
  if (!file) {
    send(res, 403, 'Forbidden');
    return;
  }
  fs.stat(file).then((stat) => {
    if (!stat.isFile()) {
      send(res, 404, 'Not found');
      return;
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    createReadStream(file).pipe(res);
  }).catch(() => send(res, 404, 'Not found'));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/api/contact') {
    handleContact(req, res).catch((err) => {
      console.error(err);
      send(res, 500, { ok: false, error: 'Server error.' });
    });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'Method Not Allowed');
    return;
  }
  handleStatic(req, res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Stovokor site → http://127.0.0.1:${PORT}`);
  console.log('Contact form saves to .local/contact-inbox.json (no outbound email in local dev).');
});
