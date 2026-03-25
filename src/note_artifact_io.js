const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  return filePath;
}

function writeText(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

function buildArtifactId(prefix) {
  return `${prefix}-${Date.now()}`;
}

function writeBundle(baseDir, bundle) {
  const filePath = path.join(baseDir, 'notes', 'bundles', `${bundle.bundle_id}.json`);
  return writeJson(filePath, bundle);
}

function writeBrief(baseDir, brief) {
  const filePath = path.join(baseDir, 'notes', 'briefs', `${brief.brief_id}.json`);
  return writeJson(filePath, brief);
}

function writeDraft(baseDir, draft) {
  const filePath = path.join(baseDir, 'notes', 'drafts', `${draft.draft_id}.json`);
  return writeJson(filePath, draft);
}

function writeDraftMarkdown(baseDir, draft) {
  const filePath = path.join(baseDir, 'notes', 'drafts', `${draft.draft_id}.md`);
  return writeText(filePath, draft.body_markdown || '');
}

function writeRunSummary(baseDir, runSummary) {
  const filePath = path.join(baseDir, 'notes', 'runs', `${runSummary.run_id}.json`);
  return writeJson(filePath, runSummary);
}

function writePublishReady(baseDir, publishReady) {
  const filePath = path.join(baseDir, 'notes', 'publish-ready', `${publishReady.draft_id}.json`);
  return writeJson(filePath, publishReady);
}

function writePublishRecord(baseDir, publishRecord) {
  const filePath = path.join(baseDir, 'notes', 'publish-records', `${publishRecord.publish_record_id}.json`);
  return writeJson(filePath, publishRecord);
}

module.exports = {
  ensureDir,
  writeJson,
  writeText,
  buildArtifactId,
  writeBundle,
  writeBrief,
  writeDraft,
  writeDraftMarkdown,
  writeRunSummary,
  writePublishReady,
  writePublishRecord
};
