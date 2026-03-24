const fs = require('fs');
const path = require('path');

function parseMetricCount(input) {
  if (input == null) return null;
  const text = String(input).trim().replace(/,/g, '').toUpperCase();
  const metricMatch = text.match(/^([0-9]*\.?[0-9]+)([KMB])?$/);
  if (metricMatch) {
    const base = Number(metricMatch[1]);
    const mult = metricMatch[2] === 'K' ? 1e3 : metricMatch[2] === 'M' ? 1e6 : metricMatch[2] === 'B' ? 1e9 : 1;
    return Math.round(base * mult);
  }
  const digits = text.replace(/[^0-9]/g, '');
  return digits ? Number(digits) : null;
}

function parseMetrics(metricHints = [], articleText = '') {
  const metrics = { reply: null, repost: null, like: null, view: null };

  for (const hint of metricHints) {
    const normalized = String(hint).trim();
    const lower = normalized.toLowerCase();
    const countText = normalized.split(/\s+/)[0];
    const count = parseMetricCount(countText);
    if (lower.includes('repl')) metrics.reply = count;
    else if (lower.includes('repost')) metrics.repost = count;
    else if (lower.includes('like')) metrics.like = count;
    else if (lower.includes('view')) metrics.view = count;
  }

  if (Object.values(metrics).every((v) => v == null) && articleText) {
    const lines = articleText.split('\n').map((s) => s.trim()).filter(Boolean);
    const tail = lines.slice(-4);
    if (tail.length === 4) {
      metrics.reply = parseMetricCount(tail[0]);
      metrics.repost = parseMetricCount(tail[1]);
      metrics.like = parseMetricCount(tail[2]);
      metrics.view = parseMetricCount(tail[3]);
    }
  }

  return metrics;
}

function detectContentType(raw, timelineOwner) {
  const articleText = String(raw?.article_text || '').toLowerCase();
  const url = String(raw?.url || '');
  const sourceAuthorHandle = raw?.author_handle || null;
  const owner = timelineOwner || null;
  const isReply = /\/status\/\d+/.test(url) && /(^|\n)replying to($|\n)/i.test(raw?.article_text || '');
  const isReposted = articleText.includes(' reposted');
  const isQuote = articleText.includes('\nquote\n') || articleText.includes('quote\n');

  let contentType = 'original';
  if (isReply) contentType = 'reply';
  else if (isReposted && isQuote) contentType = 'quote';
  else if (isReposted) contentType = 'repost';
  else if (isQuote && owner && sourceAuthorHandle && sourceAuthorHandle !== owner) contentType = 'quote';
  else if (owner && sourceAuthorHandle && sourceAuthorHandle !== owner) contentType = 'quote';

  return {
    contentType,
    sourceAuthorHandle,
    displayAuthorHandle: owner || sourceAuthorHandle,
    timelineOwner: owner,
    isPinned: articleText.includes('pinned')
  };
}

function normalizeRawItem(raw, fetchedAt, version = 'mvp-v0.1', opts = {}) {
  if (!raw || !raw.tweet_id || !raw.url || !/\/status\//.test(raw.url)) return null;
  const typeMeta = detectContentType(raw, opts.timelineOwner);
  return {
    platform: 'x',
    author_handle: raw.author_handle || null,
    timeline_owner: typeMeta.timelineOwner,
    display_author_handle: typeMeta.displayAuthorHandle,
    source_author_handle: typeMeta.sourceAuthorHandle,
    content_type: typeMeta.contentType,
    is_pinned: typeMeta.isPinned,
    tweet_id: String(raw.tweet_id),
    url: raw.url,
    text: raw.text || '',
    created_at: raw.created_at || null,
    lang: null,
    metrics: parseMetrics(raw.metric_hints, raw.article_text),
    media_urls: Array.isArray(raw.media_urls) ? Array.from(new Set(raw.media_urls)) : [],
    fetched_at: fetchedAt,
    source: {
      method: 'openclaw-browser',
      version
    }
  };
}

function dedupeByTweetId(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    if (!item || !item.tweet_id || seen.has(item.tweet_id)) continue;
    seen.add(item.tweet_id);
    out.push(item);
  }
  return out;
}

