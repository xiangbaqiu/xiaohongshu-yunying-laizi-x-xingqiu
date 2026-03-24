#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { runFromRawBatch } = require('./pipeline');

const OPENCLAW_CDP = process.env.OPENCLAW_CDP || 'http://127.0.0.1:18800';
let browserSessionPromise = null;

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cdp(method, params = {}, sessionId) {
  const body = { id: Date.now() + Math.floor(Math.random() * 1000), method, params };
  const url = sessionId ? `${OPENCLAW_CDP}/json/protocol` : `${OPENCLAW_CDP}/json/protocol`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(sessionId ? { 'X-Session-Id': sessionId } : {})
    },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function getBrowserWsUrl() {
  const res = await fetch(`${OPENCLAW_CDP}/json/version`);
  const version = await res.json();
  return version.webSocketDebuggerUrl;
}

async function getWsDebuggerUrl(targetId) {
  const res = await fetch(`${OPENCLAW_CDP}/json/list`);
  const tabs = await res.json();
  const tab = tabs.find((t) => t.id === targetId);
  if (!tab) throw new Error(`tab not found: ${targetId}`);
  return tab.webSocketDebuggerUrl;
}

async function connectRawWs(wsUrl) {
  const WebSocketImpl = globalThis.WebSocket || require('ws');
  const ws = new WebSocketImpl(wsUrl);
  let id = 0;
  const pending = new Map();

  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  });

  const send = (method, params = {}) => {
    const msgId = ++id;
    return new Promise((resolve, reject) => {
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  };

  return { ws, send };
}

async function connectSession(targetId) {
  const wsUrl = await getWsDebuggerUrl(targetId);
  return connectRawWs(wsUrl);
}

async function getBrowserSession() {
  if (!browserSessionPromise) {
    browserSessionPromise = getBrowserWsUrl().then((wsUrl) => connectRawWs(wsUrl));
  }
  return browserSessionPromise;
}

function extractorSource(limit) {
  return `(() => {
    const anchors = Array.from(document.querySelectorAll('a[href*="/status/"]'));
    const items = [];
    const seen = new Set();
    for (const a of anchors) {
      const href = a.getAttribute('href') || '';
      const match = href.match(/^\\/(.+?)\\/status\\/(\\d+)/);
      if (!match) continue;
      const authorHandle = match[1];
      const tweetId = match[2];
      if (seen.has(tweetId)) continue;
      const article = a.closest('article');
      if (!article) continue;
      seen.add(tweetId);
      const timeEl = article.querySelector('time');
      const text = Array.from(article.querySelectorAll('[data-testid="tweetText"]')).map(n => n.innerText.trim()).filter(Boolean).join('\\n');
      const mediaUrls = Array.from(article.querySelectorAll('img[src], video[poster]')).map(el => el.getAttribute('src') || el.getAttribute('poster')).filter(Boolean).filter(src => /twimg\\.com|pbs\\.twimg\\.com/.test(src));
      const metricHints = Array.from(article.querySelectorAll('[role="group"] [aria-label], [data-testid$="count"]')).map(el => el.getAttribute('aria-label') || el.textContent || '').map(s => s.trim()).filter(Boolean);
      items.push({
        tweet_id: tweetId,
        url: new URL(href, location.origin).toString(),
        text,
        created_at: timeEl?.getAttribute('datetime') || null,
        author_handle: authorHandle,
        media_urls: Array.from(new Set(mediaUrls)),
        metric_hints: metricHints,
        article_text: article.innerText.slice(0, 2000)
      });
      if (items.length >= ${limit}) break;
    }
    return { extracted_at: new Date().toISOString(), url: location.href, count: items.length, items };
  })()`;
}

async function autoCollectAccount(account, countPerAccount = 20, maxScrollRounds = 6, opts = {}) {
  const targetId = await openTab(`https://x.com/${account}`);
  const session = await connectSession(targetId);
  try {
    await session.send('Page.enable');
    await session.send('Runtime.enable');
    await delay(3500);

    let best = { extracted_at: new Date().toISOString(), url: `https://x.com/${account}`, count: 0, items: [] };
    const seen = new Set();

    for (let round = 0; round < maxScrollRounds; round++) {
      const result = await session.send('Runtime.evaluate', {
        expression: extractorSource(countPerAccount * 2),
        returnByValue: true,
        awaitPromise: true
      });
      const batch = result?.result?.value || { items: [] };
      const merged = [];
      for (const item of [...best.items, ...(batch.items || [])]) {
        if (!item?.tweet_id || seen.has(item.tweet_id)) continue;
        seen.add(item.tweet_id);
        merged.push(item);
      }
      best = {
        extracted_at: batch.extracted_at || new Date().toISOString(),
        url: batch.url || `https://x.com/${account}`,
        count: merged.length,
        items: merged.slice(0, countPerAccount)
      };
      if (best.items.length >= countPerAccount) break;
      await session.send('Runtime.evaluate', {
        expression: 'window.scrollBy(0, Math.floor(window.innerHeight * 1.5)); true;',
        returnByValue: true
      });
      await delay(2200);
    }

    const sampleDir = path.resolve(__dirname, '..', 'samples', 'raw');
    fs.mkdirSync(sampleDir, { recursive: true });
    const samplePath = path.join(sampleDir, `${account}-raw.json`);
    fs.writeFileSync(samplePath, JSON.stringify(best, null, 2) + '\n', 'utf8');

    const pipelineResult = runFromRawBatch(samplePath, {
      account,
      version: 'mvp-v0.4.1-auto',
      mode: opts.mode || 'append',
      latestLimit: opts.latestLimit || countPerAccount
    });
    return { account, samplePath, ...pipelineResult };
  } finally {
    session.ws.close();
  }
}

async function openTab(url) {
  const browser = await getBrowserSession();
  const result = await browser.send('Target.createTarget', { url });
  return result.targetId;
}

async function rebuildDashboard() {
  const { execFileSync } = require('child_process');
  execFileSync(process.execPath, [path.resolve(__dirname, '..', 'scripts', 'build_dashboard_data.js')], {
    stdio: 'inherit'
  });
}

async function main() {
  const configPath = process.argv[2] || path.resolve(__dirname, '..', 'collect.config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const accounts = config.accounts || [];
  const countPerAccount = Number(config.count_per_account || 10);
  const maxScrollRounds = Number(config.max_scroll_rounds || 6);
  const mode = config.mode || 'replace_latest';

  const results = [];
  for (const account of accounts) {
    const result = await autoCollectAccount(account, countPerAccount, maxScrollRounds, {
      mode,
      latestLimit: countPerAccount
    });
    results.push(result);
  }

  await rebuildDashboard();
  console.log(JSON.stringify({ ok: true, accounts, count_per_account: countPerAccount, mode, results }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
