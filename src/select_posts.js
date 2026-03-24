const fs = require('fs');
const path = require('path');

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8').trim();
  if (!content) return [];
  return content.split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

function themeWords(theme) {
  return String(theme || '')
    .toLowerCase()
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function scorePost(post, theme) {
  const text = String(post.text || '').toLowerCase();
  const words = themeWords(theme);
  const themeScore = words.length
    ? words.reduce((acc, word) => acc + (text.includes(word) ? 1 : 0), 0) / words.length
    : 0;

  const engagementScore =
    Number(post.metrics?.like || 0) * 1.0 +
    Number(post.metrics?.repost || 0) * 1.5 +
    Number(post.metrics?.reply || 0) * 1.2 +
    Number(post.metrics?.view || 0) / 1000;

  const createdAt = new Date(post.created_at || 0).getTime() || 0;
  const recencyScore = createdAt / 1e13;
  const lengthScore = Math.min((text.length || 0) / 280, 1);
  const finalScore = themeScore * 100 + engagementScore * 0.01 + recencyScore + lengthScore;

  return { themeScore, engagementScore, recencyScore, lengthScore, finalScore };
}

function classifySupportRole(post) {
  const text = String(post.text || '').toLowerCase();
  const hasNumbers = /\b\d+(?:\.\d+)?\s*(k|m|b|t|%|x|tokens|day|days|year|years|\$)?\b/i.test(text);
  const hasComparison = /more|less|better|worse|than|upgrade|faster|slower|versus|vs\.?/i.test(text);
  const hasWorkflow = /workflow|agent|subagent|tool|build|api|product|ship|deploy|use/i.test(text);

  if (hasNumbers) return 'evidence';
  if (hasComparison) return 'comparison';
  if (hasWorkflow) return 'example';
  return 'support';
}

function dedupeByTweetId(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    if (!item?.tweet_id || seen.has(item.tweet_id)) continue;
    seen.add(item.tweet_id);
    out.push(item);
  }
  return out;
}

function selectPostBundle({ baseDir, accounts, theme, topK = 4, originalOnly = true }) {
  const candidates = [];

  for (const account of accounts) {
    const filePath = path.join(baseDir, 'data', 'x', 'accounts', account, 'posts.jsonl');
    const posts = readJsonl(filePath);

    for (const post of posts) {
      if (originalOnly && post.content_type !== 'original') continue;
      if (!String(post.text || '').trim()) continue;
      const scores = scorePost(post, theme);
      candidates.push({ ...post, account, scores });
    }
  }

  const ranked = dedupeByTweetId(candidates).sort((a, b) => b.scores.finalScore - a.scores.finalScore);
  const corePost = ranked[0] || null;

  const supportingPosts = ranked
    .slice(1)
    .map((post) => ({
      ...post,
      support_role: classifySupportRole(post)
    }))
    .slice(0, Math.max(topK - 1, 0));

  return {
    selection_id: `sel-${Date.now()}`,
    theme,
    bundle_strategy: 'one-core-plus-supporting-posts',
    selection_strategy: {
      original_only: originalOnly,
      top_k: topK,
      sort_by: ['theme_score', 'engagement_score', 'recency_score', 'length_score']
    },
    bundle: {
      core_post: corePost
        ? {
            tweet_id: corePost.tweet_id,
            account: corePost.account,
            url: corePost.url,
            text: corePost.text,
            reason: '主观点最完整，最适合作为整篇笔记切入点',
            scores: corePost.scores
          }
        : null,
      supporting_posts: supportingPosts.map((post) => ({
        tweet_id: post.tweet_id,
        account: post.account,
        url: post.url,
        text: post.text,
        support_role: post.support_role,
        reason:
          post.support_role === 'evidence'
            ? '补数字和事实'
            : post.support_role === 'comparison'
              ? '补对比和变化'
              : post.support_role === 'example'
                ? '补案例和工作流视角'
                : '补充主题相关讨论',
        scores: post.scores
      }))
    },
    candidate_count: ranked.length,
    created_at: new Date().toISOString()
  };
}

module.exports = {
  readJsonl,
  scorePost,
  selectPostBundle
};