function sortPostsNewestFirst(items) {
  return [...items].sort((a, b) => new Date(b.created_at || b.fetched_at || 0) - new Date(a.created_at || a.fetched_at || 0));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8').trim();
  if (!content) return [];
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function appendJsonl(filePath, items) {
  if (!items.length) return;
  ensureDir(path.dirname(filePath));
  const lines = items.map((item) => JSON.stringify(item)).join('\n') + '\n';
  fs.appendFileSync(filePath, lines, 'utf8');
}

function writeJsonl(filePath, items) {
  ensureDir(path.dirname(filePath));
  const lines = items.length ? items.map((item) => JSON.stringify(item)).join('\n') + '\n' : '';
  fs.writeFileSync(filePath, lines, 'utf8');
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function mergePosts(existingPosts, newPosts, opts = {}) {
  const mode = opts.mode || 'append';
  const latestLimit = Number(opts.latestLimit || 0);

  let merged;
  if (mode === 'replace_latest') {
    merged = dedupeByTweetId(sortPostsNewestFirst(newPosts));
  } else {
    merged = dedupeByTweetId(sortPostsNewestFirst([...(existingPosts || []), ...(newPosts || [])]));
  }

  if (latestLimit > 0) {
    merged = merged.slice(0, latestLimit);
  }
  return merged;
}

function runFromRawBatch(rawBatchPath, opts = {}) {
  const rawBatch = JSON.parse(fs.readFileSync(rawBatchPath, 'utf8'));
  const rawItems = Array.isArray(rawBatch.items) ? rawBatch.items : [];
  const fetchedAt = opts.fetchedAt || new Date().toISOString();
  const runId = (opts.runId || fetchedAt).replace(/[:]/g, '-');
  const account = opts.account || rawItems[0]?.author_handle || 'unknown';
  const baseDir = opts.baseDir || path.resolve(__dirname, '..');

  const normalized = dedupeByTweetId(
    rawItems.map((item) => normalizeRawItem(item, fetchedAt, opts.version, { timelineOwner: account })).filter(Boolean)
  );

  const accountDir = path.join(baseDir, 'data', 'x', 'accounts', account);
  const rawTarget = path.join(accountDir, 'raw-batches', `${runId}.json`);
  const postsTarget = path.join(accountDir, 'posts.jsonl');
  const stateTarget = path.join(accountDir, 'state.json');
  const summaryTarget = path.join(baseDir, 'data', 'runs', runId, 'summary.json');

  writeJson(rawTarget, rawBatch);

  const existingPosts = readJsonl(postsTarget);
  const finalPosts = mergePosts(existingPosts, normalized, {
    mode: opts.mode || 'append',
    latestLimit: opts.latestLimit || 0
  });
  writeJsonl(postsTarget, finalPosts);

  const state = {
    account,
    last_run_at: fetchedAt,
    last_status: normalized.length ? 'success' : 'empty',
    last_post_count: normalized.length,
    stored_post_count: finalPosts.length,
    mode: opts.mode || 'append',
    latest_limit: Number(opts.latestLimit || 0) || null,
    latest_tweet_id_seen: finalPosts[0]?.tweet_id || null
  };
  writeJson(stateTarget, state);

  const summary = {
    run_id: runId,
    started_at: fetchedAt,
    ended_at: new Date().toISOString(),
    accounts_total: 1,
    accounts_succeeded: normalized.length ? 1 : 0,
    accounts_failed: normalized.length ? 0 : 1,
    results: [
      {
        account,
        raw_items: rawItems.length,
        normalized_items: normalized.length,
        written_items: finalPosts.length,
        mode: opts.mode || 'append',
        latest_limit: Number(opts.latestLimit || 0) || null,
        status: normalized.length ? 'success' : 'empty'
      }
    ]
  };
  writeJson(summaryTarget, summary);

  return {
    runId,
    account,
    rawCount: rawItems.length,
    normalizedCount: normalized.length,
    storedCount: finalPosts.length,
    paths: {
      rawTarget,
      postsTarget,
      stateTarget,
      summaryTarget
    }
  };
}

module.exports = {
  parseMetricCount,
  parseMetrics,
  detectContentType,
  normalizeRawItem,
  dedupeByTweetId,
  sortPostsNewestFirst,
  readJsonl,
  mergePosts,
  runFromRawBatch
};
