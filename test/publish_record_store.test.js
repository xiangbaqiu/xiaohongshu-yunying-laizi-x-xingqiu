const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { recordPublishResult } = require('../src/publish_record_store');

function makeTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'xhs-publish-record-'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function scaffoldCliProject(tempRoot) {
  const repoRoot = path.resolve(__dirname, '..');
  for (const file of [
    'note_artifact_io.js',
    'publish_ready_builder.js',
    'publish_record_store.js',
    'review_status.js'
  ]) {
    copyFile(path.join(repoRoot, 'src', file), path.join(tempRoot, 'src', file));
  }

  copyFile(
    path.join(repoRoot, 'scripts', 'record_publish_result.js'),
    path.join(tempRoot, 'scripts', 'record_publish_result.js')
  );
}

function execJsonAllowFailure(command, args, cwd) {
  try {
    return JSON.parse(execFileSync(command, args, { cwd, encoding: 'utf8' }));
  } catch (error) {
    return JSON.parse(error.stdout);
  }
}

test('recordPublishResult writes publish record and updates draft to published', () => {
  const tempRoot = makeTempProject();
  writeJson(path.join(tempRoot, 'notes', 'drafts', 'draft-1.json'), {
    draft_id: 'draft-1',
    review_status: 'approved',
    review_history: [
      {
        from: 'reviewing',
        to: 'approved',
        source: 'dashboard',
        updated_at: '2026-03-25T03:50:00.000Z',
        annotation: null
      }
    ]
  });
  writeJson(path.join(tempRoot, 'notes', 'publish-ready', 'draft-1.json'), {
    publish_ready_id: 'publish-ready-draft-1',
    draft_id: 'draft-1',
    title: '准备发布标题',
    body_markdown: '准备发布正文',
    hashtags: ['#AI'],
    source_review_status: 'approved'
  });

  const result = recordPublishResult(tempRoot, {
    draftId: 'draft-1',
    publishedBy: 'xiangbaqiu',
    publishedAt: '2026-03-25T04:10:00.000Z',
    platformUrl: 'https://www.xiaohongshu.com/explore/demo',
    platformPostId: 'xhs-demo-1',
    note: '发布前做了轻微措辞修改'
  });

  const publishRecord = JSON.parse(fs.readFileSync(result.publishRecordPath, 'utf8'));
  const draft = JSON.parse(fs.readFileSync(path.join(tempRoot, 'notes', 'drafts', 'draft-1.json'), 'utf8'));

  assert.equal(publishRecord.publish_ready_id, 'publish-ready-draft-1');
  assert.equal(publishRecord.published_by, 'xiangbaqiu');
  assert.equal(publishRecord.platform_post_url, 'https://www.xiaohongshu.com/explore/demo');
  assert.equal(draft.review_status, 'published');
  assert.equal(draft.publish_record_id, publishRecord.publish_record_id);
  assert.equal(draft.publish_ready_id, 'publish-ready-draft-1');
  assert.equal(draft.published_url, 'https://www.xiaohongshu.com/explore/demo');
  assert.equal(draft.review_history.at(-1).from, 'approved');
  assert.equal(draft.review_history.at(-1).to, 'published');
  assert.equal(draft.review_history.at(-1).source, 'publish_recorder');
  assert.equal(draft.review_history.at(-1).annotation.operator_identity, 'xiangbaqiu');
});

test('recordPublishResult rejects missing publish-ready payload and non-approved drafts', () => {
  const tempRoot = makeTempProject();
  writeJson(path.join(tempRoot, 'notes', 'drafts', 'draft-2.json'), {
    draft_id: 'draft-2',
    review_status: 'reviewing'
  });

  assert.throws(() => {
    recordPublishResult(tempRoot, {
      draftId: 'draft-2',
      publishedBy: 'xiangbaqiu',
      platformUrl: 'https://www.xiaohongshu.com/explore/demo'
    });
  }, /Publish-ready payload not found|not approved/);

  writeJson(path.join(tempRoot, 'notes', 'publish-ready', 'draft-2.json'), {
    publish_ready_id: 'publish-ready-draft-2',
    draft_id: 'draft-2'
  });

  assert.throws(() => {
    recordPublishResult(tempRoot, {
      draftId: 'draft-2',
      publishedBy: 'xiangbaqiu',
      platformUrl: 'https://www.xiaohongshu.com/explore/demo'
    });
  }, /not approved/);
});

test('record_publish_result CLI writes publish record and returns usage errors', () => {
  const tempRoot = makeTempProject();
  scaffoldCliProject(tempRoot);

  writeJson(path.join(tempRoot, 'notes', 'drafts', 'draft-3.json'), {
    draft_id: 'draft-3',
    review_status: 'approved'
  });
  writeJson(path.join(tempRoot, 'notes', 'publish-ready', 'draft-3.json'), {
    publish_ready_id: 'publish-ready-draft-3',
    draft_id: 'draft-3',
    title: '默认标题',
    body_markdown: '默认正文',
    hashtags: ['#AI']
  });

  const okResult = execJsonAllowFailure('node', [
    path.join(tempRoot, 'scripts', 'record_publish_result.js'),
    'draft-3',
    '--published-by',
    'xiangbaqiu',
    '--platform-url',
    'https://www.xiaohongshu.com/explore/demo'
  ], tempRoot);
  assert.equal(okResult.ok, true);
  assert.ok(fs.existsSync(okResult.path));

  const usageResult = execJsonAllowFailure('node', [
    path.join(tempRoot, 'scripts', 'record_publish_result.js'),
    'draft-3'
  ], tempRoot);
  assert.equal(usageResult.ok, false);
  assert.match(usageResult.message, /Usage/);
});
