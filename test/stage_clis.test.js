const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

function makeTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'xhs-stage-cli-test-'));
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function writeJsonl(filePath, rows) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, rows.map((row) => JSON.stringify(row)).join('\n') + '\n', 'utf8');
}

function scaffoldProject(tempRoot) {
  const repoRoot = path.resolve(__dirname, '..');
  for (const file of [
    'bundle_builder.js',
    'brief_builder.js',
    'draft_composer.js',
    'review_status.js',
    'note_artifact_io.js',
    'run_bundle_builder.js',
    'run_brief_builder.js',
    'run_draft_composer.js'
  ]) {
    copyFile(path.join(repoRoot, 'src', file), path.join(tempRoot, 'src', file));
  }
}

function execJsonAllowFailure(command, args, cwd) {
  try {
    return JSON.parse(execFileSync(command, args, { cwd, encoding: 'utf8' }));
  } catch (error) {
    return JSON.parse(error.stdout);
  }
}

test('stage CLIs can run bundle -> brief -> draft independently', () => {
  const tempRoot = makeTempProject();
  scaffoldProject(tempRoot);

  writeJsonl(path.join(tempRoot, 'data/x/accounts/sama/posts.jsonl'), [
    {
      tweet_id: '1', text: 'AI coding is becoming workflow-first', url: 'https://x.com/sama/1',
      created_at: '2026-03-23T10:00:00.000Z', content_type: 'original', metrics: { like: 100, repost: 20, reply: 5, view: 1000 }
    }
  ]);

  const configPath = path.join(tempRoot, 'note.config.json');
  fs.writeFileSync(configPath, JSON.stringify({
    theme: 'AI coding',
    accounts: ['sama'],
    top_k: 4,
    original_only: true,
    style: 'trend-analysis'
  }, null, 2));

  const bundleRaw = execFileSync('node', [path.join(tempRoot, 'src', 'run_bundle_builder.js'), configPath], { cwd: tempRoot, encoding: 'utf8' });
  const bundleResult = JSON.parse(bundleRaw);
  assert.equal(bundleResult.ok, true);
  assert.ok(fs.existsSync(bundleResult.path));

  const briefRaw = execFileSync('node', [path.join(tempRoot, 'src', 'run_brief_builder.js'), bundleResult.path], { cwd: tempRoot, encoding: 'utf8' });
  const briefResult = JSON.parse(briefRaw);
  assert.equal(briefResult.ok, true);
  assert.ok(fs.existsSync(briefResult.path));

  const draftRaw = execFileSync('node', [path.join(tempRoot, 'src', 'run_draft_composer.js'), briefResult.path, bundleResult.path], { cwd: tempRoot, encoding: 'utf8' });
  const draftResult = JSON.parse(draftRaw);
  assert.equal(draftResult.ok, true);
  assert.ok(fs.existsSync(draftResult.paths.draftJsonPath));
  assert.ok(fs.existsSync(draftResult.paths.draftMdPath));
});

test('stage CLIs return usage errors when required args are missing', () => {
  const tempRoot = makeTempProject();
  scaffoldProject(tempRoot);

  const briefResult = execJsonAllowFailure('node', [path.join(tempRoot, 'src', 'run_brief_builder.js')], tempRoot);
  const draftResult = execJsonAllowFailure('node', [path.join(tempRoot, 'src', 'run_draft_composer.js')], tempRoot);
  assert.equal(briefResult.ok, false);
  assert.equal(draftResult.ok, false);
  assert.match(briefResult.message, /Usage/);
  assert.match(draftResult.message, /Usage/);
});
