const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { archiveNoteArtifacts } = require('../scripts/archive_note_artifacts');

function makeTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'xhs-archive-test-'));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function seedLineage(tempRoot, suffix, createdAt) {
  writeJson(path.join(tempRoot, 'notes', 'drafts', `draft-${suffix}.json`), {
    draft_id: `draft-${suffix}`,
    brief_id: `brief-${suffix}`,
    bundle_id: `bundle-${suffix}`,
    created_at: createdAt
  });
  writeText(path.join(tempRoot, 'notes', 'drafts', `draft-${suffix}.md`), `# ${suffix}`);
  writeJson(path.join(tempRoot, 'notes', 'briefs', `brief-${suffix}.json`), {
    brief_id: `brief-${suffix}`,
    bundle_id: `bundle-${suffix}`,
    created_at: createdAt
  });
  writeJson(path.join(tempRoot, 'notes', 'bundles', `bundle-${suffix}.json`), {
    bundle_id: `bundle-${suffix}`,
    created_at: createdAt
  });
  writeJson(path.join(tempRoot, 'notes', 'runs', `run-${suffix}.json`), {
    run_id: `run-${suffix}`,
    draft_id: `draft-${suffix}`,
    created_at: createdAt
  });
}

test('archiveNoteArtifacts dry-run reports candidates without moving files', () => {
  const tempRoot = makeTempProject();
  seedLineage(tempRoot, 'old', '2026-03-20T10:00:00.000Z');
  seedLineage(tempRoot, 'new', '2026-03-21T10:00:00.000Z');

  const result = archiveNoteArtifacts(tempRoot, {
    keepDrafts: 1,
    apply: false,
    now: new Date('2026-03-25T03:30:00.000Z')
  });

  assert.equal(result.archivedCounts.drafts, 2);
  assert.equal(result.archivedCounts.briefs, 1);
  assert.equal(result.archivedCounts.bundles, 1);
  assert.equal(result.archivedCounts.runs, 1);
  assert.ok(fs.existsSync(path.join(tempRoot, 'notes', 'drafts', 'draft-old.json')));
  assert.ok(!fs.existsSync(path.join(tempRoot, result.archiveRoot)));
});

test('archiveNoteArtifacts apply moves historical artifacts into archive manifest', () => {
  const tempRoot = makeTempProject();
  seedLineage(tempRoot, 'old', '2026-03-20T10:00:00.000Z');
  seedLineage(tempRoot, 'new', '2026-03-21T10:00:00.000Z');

  const result = archiveNoteArtifacts(tempRoot, {
    keepDrafts: 1,
    apply: true,
    now: new Date('2026-03-25T03:30:00.000Z')
  });

  const archiveRoot = path.join(tempRoot, result.archiveRoot);
  const manifestPath = path.join(archiveRoot, 'archive-manifest.json');

  assert.ok(fs.existsSync(manifestPath));
  assert.ok(!fs.existsSync(path.join(tempRoot, 'notes', 'drafts', 'draft-old.json')));
  assert.ok(fs.existsSync(path.join(archiveRoot, 'drafts', 'draft-old.json')));
  assert.ok(fs.existsSync(path.join(archiveRoot, 'drafts', 'draft-old.md')));
  assert.ok(fs.existsSync(path.join(tempRoot, 'notes', 'drafts', 'draft-new.json')));

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.mode, 'apply');
  assert.equal(manifest.rule.keep_latest_draft_lineages, 1);
  assert.ok(manifest.archived_files.some((item) => item.source === 'notes/drafts/draft-old.json'));
});

test('archiveNoteArtifacts apply writes manifest even when there are no archive candidates', () => {
  const tempRoot = makeTempProject();
  seedLineage(tempRoot, 'only', '2026-03-21T10:00:00.000Z');

  const result = archiveNoteArtifacts(tempRoot, {
    keepDrafts: 5,
    apply: true,
    now: new Date('2026-03-25T03:30:00.000Z')
  });

  const archiveRoot = path.join(tempRoot, result.archiveRoot);
  const manifestPath = path.join(archiveRoot, 'archive-manifest.json');

  assert.equal(result.archivedFileCount, 0);
  assert.ok(fs.existsSync(manifestPath));

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.mode, 'apply');
  assert.deepEqual(manifest.archived_counts, {
    bundles: 0,
    briefs: 0,
    drafts: 0,
    runs: 0
  });
  assert.deepEqual(manifest.archived_files, []);
});
