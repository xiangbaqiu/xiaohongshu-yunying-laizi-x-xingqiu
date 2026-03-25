const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { createPublishReady } = require('../src/publish_ready_builder');

function makeTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'xhs-publish-ready-'));
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
    'review_status.js'
  ]) {
    copyFile(path.join(repoRoot, 'src', file), path.join(tempRoot, 'src', file));
  }

  copyFile(
    path.join(repoRoot, 'scripts', 'create_publish_ready.js'),
    path.join(tempRoot, 'scripts', 'create_publish_ready.js')
  );
}

function execJsonAllowFailure(command, args, cwd) {
  try {
    return JSON.parse(execFileSync(command, args, { cwd, encoding: 'utf8' }));
  } catch (error) {
    return JSON.parse(error.stdout);
  }
}

test('createPublishReady writes a publish-ready artifact for an approved draft', () => {
  const tempRoot = makeTempProject();
  writeJson(path.join(tempRoot, 'notes', 'drafts', 'draft-1.json'), {
    draft_id: 'draft-1',
    brief_id: 'brief-1',
    bundle_id: 'bundle-1',
    theme: 'AI coding',
    style: 'trend-analysis',
    title_options: ['标题 A', '标题 B'],
    cover_text_options: ['封面 A'],
    body_markdown: '正文内容',
    hashtags: ['#AI', '#小红书运营'],
    source_posts: [{ tweet_id: '1', url: 'https://x.com/sama/1' }],
    review_status: 'approved',
    review_annotation: {
      reviewer_note: '方向可发',
      operator_identity: 'xiangbaqiu'
    }
  });

  const result = createPublishReady(tempRoot, {
    draftId: 'draft-1',
    preparedBy: 'xiangbaqiu',
    now: new Date('2026-03-25T04:00:00.000Z')
  });

  const persisted = JSON.parse(fs.readFileSync(result.filePath, 'utf8'));
  assert.equal(persisted.publish_ready_id, 'publish-ready-draft-1');
  assert.equal(persisted.draft_id, 'draft-1');
  assert.equal(persisted.title, '标题 A');
  assert.equal(persisted.cover_text, '封面 A');
  assert.equal(persisted.body_markdown, '正文内容');
  assert.deepEqual(persisted.hashtags, ['#AI', '#小红书运营']);
  assert.equal(persisted.prepared_by, 'xiangbaqiu');
  assert.equal(persisted.source_review_status, 'approved');
});

test('createPublishReady rejects drafts that are not approved', () => {
  const tempRoot = makeTempProject();
  writeJson(path.join(tempRoot, 'notes', 'drafts', 'draft-2.json'), {
    draft_id: 'draft-2',
    review_status: 'reviewing'
  });

  assert.throws(() => {
    createPublishReady(tempRoot, { draftId: 'draft-2' });
  }, /not approved/);
});

test('create_publish_ready CLI creates an artifact and returns usage errors when missing args', () => {
  const tempRoot = makeTempProject();
  scaffoldCliProject(tempRoot);

  writeJson(path.join(tempRoot, 'notes', 'drafts', 'draft-3.json'), {
    draft_id: 'draft-3',
    brief_id: 'brief-3',
    bundle_id: 'bundle-3',
    title_options: ['默认标题'],
    cover_text_options: ['默认封面'],
    body_markdown: '默认正文',
    hashtags: ['#AI'],
    review_status: 'approved'
  });

  const okResult = execJsonAllowFailure('node', [
    path.join(tempRoot, 'scripts', 'create_publish_ready.js'),
    'draft-3',
    '--prepared-by',
    'xiangbaqiu'
  ], tempRoot);
  assert.equal(okResult.ok, true);
  assert.ok(fs.existsSync(okResult.path));

  const usageResult = execJsonAllowFailure('node', [
    path.join(tempRoot, 'scripts', 'create_publish_ready.js')
  ], tempRoot);
  assert.equal(usageResult.ok, false);
  assert.match(usageResult.message, /Usage/);
});
