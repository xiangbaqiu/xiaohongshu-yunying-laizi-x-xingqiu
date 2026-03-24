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
  assert.equal(draft.note_id, draft.draft_id);
  assert.equal(draft.brief_id, 'brief-1');
  assert.equal(draft.bundle_id, 'bundle-1');
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
