const test = require('node:test');
const assert = require('node:assert/strict');
const { buildBrief } = require('../src/brief_builder');

test('buildBrief produces hook, supporting points, and claims', () => {
  const brief = buildBrief({
    bundle_id: 'bundle-1',
    theme: 'AI coding',
    bundle: {
      core_post: {
        tweet_id: '1',
        text: 'AI coding is turning into a full workflow rather than a single tool.',
        account: 'sama'
      },
      supporting_posts: [
        { tweet_id: '2', account: 'elonmusk', support_role: 'comparison' },
        { tweet_id: '3', account: 'sama', support_role: 'evidence' }
      ]
    }
  });

  assert.ok(brief.brief_id);
  assert.equal(brief.bundle_id, 'bundle-1');
  assert.equal(brief.theme, 'AI coding');
  assert.ok(brief.narrative_structure.hook_from_core_post);
  assert.equal(brief.narrative_structure.supporting_points.length, 2);
  assert.ok(brief.claims.length >= 1);
});

test('buildBrief returns fallback brief when core_post is null', () => {
  const brief = buildBrief({
    bundle_id: 'bundle-2',
    theme: 'AI coding',
    bundle: {
      core_post: null,
      supporting_posts: []
    }
  });

  assert.ok(brief.brief_id);
  assert.equal(brief.bundle_id, 'bundle-2');
  assert.equal(brief.narrative_structure.hook_from_core_post, '先用主题切入');
  assert.deepEqual(brief.claims, []);
  assert.deepEqual(brief.audience_takeaway, []);
});
