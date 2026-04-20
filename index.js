#!/usr/bin/env node
/**
 * HAP MCP Daily Token Proxy
 * Fetches a fresh token each day and caches it until 23:59.
 * Usage: node index.js <account_id> <key>
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const ACCOUNT_ID = process.argv[2] || process.env.MINGDAO_ACCOUNT_ID;
const KEY = process.argv[3] || process.env.MINGDAO_KEY;

if (!ACCOUNT_ID || !KEY) {
  process.stderr.write('Usage: node index.js <account_id> <key>\n');
  process.exit(1);
}

const CACHE_FILE = path.join(os.homedir(), '.cache', 'mingdao-mcp-token.json');

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function readCachedToken() {
  try {
    const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    if (cache.date === todayStr() && cache.token) return cache.token;
  } catch {}
  return null;
}

function writeCachedToken(token) {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ token, date: todayStr() }));
  } catch (e) {
    process.stderr.write('Cache write error: ' + e.message + '\n');
  }
}

function fetchToken() {
  return new Promise((resolve, reject) => {
    const body = `account_id=${encodeURIComponent(ACCOUNT_ID)}&key=${encodeURIComponent(KEY)}`;
    const req = https.request({
      hostname: 'api.mingdao.com',
      path: '/workflow/hooks/NjlkYzQ5NGIwMzM0NzkwYjg4MWY4NTk5',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (!json.token) { reject(new Error('No token in response: ' + data)); return; }
          resolve(json.token);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function getToken() {
  const cached = readCachedToken();
  if (cached) return cached;
  const token = await fetchToken();
  writeCachedToken(token);
  return token;
}

function callMcp(token, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const req = https.request({
      hostname: 'api2.mingdao.com',
      path: `/mcp?Authorization=Bearer%20${encodeURIComponent(token)}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const ct = res.headers['content-type'] || '';
        if (ct.includes('text/event-stream')) {
          for (const line of data.split('\n')) {
            if (line.startsWith('data: ')) {
              try { resolve(JSON.parse(line.slice(6))); return; } catch {}
            }
          }
          reject(new Error('No valid SSE data: ' + data));
        } else {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Invalid JSON: ' + data)); }
        }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });

rl.on('line', async (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  const isNotification = msg && msg.id === undefined;
  try {
    const token = await getToken();
    const response = await callMcp(token, msg);
    if (isNotification) return;
    process.stdout.write(JSON.stringify(response) + '\n');
  } catch (err) {
    if (isNotification) {
      process.stderr.write('Notification error: ' + err.message + '\n');
      return;
    }
    process.stdout.write(JSON.stringify({
      jsonrpc: '2.0',
      id: msg?.id ?? null,
      error: { code: -32603, message: err.message }
    }) + '\n');
  }
});
