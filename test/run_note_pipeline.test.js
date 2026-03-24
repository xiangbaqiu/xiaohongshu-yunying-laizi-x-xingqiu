const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

async function runPipelineExpectJson(tempRoot, configPath) {
  try {
    const { stdout } = await execFileAsync('node', [path.join(tempRoot, 'src', 'run_note_pipeline.js'), configPath], { cwd: tempRoot });
    return JSON.parse(stdout);
  } catch (error) {
    return JSON.parse(error.stdout);
  }
}

function makeTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'xhs-pipeline-test-'));
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
  copyFile(path.join(repoRoot, 'src', 'run_note_pipeline.js'), path.join(tempRoot, 'src', 'run_note_pipeline.js'));
  copyFile(path.join(repoRoot, 'src', 'bundle_builder.js'), path.join(tempRoot, 'src', 'bundle_builder.js'));
  copyFile(path.join(repoRoot, 'src', 'brief_builder.js'), path.join(tempRoot, 'src', 'brief_builder.js'));
  copyFile(path.join(repoRoot, 'src', 'draft_composer.js'), path.join(tempRoot, 'src', 'draft_composer.js'));
  copyFile(path.join(repoRoot, 'src', 'note_artifact_io.js'), path.join(tempRoot, 'src', 'note_artifact_io.js'));
  copyFile(path.join(repoRoot, 'scripts', 'build_dashboard_data.js'), path.join(tempRoot, 'scripts', 'build_dashboard_data.js'));
}

function writeBaseFixtures(tempRoot) {
  writeJsonl(path.join(tempRoot, 'data/x/accounts/sama/posts.jsonl'), [
    {
      tweet_id: '1', text: 'AI coding is moving from single prompts to full workflows', url: 'https://x.com/sama/1',
      created_at: '2026-03-23T10:00:00.000Z', content_type: 'original', metrics: { like: 100, repost: 20, reply: 5, view: 1000 }
    }
  ]);
}

function writeConfig(tempRoot, extra = {}) {
  const configPath = path.join(tempRoot, 'note.config.json');
  fs.writeFileSync(configPath, JSON.stringify({
    theme: 'AI coding',
    accounts: ['sama'],
    top_k: 4,
    original_only: true,
    style: 'trend-analysis',
    rebuild_dashboard: false,
    ...extra
  }, null, 2));
  return configPath;
}

test('run_note_pipeline writes bundle/brief/draft/run artifacts and supports rebuild_dashboard=false', () => {
  const tempRoot = makeTempProject();
  scaffoldProject(tempRoot);
  writeBaseFixtures(tempRoot);
  const configPath = writeConfig(tempRoot);

  const raw = execFileSync('node', [path.join(tempRoot, 'src', 'run_note_pipeline.js'), configPath], { cwd: tempRoot, encoding: 'utf8' });
  const result = JSON.parse(raw);

  assert.equal(result.ok, true);
  assert.equal(result.dashboard.attempted, false);
  assert.ok(fs.existsSync(result.paths.bundlePath));
  assert.ok(fs.existsSync(result.paths.briefPath));
  assert.ok(fs.existsSync(result.paths.draftJsonPath));
  assert.ok(fs.existsSync(result.paths.draftMdPath));
  assert.ok(fs.existsSync(result.paths.runSummaryPath));

  const runSummary = JSON.parse(fs.readFileSync(result.paths.runSummaryPath, 'utf8'));
  assert.equal(runSummary.bundle_id, result.bundle_id);
  assert.equal(runSummary.brief_id, result.brief_id);
  assert.equal(runSummary.draft_id, result.draft_id);
});

test('run_note_pipeline surfaces bundle_build_failed', async () => {
  const tempRoot = makeTempProject();
  scaffoldProject(tempRoot);
  writeBaseFixtures(tempRoot);
  const configPath = writeConfig(tempRoot);
  fs.writeFileSync(path.join(tempRoot, 'src', 'bundle_builder.js'), "function buildBundle(){ throw new Error('bundle boom'); } module.exports={ buildBundle };\n", 'utf8');

  const result = await runPipelineExpectJson(tempRoot, configPath);
  assert.equal(result.ok, false);
  assert.equal(result.stage, 'bundle_build_failed');
  assert.match(result.message, /bundle boom/);
});

test('run_note_pipeline surfaces brief_build_failed', async () => {
  const tempRoot = makeTempProject();
  scaffoldProject(tempRoot);
  writeBaseFixtures(tempRoot);
  const configPath = writeConfig(tempRoot);
  fs.writeFileSync(path.join(tempRoot, 'src', 'brief_builder.js'), "function buildBrief(){ throw new Error('brief boom'); } module.exports={ buildBrief };\n", 'utf8');

  const result = await runPipelineExpectJson(tempRoot, configPath);
  assert.equal(result.ok, false);
  assert.equal(result.stage, 'brief_build_failed');
  assert.match(result.message, /brief boom/);
});

test('run_note_pipeline surfaces draft_compose_failed', async () => {
  const tempRoot = makeTempProject();
  scaffoldProject(tempRoot);
  writeBaseFixtures(tempRoot);
  const configPath = writeConfig(tempRoot);
  fs.writeFileSync(path.join(tempRoot, 'src', 'draft_composer.js'), "function composeDraft(){ throw new Error('draft boom'); } module.exports={ composeDraft };\n", 'utf8');

  const result = await runPipelineExpectJson(tempRoot, configPath);
  assert.equal(result.ok, false);
  assert.equal(result.stage, 'draft_compose_failed');
  assert.match(result.message, /draft boom/);
});
