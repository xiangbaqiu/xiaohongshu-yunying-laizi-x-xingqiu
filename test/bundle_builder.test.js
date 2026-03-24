const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildBundle } = require('../src/bundle_builder');

function makeTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'xhs-bundle-test-'));
}

function writeJsonl(filePath, rows) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, rows.map((row) => JSON.stringify(row)).join('\n') + '\n', 'utf8');
}

test('buildBundle picks a core post, dedupes, and respects top_k', () => {
  const baseDir = makeTempProject();
  writeJsonl(path.join(baseDir, 'data/x/accounts/sama/posts.jsonl'), [
    {
      tweet_id: '1', text: 'AI coding is changing fast', url: 'https://x.com/sama/1',
      created_at: '2026-03-23T10:00:00.000Z', content_type: 'original', metrics: { like: 100, repost: 20, reply: 5, view: 1000 }
    },
    {
      tweet_id: '2', text: 'workflow and agents matter', url: 'https://x.com/sama/2',
      created_at: '2026-03-23T11:00:00.000Z', content_type: 'original', metrics: { like: 50, repost: 10, reply: 2, view: 500 }
    }
  ]);
  writeJsonl(path.join(baseDir, 'data/x/accounts/elonmusk/posts.jsonl'), [
    {
      tweet_id: '2', text: 'workflow and agents matter', url: 'https://x.com/elon/2',
      created_at: '2026-03-23T11:00:00.000Z', content_type: 'original', metrics: { like: 50, repost: 10, reply: 2, view: 500 }
    },
    {
      tweet_id: '3', text: 'AI coding tools are better than before', url: 'https://x.com/elon/3',
      created_at: '2026-03-24T11:00:00.000Z', content_type: 'original', metrics: { like: 80, repost: 30, reply: 8, view: 2000 }
    }
  ]);

  const bundle = buildBundle({ baseDir, accounts: ['sama', 'elonmusk'], theme: 'AI coding', topK: 2, originalOnly: true });

  assert.ok(bundle.bundle_id);
  assert.equal(bundle.bundle_strategy, 'one-core-plus-supporting-posts');
  assert.equal(bundle.bundle.supporting_posts.length, 1);
  assert.ok(bundle.bundle.core_post);
  const ids = [bundle.bundle.core_post.tweet_id, ...bundle.bundle.supporting_posts.map((p) => p.tweet_id)];
  assert.equal(new Set(ids).size, ids.length);
});

test('buildBundle filters non-original posts when originalOnly=true', () => {
  const baseDir = makeTempProject();
  writeJsonl(path.join(baseDir, 'data/x/accounts/sama/posts.jsonl'), [
    {
      tweet_id: '1', text: 'AI coding original', url: 'https://x.com/sama/1',
      created_at: '2026-03-23T10:00:00.000Z', content_type: 'original', metrics: { like: 10, repost: 2, reply: 1, view: 100 }
    },
    {
      tweet_id: '2', text: 'AI coding repost', url: 'https://x.com/sama/2',
      created_at: '2026-03-23T11:00:00.000Z', content_type: 'repost', metrics: { like: 999, repost: 999, reply: 999, view: 9999 }
    }
  ]);

  const bundle = buildBundle({ baseDir, accounts: ['sama'], theme: 'AI coding', topK: 3, originalOnly: true });
  const ids = [bundle.bundle.core_post?.tweet_id, ...bundle.bundle.supporting_posts.map((p) => p.tweet_id)].filter(Boolean);
  assert.deepEqual(ids, ['1']);
});

test('buildBundle returns a valid empty bundle on empty input', () => {
  const baseDir = makeTempProject();
  const bundle = buildBundle({ baseDir, accounts: ['missing'], theme: 'AI coding', topK: 4, originalOnly: true });

  assert.ok(bundle.bundle_id);
  assert.equal(bundle.candidate_count, 0);
  assert.equal(bundle.bundle.core_post, null);
  assert.deepEqual(bundle.bundle.supporting_posts, []);
});

test('buildBundle skips empty text and supports top_k=1', () => {
  const baseDir = makeTempProject();
  writeJsonl(path.join(baseDir, 'data/x/accounts/sama/posts.jsonl'), [
    {
      tweet_id: '1', text: '', url: 'https://x.com/sama/1',
      created_at: '2026-03-23T10:00:00.000Z', content_type: 'original', metrics: { like: 999, repost: 9, reply: 9, view: 9999 }
    },
    {
      tweet_id: '2', text: 'AI', url: 'https://x.com/sama/2',
      created_at: '2026-03-23T11:00:00.000Z', content_type: 'original', metrics: { like: 5, repost: 1, reply: 1, view: 50 }
    }
  ]);

  const bundle = buildBundle({ baseDir, accounts: ['sama'], theme: 'AI', topK: 1, originalOnly: true });
  assert.equal(bundle.bundle.core_post.tweet_id, '2');
  assert.deepEqual(bundle.bundle.supporting_posts, []);
});

test('buildBundle works when only one account has usable data', () => {
  const baseDir = makeTempProject();
  writeJsonl(path.join(baseDir, 'data/x/accounts/sama/posts.jsonl'), [
    {
      tweet_id: '1', text: 'AI coding useful signal', url: 'https://x.com/sama/1',
      created_at: '2026-03-23T10:00:00.000Z', content_type: 'original', metrics: { like: 10, repost: 2, reply: 1, view: 100 }
    }
  ]);

  const bundle = buildBundle({ baseDir, accounts: ['sama', 'elonmusk'], theme: 'AI coding', topK: 3, originalOnly: true });
  assert.ok(bundle.bundle.core_post);
  assert.equal(bundle.bundle.core_post.account, 'sama');
});
