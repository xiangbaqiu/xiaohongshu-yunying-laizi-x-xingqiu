const test = require('node:test');
const assert = require('node:assert/strict');
const { composeDraft } = require('../src/draft_composer');

test('composeDraft emits valid draft structure and source posts', () => {
  const draft = composeDraft({
    brief: {
      brief_id: 'brief-1',
      theme: 'AI coding',
      core_angle: 'Turn multiple X posts into one Xiaohongshu draft.',
      narrative_structure: {
        hook_from_core_post: 'AI coding is becoming workflow-first.',
        final_takeaway: 'The real value is synthesis, not translation.'
      }
    },
    bundle: {
      bundle_id: 'bundle-1',
      bundle: {
        core_post: { tweet_id: '1', url: 'https://x.com/1', text: 'core text' },
        supporting_posts: [{ tweet_id: '2', url: 'https://x.com/2', text: 'support', account: 'sama', support_role: 'example' }]
      }
    },
    style: 'trend-analysis'
  });

  assert.ok(draft.draft_id);
  assert.equal(draft.brief_id, 'brief-1');
  assert.equal(draft.bundle_id, 'bundle-1');
  assert.equal(draft.review_status, 'draft');
  assert.ok(draft.review_transition_rules);
  assert.ok(draft.body_markdown.includes('### 我自己的结论'));
  assert.equal(draft.source_posts.length, 2);
});

test('composeDraft handles bundles without supporting posts', () => {
  const draft = composeDraft({
    brief: {
      brief_id: 'brief-2',
      theme: 'AI coding',
      core_angle: 'angle',
      narrative_structure: {
        hook_from_core_post: 'hook',
        final_takeaway: 'takeaway'
      }
    },
    bundle: {
      bundle_id: 'bundle-2',
      bundle: {
        core_post: null,
        supporting_posts: []
      }
    }
  });

  assert.ok(draft.draft_id);
  assert.deepEqual(draft.source_posts, []);
  assert.equal(draft.bundle_id, 'bundle-2');
});

test('composeDraft handles very short text without crashing', () => {
  const draft = composeDraft({
    brief: {
      brief_id: 'brief-3',
      theme: 'AI',
      core_angle: 'short angle',
      narrative_structure: {
        hook_from_core_post: '短',
        final_takeaway: '短总结'
      }
    },
    bundle: {
      bundle_id: 'bundle-3',
      bundle: {
        core_post: { tweet_id: '1', url: 'https://x.com/1', text: '短' },
        supporting_posts: []
      }
    },
    style: 'trend-analysis'
  });

  assert.ok(draft.body_markdown.length > 0);
  assert.equal(draft.theme, 'AI');
});

test('composeDraft normalizes explicit review status', () => {
  const approved = composeDraft({
    brief: {
      brief_id: 'brief-4',
      theme: 'AI',
      core_angle: 'angle',
      narrative_structure: { hook_from_core_post: 'hook', final_takeaway: 'takeaway' }
    },
    bundle: {
      bundle_id: 'bundle-4',
      bundle: { core_post: null, supporting_posts: [] }
    },
    reviewStatus: 'approved'
  });

  const fallback = composeDraft({
    brief: {
      brief_id: 'brief-5',
      theme: 'AI',
      core_angle: 'angle',
      narrative_structure: { hook_from_core_post: 'hook', final_takeaway: 'takeaway' }
    },
    bundle: {
      bundle_id: 'bundle-5',
      bundle: { core_post: null, supporting_posts: [] }
    },
    reviewStatus: 'weird-status'
  });

  assert.equal(approved.review_status, 'approved');
  assert.equal(fallback.review_status, 'draft');
});
