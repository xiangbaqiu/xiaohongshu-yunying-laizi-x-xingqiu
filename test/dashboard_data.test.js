const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

function makeTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'xhs-dashboard-test-'));
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

test('build_dashboard_data degrades gracefully when brief/bundle are missing', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const tempRoot = makeTempProject();
  copyFile(path.join(repoRoot, 'scripts', 'build_dashboard_data.js'), path.join(tempRoot, 'scripts', 'build_dashboard_data.js'));

  writeJson(path.join(tempRoot, 'notes', 'drafts', 'draft-1.json'), {
    draft_id: 'draft-1',
    brief_id: 'brief-missing',
    bundle_id: 'bundle-missing',
    theme: 'AI coding',
    style: 'trend-analysis',
    body_markdown: 'hello',
    source_posts: [],
    status: 'draft',
    review_status: 'reviewing',
    created_at: '2026-03-24T10:00:00.000Z'
  });

  execFileSync('node', [path.join(tempRoot, 'scripts', 'build_dashboard_data.js')], { cwd: tempRoot, encoding: 'utf8' });
  const dashboard = JSON.parse(fs.readFileSync(path.join(tempRoot, 'data', 'dashboard', 'dashboard-data.json'), 'utf8'));
  assert.equal(dashboard.notes.length, 1);
  assert.equal(dashboard.notes[0].draft_id, 'draft-1');
  assert.equal(dashboard.notes[0].review_status, 'reviewing');
  assert.equal(dashboard.notes[0].brief_preview, null);
  assert.equal(dashboard.notes[0].bundle_preview, null);
  assert.ok(dashboard.filters_meta.review_statuses.includes('reviewing'));
});

test('build_dashboard_data includes publish-ready and publish-record traceability when artifacts exist', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const tempRoot = makeTempProject();
  copyFile(path.join(repoRoot, 'scripts', 'build_dashboard_data.js'), path.join(tempRoot, 'scripts', 'build_dashboard_data.js'));

  writeJson(path.join(tempRoot, 'notes', 'drafts', 'draft-2.json'), {
    draft_id: 'draft-2',
    brief_id: 'brief-2',
    bundle_id: 'bundle-2',
    theme: 'AI coding',
    style: 'trend-analysis',
    body_markdown: 'hello',
    source_posts: [],
    status: 'draft',
    review_status: 'published',
    publish_ready_id: 'publish-ready-draft-2',
    publish_record_id: 'publish-1742883600000',
    published_at: '2026-03-25T11:00:00.000Z',
    published_url: 'https://www.xiaohongshu.com/explore/demo',
    created_at: '2026-03-24T10:00:00.000Z'
  });
  writeJson(path.join(tempRoot, 'notes', 'publish-ready', 'draft-2.json'), {
    publish_ready_id: 'publish-ready-draft-2',
    draft_id: 'draft-2',
    prepared_at: '2026-03-25T10:00:00.000Z',
    prepared_by: 'xiangbaqiu',
    title: '准备发布标题'
  });
  writeJson(path.join(tempRoot, 'notes', 'publish-records', 'publish-1742883600000.json'), {
    publish_record_id: 'publish-1742883600000',
    draft_id: 'draft-2',
    platform: 'xiaohongshu',
    published_at: '2026-03-25T11:00:00.000Z',
    published_by: 'xiangbaqiu',
    platform_post_url: 'https://www.xiaohongshu.com/explore/demo'
  });

  execFileSync('node', [path.join(tempRoot, 'scripts', 'build_dashboard_data.js')], { cwd: tempRoot, encoding: 'utf8' });
  const dashboard = JSON.parse(fs.readFileSync(path.join(tempRoot, 'data', 'dashboard', 'dashboard-data.json'), 'utf8'));
  assert.equal(dashboard.notes.length, 1);
  assert.equal(dashboard.notes[0].has_publish_ready, true);
  assert.equal(dashboard.notes[0].has_publish_record, true);
  assert.equal(dashboard.notes[0].publish_ready.publish_ready_id, 'publish-ready-draft-2');
  assert.equal(dashboard.notes[0].publish_ready.prepared_by, 'xiangbaqiu');
  assert.equal(dashboard.notes[0].publish_record.publish_record_id, 'publish-1742883600000');
  assert.equal(dashboard.notes[0].publish_record.platform_post_url, 'https://www.xiaohongshu.com/explore/demo');
  assert.equal(dashboard.notes[0].published_url, 'https://www.xiaohongshu.com/explore/demo');
});
