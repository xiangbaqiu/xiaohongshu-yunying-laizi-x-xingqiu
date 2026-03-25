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

test('updateDraftReviewStatus persists status change, annotation, and review history', () => {
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
    reviewStatus: 'approved',
    reviewerNote: '整体方向可发，但标题还可以更强。',
    editSuggestion: '封面文案可以更具体一点',
    operatorIdentity: 'xiangbaqiu'
  });

  const persisted = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
  assert.equal(result.previousStatus, 'draft');
  assert.equal(persisted.review_status, 'approved');
  assert.ok(persisted.review_updated_at);
  assert.equal(persisted.review_annotation.reviewer_note, '整体方向可发，但标题还可以更强。');
  assert.equal(persisted.review_annotation.edit_suggestion, '封面文案可以更具体一点');
  assert.equal(persisted.review_annotation.operator_identity, 'xiangbaqiu');
  assert.equal(persisted.review_history.length, 1);
  assert.equal(persisted.review_history[0].from, 'draft');
  assert.equal(persisted.review_history[0].to, 'approved');
  assert.equal(persisted.review_history[0].source, 'dashboard');
  assert.equal(persisted.review_history[0].annotation.reviewer_note, '整体方向可发，但标题还可以更强。');
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

test('updateDraftReviewStatus degrades gracefully when annotation is omitted', () => {
  const tempRoot = makeTempProject();
  const draftPath = path.join(tempRoot, 'notes', 'drafts', 'draft-3.json');

  writeJson(draftPath, {
    draft_id: 'draft-3',
    review_status: 'draft',
    status: 'draft'
  });

  updateDraftReviewStatus(tempRoot, {
    draftId: 'draft-3',
    reviewStatus: 'reviewing',
    reviewerNote: '   ',
    editSuggestion: '',
    rejectionReason: null,
    operatorIdentity: undefined
  });

  const persisted = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
  assert.equal(persisted.review_annotation, null);
  assert.equal(persisted.review_history[0].annotation, null);
});
