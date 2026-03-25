const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createDashboardServer } = require('../scripts/dashboard_server');

function makeTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'xhs-dashboard-server-'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

test('dashboard server updates review status, annotations, and rebuilds dashboard data', async () => {
  const tempRoot = makeTempProject();
  writeText(path.join(tempRoot, 'dashboard', 'index.html'), '<!doctype html><title>ok</title>');
  writeText(path.join(tempRoot, 'dashboard', 'app.js'), 'console.log("ok");');
  writeText(path.join(tempRoot, 'dashboard', 'styles.css'), 'body {}');

  writeJson(path.join(tempRoot, 'notes', 'drafts', 'draft-1.json'), {
    draft_id: 'draft-1',
    brief_id: 'brief-1',
    bundle_id: 'bundle-1',
    theme: 'AI coding',
    style: 'trend-analysis',
    body_markdown: 'hello',
    source_posts: [],
    status: 'draft',
    review_status: 'draft',
    created_at: '2026-03-24T10:00:00.000Z'
  });

  const server = createDashboardServer(tempRoot);
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/drafts/draft-1/review-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        review_status: 'reviewing',
        reviewer_note: '需要补一个更强的开头',
        edit_suggestion: '把第二段再收短一点',
        rejection_reason: '',
        operator_identity: 'xiangbaqiu'
      })
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.review_status, 'reviewing');

    const persisted = JSON.parse(fs.readFileSync(path.join(tempRoot, 'notes', 'drafts', 'draft-1.json'), 'utf8'));
    const dashboard = JSON.parse(fs.readFileSync(path.join(tempRoot, 'data', 'dashboard', 'dashboard-data.json'), 'utf8'));

    assert.equal(persisted.review_status, 'reviewing');
    assert.equal(persisted.review_annotation.reviewer_note, '需要补一个更强的开头');
    assert.equal(persisted.review_annotation.edit_suggestion, '把第二段再收短一点');
    assert.equal(persisted.review_annotation.operator_identity, 'xiangbaqiu');
    assert.equal(dashboard.notes[0].review_status, 'reviewing');
    assert.equal(dashboard.notes[0].review_annotation.reviewer_note, '需要补一个更强的开头');
    assert.equal(dashboard.notes[0].review_updated_at, persisted.review_updated_at);
    assert.ok(dashboard.filters_meta.review_statuses.includes('reviewing'));
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('dashboard server creates publish-ready payload and rebuilds dashboard data', async () => {
  const tempRoot = makeTempProject();
  writeText(path.join(tempRoot, 'dashboard', 'index.html'), '<!doctype html><title>ok</title>');
  writeText(path.join(tempRoot, 'dashboard', 'app.js'), 'console.log("ok");');
  writeText(path.join(tempRoot, 'dashboard', 'styles.css'), 'body {}');

  writeJson(path.join(tempRoot, 'notes', 'drafts', 'draft-2.json'), {
    draft_id: 'draft-2',
    brief_id: 'brief-2',
    bundle_id: 'bundle-2',
    theme: 'AI coding',
    style: 'trend-analysis',
    title_options: ['可直接发布的标题'],
    cover_text_options: ['封面文案'],
    body_markdown: 'hello publish ready',
    hashtags: ['#AI', '#内容运营'],
    source_posts: [],
    status: 'draft',
    review_status: 'approved',
    review_annotation: {
      operator_identity: 'xiangbaqiu',
      reviewer_note: '可以进入发布准备'
    },
    created_at: '2026-03-24T10:00:00.000Z'
  });

  const server = createDashboardServer(tempRoot);
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/drafts/draft-2/publish-ready`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operator_identity: 'xiangbaqiu'
      })
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.draft_id, 'draft-2');
    assert.equal(payload.publish_ready_id, 'publish-ready-draft-2');
    assert.equal(payload.prepared_by, 'xiangbaqiu');

    const publishReady = JSON.parse(fs.readFileSync(path.join(tempRoot, 'notes', 'publish-ready', 'draft-2.json'), 'utf8'));
    const dashboard = JSON.parse(fs.readFileSync(path.join(tempRoot, 'data', 'dashboard', 'dashboard-data.json'), 'utf8'));

    assert.equal(publishReady.publish_ready_id, 'publish-ready-draft-2');
    assert.equal(publishReady.prepared_by, 'xiangbaqiu');
    assert.equal(publishReady.title, '可直接发布的标题');
    assert.equal(publishReady.cover_text, '封面文案');
    assert.deepEqual(publishReady.hashtags, ['#AI', '#内容运营']);
    assert.equal(dashboard.notes[0].has_publish_ready, true);
    assert.equal(dashboard.notes[0].publish_ready.publish_ready_id, 'publish-ready-draft-2');
    assert.equal(dashboard.notes[0].publish_ready.prepared_by, 'xiangbaqiu');
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('dashboard server rejects publish-ready generation for non-approved drafts', async () => {
  const tempRoot = makeTempProject();
  writeText(path.join(tempRoot, 'dashboard', 'index.html'), '<!doctype html><title>ok</title>');
  writeText(path.join(tempRoot, 'dashboard', 'app.js'), 'console.log("ok");');
  writeText(path.join(tempRoot, 'dashboard', 'styles.css'), 'body {}');

  writeJson(path.join(tempRoot, 'notes', 'drafts', 'draft-3.json'), {
    draft_id: 'draft-3',
    brief_id: 'brief-3',
    bundle_id: 'bundle-3',
    theme: 'AI coding',
    style: 'trend-analysis',
    body_markdown: 'not approved yet',
    source_posts: [],
    status: 'draft',
    review_status: 'reviewing',
    created_at: '2026-03-24T10:00:00.000Z'
  });

  const server = createDashboardServer(tempRoot);
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/drafts/draft-3/publish-ready`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operator_identity: 'xiangbaqiu'
      })
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.ok, false);
    assert.match(payload.message, /not approved/i);
    assert.equal(fs.existsSync(path.join(tempRoot, 'notes', 'publish-ready', 'draft-3.json')), false);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('dashboard server records publish result, updates draft, and rebuilds dashboard data', async () => {
  const tempRoot = makeTempProject();
  writeText(path.join(tempRoot, 'dashboard', 'index.html'), '<!doctype html><title>ok</title>');
  writeText(path.join(tempRoot, 'dashboard', 'app.js'), 'console.log("ok");');
  writeText(path.join(tempRoot, 'dashboard', 'styles.css'), 'body {}');

  writeJson(path.join(tempRoot, 'notes', 'drafts', 'draft-4.json'), {
    draft_id: 'draft-4',
    brief_id: 'brief-4',
    bundle_id: 'bundle-4',
    theme: 'AI coding',
    style: 'trend-analysis',
    body_markdown: 'ready to publish',
    source_posts: [],
    status: 'draft',
    review_status: 'approved',
    created_at: '2026-03-24T10:00:00.000Z'
  });
  writeJson(path.join(tempRoot, 'notes', 'publish-ready', 'draft-4.json'), {
    publish_ready_id: 'publish-ready-draft-4',
    draft_id: 'draft-4',
    brief_id: 'brief-4',
    bundle_id: 'bundle-4',
    title: '可发布标题',
    cover_text: '可发布封面',
    body_markdown: 'ready to publish',
    hashtags: ['#AI'],
    prepared_at: '2026-03-24T10:05:00.000Z',
    prepared_by: 'xiangbaqiu',
    source_review_status: 'approved'
  });

  const server = createDashboardServer(tempRoot);
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/drafts/draft-4/publish-record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operator_identity: 'xiangbaqiu',
        published_at: '2026-03-25T12:30:00.000Z',
        platform_url: 'https://www.xiaohongshu.com/explore/abc123',
        platform_post_id: 'abc123',
        publish_note: '已手动发出'
      })
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.draft_id, 'draft-4');
    assert.equal(payload.review_status, 'published');
    assert.equal(payload.published_by, 'xiangbaqiu');
    assert.equal(payload.platform_post_url, 'https://www.xiaohongshu.com/explore/abc123');

    const persistedDraft = JSON.parse(fs.readFileSync(path.join(tempRoot, 'notes', 'drafts', 'draft-4.json'), 'utf8'));
    const publishRecordsDir = path.join(tempRoot, 'notes', 'publish-records');
    const publishRecordFiles = fs.readdirSync(publishRecordsDir).filter((file) => file.endsWith('.json'));
    const publishRecord = JSON.parse(fs.readFileSync(path.join(publishRecordsDir, publishRecordFiles[0]), 'utf8'));
    const dashboard = JSON.parse(fs.readFileSync(path.join(tempRoot, 'data', 'dashboard', 'dashboard-data.json'), 'utf8'));

    assert.equal(persistedDraft.review_status, 'published');
    assert.equal(persistedDraft.publish_record_id, publishRecord.publish_record_id);
    assert.equal(persistedDraft.published_url, 'https://www.xiaohongshu.com/explore/abc123');
    assert.equal(persistedDraft.review_annotation.operator_identity, 'xiangbaqiu');
    assert.equal(publishRecord.publish_ready_id, 'publish-ready-draft-4');
    assert.equal(publishRecord.platform_post_id, 'abc123');
    assert.equal(publishRecord.notes, '已手动发出');
    assert.equal(dashboard.notes[0].review_status, 'published');
    assert.equal(dashboard.notes[0].has_publish_record, true);
    assert.equal(dashboard.notes[0].publish_record.platform_post_url, 'https://www.xiaohongshu.com/explore/abc123');
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('dashboard server rejects publish record when platform url is missing', async () => {
  const tempRoot = makeTempProject();
  writeText(path.join(tempRoot, 'dashboard', 'index.html'), '<!doctype html><title>ok</title>');
  writeText(path.join(tempRoot, 'dashboard', 'app.js'), 'console.log("ok");');
  writeText(path.join(tempRoot, 'dashboard', 'styles.css'), 'body {}');

  writeJson(path.join(tempRoot, 'notes', 'drafts', 'draft-5.json'), {
    draft_id: 'draft-5',
    brief_id: 'brief-5',
    bundle_id: 'bundle-5',
    theme: 'AI coding',
    style: 'trend-analysis',
    body_markdown: 'ready to publish',
    source_posts: [],
    status: 'draft',
    review_status: 'approved',
    created_at: '2026-03-24T10:00:00.000Z'
  });
  writeJson(path.join(tempRoot, 'notes', 'publish-ready', 'draft-5.json'), {
    publish_ready_id: 'publish-ready-draft-5',
    draft_id: 'draft-5',
    title: '可发布标题',
    body_markdown: 'ready to publish',
    hashtags: [],
    prepared_at: '2026-03-24T10:05:00.000Z',
    source_review_status: 'approved'
  });

  const server = createDashboardServer(tempRoot);
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/drafts/draft-5/publish-record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operator_identity: 'xiangbaqiu',
        publish_note: '少了平台链接'
      })
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.ok, false);
    assert.match(payload.message, /platformUrl is required/i);
    assert.equal(fs.existsSync(path.join(tempRoot, 'notes', 'publish-records')), false);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
