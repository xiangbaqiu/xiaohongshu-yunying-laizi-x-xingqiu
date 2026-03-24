#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const accountsRoot = path.join(projectRoot, 'data', 'x', 'accounts');
const outputPath = path.join(projectRoot, 'data', 'dashboard', 'dashboard-data.json');
const notesDraftsRoot = path.join(projectRoot, 'notes', 'drafts');
const notesBriefsRoot = path.join(projectRoot, 'notes', 'briefs');
const notesBundlesRoot = path.join(projectRoot, 'notes', 'bundles');
const notesRunsRoot = path.join(projectRoot, 'notes', 'runs');

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

function safeNum(n) {
  return typeof n === 'number' && !Number.isNaN(n) ? n : 0;
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => readJson(path.join(dir, name)))
    .filter(Boolean)
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
}

function indexById(items, keyResolver) {
  const map = new Map();
  for (const item of items) {
    const key = keyResolver(item);
    if (key) map.set(key, item);
  }
  return map;
}

function summarizeAccount(handle, posts) {
  const originals = posts.filter((p) => p.content_type === 'original');
  const basis = originals.length ? originals : posts;
  const sorted = [...basis].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  const totals = sorted.reduce(
    (acc, post) => {
      acc.reply += safeNum(post.metrics?.reply);
      acc.repost += safeNum(post.metrics?.repost);
      acc.like += safeNum(post.metrics?.like);
      acc.view += safeNum(post.metrics?.view);
      return acc;
    },
    { reply: 0, repost: 0, like: 0, view: 0 }
  );

  const topPost = [...sorted].sort((a, b) => safeNum(b.metrics?.like) - safeNum(a.metrics?.like))[0] || null;

  return {
    handle,
    post_count: posts.length,
    original_count: posts.filter((p) => p.content_type === 'original').length,
    repost_count: posts.filter((p) => p.content_type === 'repost').length,
    quote_count: posts.filter((p) => p.content_type === 'quote').length,
    reply_count: posts.filter((p) => p.content_type === 'reply').length,
    latest_post_at: sorted[0]?.created_at || null,
    avg_reply: sorted.length ? Math.round(totals.reply / sorted.length) : 0,
    avg_repost: sorted.length ? Math.round(totals.repost / sorted.length) : 0,
    avg_like: sorted.length ? Math.round(totals.like / sorted.length) : 0,
    avg_view: sorted.length ? Math.round(totals.view / sorted.length) : 0,
    top_post: topPost
      ? {
          tweet_id: topPost.tweet_id,
          text: topPost.text,
          url: topPost.url,
          like: safeNum(topPost.metrics?.like)
        }
      : null
  };
}

function buildNoteLineage(draft, briefsById, bundlesById, runsByDraftId) {
  const briefId = draft.brief_id || draft.source_brief_id || null;
  const bundleId = draft.bundle_id || draft.source_bundle_id || draft.source_selection_id || null;
  const draftId = draft.draft_id || draft.note_id || null;
  const brief = briefId ? briefsById.get(briefId) || null : null;
  const bundle = bundleId ? bundlesById.get(bundleId) || null : null;
  const run = draftId ? runsByDraftId.get(draftId) || null : null;

  return {
    draft_id: draftId,
    brief_id: briefId,
    bundle_id: bundleId,
    run_id: run?.run_id || null,
    theme: draft.theme,
    style: draft.style,
    angle: draft.angle,
    title_options: draft.title_options || [],
    cover_text_options: draft.cover_text_options || [],
    body_markdown: draft.body_markdown || '',
    hashtags: draft.hashtags || [],
    source_posts: draft.source_posts || [],
    status: draft.status || 'draft',
    created_at: draft.created_at,
    source_post_count: (draft.source_posts || []).length,
    bundle_preview: bundle
      ? {
          core_post: bundle.bundle?.core_post
            ? {
                tweet_id: bundle.bundle.core_post.tweet_id,
                account: bundle.bundle.core_post.account,
                text: bundle.bundle.core_post.text,
                url: bundle.bundle.core_post.url
              }
            : null,
          supporting_count: (bundle.bundle?.supporting_posts || []).length,
          candidate_count: bundle.candidate_count || 0
        }
      : null,
    brief_preview: brief
      ? {
          core_angle: brief.core_angle,
          final_takeaway: brief.narrative_structure?.final_takeaway || null,
          supporting_points_count: (brief.narrative_structure?.supporting_points || []).length,
          claims_count: (brief.claims || []).length
        }
      : null,
    run_preview: run
      ? {
          run_id: run.run_id,
          created_at: run.created_at,
          dashboard_ok: run.dashboard?.ok ?? null,
          dashboard_attempted: run.dashboard?.attempted ?? null
        }
      : null
  };
}

function uniqueValues(items, key) {
  return [...new Set(items.map((item) => item[key]).filter(Boolean))].sort();
}

function main() {
  const handles = fs.existsSync(accountsRoot)
    ? fs.readdirSync(accountsRoot).filter((name) => fs.statSync(path.join(accountsRoot, name)).isDirectory())
    : [];

  const allPosts = [];
  const accounts = [];

  for (const handle of handles) {
    const postsPath = path.join(accountsRoot, handle, 'posts.jsonl');
    const posts = readJsonl(postsPath).map((post) => ({ ...post, account: handle }));
    allPosts.push(...posts);
    accounts.push(summarizeAccount(handle, posts));
  }

  const sortedPosts = allPosts.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  const noteDrafts = readJsonDir(notesDraftsRoot);
  const noteBriefs = readJsonDir(notesBriefsRoot);
  const noteBundles = readJsonDir(notesBundlesRoot);
  const noteRuns = readJsonDir(notesRunsRoot);
  const briefsById = indexById(noteBriefs, (item) => item.brief_id);
  const bundlesById = indexById(noteBundles, (item) => item.bundle_id || item.selection_id);
  const runsByDraftId = indexById(noteRuns, (item) => item.draft_id);
  const originalsOnly = sortedPosts.filter((p) => p.content_type === 'original');
  const contentTypeCounts = sortedPosts.reduce((acc, post) => {
    const key = post.content_type || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const todayPosts = sortedPosts.filter((p) => (p.created_at || '').slice(0, 10) === todayStr);
  const topLiked = [...sortedPosts].sort((a, b) => safeNum(b.metrics?.like) - safeNum(a.metrics?.like)).slice(0, 20);
  const topViewed = [...sortedPosts].sort((a, b) => safeNum(b.metrics?.view) - safeNum(a.metrics?.view)).slice(0, 20);
  const notes = noteDrafts.map((draft) => buildNoteLineage(draft, briefsById, bundlesById, runsByDraftId));

  const dashboard = {
    generated_at: new Date().toISOString(),
    overview: {
      accounts_total: accounts.length,
      posts_total: sortedPosts.length,
      originals_total: originalsOnly.length,
      notes_total: notes.length,
      posts_today: todayPosts.length,
      latest_post_at: sortedPosts[0]?.created_at || null,
      latest_note_at: notes[0]?.created_at || null,
      content_type_counts: contentTypeCounts
    },
    filters_meta: {
      note_themes: uniqueValues(notes, 'theme'),
      note_styles: uniqueValues(notes, 'style')
    },
    accounts,
    top_lists: {
      liked: topLiked,
      viewed: topViewed
    },
    posts: sortedPosts,
    notes
  };

  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, JSON.stringify(dashboard, null, 2) + '\n', 'utf8');
  console.log(outputPath);
}

main();
