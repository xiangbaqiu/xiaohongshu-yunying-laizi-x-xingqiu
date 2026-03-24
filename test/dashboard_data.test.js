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
    created_at: '2026-03-24T10:00:00.000Z'
  });

  execFileSync('node', [path.join(tempRoot, 'scripts', 'build_dashboard_data.js')], { cwd: tempRoot, encoding: 'utf8' });
  const dashboard = JSON.parse(fs.readFileSync(path.join(tempRoot, 'data', 'dashboard', 'dashboard-data.json'), 'utf8'));
  assert.equal(dashboard.notes.length, 1);
  assert.equal(dashboard.notes[0].draft_id, 'draft-1');
  assert.equal(dashboard.notes[0].brief_preview, null);
  assert.equal(dashboard.notes[0].bundle_preview, null);
});
