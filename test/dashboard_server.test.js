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

test('dashboard server updates review status and rebuilds dashboard data', async () => {
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
      body: JSON.stringify({ review_status: 'reviewing' })
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.review_status, 'reviewing');

    const persisted = JSON.parse(fs.readFileSync(path.join(tempRoot, 'notes', 'drafts', 'draft-1.json'), 'utf8'));
    const dashboard = JSON.parse(fs.readFileSync(path.join(tempRoot, 'data', 'dashboard', 'dashboard-data.json'), 'utf8'));

    assert.equal(persisted.review_status, 'reviewing');
    assert.equal(dashboard.notes[0].review_status, 'reviewing');
    assert.ok(dashboard.filters_meta.review_statuses.includes('reviewing'));
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
