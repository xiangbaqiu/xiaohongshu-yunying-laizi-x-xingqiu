const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { updateDraftReviewStatus } = require('../src/review_action_store');

function makeTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'xhs-review-store-'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

test('updateDraftReviewStatus persists status change and appends review history', () => {
  const tempRoot = makeTempProject();
  const draftPath = path.join(tempRoot, 'notes', 'drafts', 'draft-1.json');

  writeJson(draftPath, {
    draft_id: 'draft-1',
    review_status: 'draft',
    status: 'draft',
    body_markdown: 'hello'
  });

  const result = updateDraftReviewStatus(tempRoot, {
    draftId: 'draft-1',
    reviewStatus: 'approved'
  });

  const persisted = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
  assert.equal(result.previousStatus, 'draft');
  assert.equal(persisted.review_status, 'approved');
  assert.ok(persisted.review_updated_at);
  assert.equal(persisted.review_history.length, 1);
  assert.equal(persisted.review_history[0].from, 'draft');
  assert.equal(persisted.review_history[0].to, 'approved');
  assert.equal(persisted.review_history[0].source, 'dashboard');
});

test('updateDraftReviewStatus rejects unsupported dashboard statuses', () => {
  const tempRoot = makeTempProject();
  writeJson(path.join(tempRoot, 'notes', 'drafts', 'draft-2.json'), {
    draft_id: 'draft-2',
    review_status: 'draft',
    status: 'draft'
  });

  assert.throws(() => {
    updateDraftReviewStatus(tempRoot, {
      draftId: 'draft-2',
      reviewStatus: 'published'
    });
  }, /not allowed from dashboard actions/);
});
