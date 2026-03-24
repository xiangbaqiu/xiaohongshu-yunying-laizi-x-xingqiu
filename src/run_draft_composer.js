#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { composeDraft } = require('./draft_composer');
const { writeDraft, writeDraftMarkdown } = require('./note_artifact_io');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const briefPathArg = process.argv[2];
  const bundlePathArg = process.argv[3];
  const style = process.argv[4] || 'trend-analysis';

  if (!briefPathArg || !bundlePathArg) {
    console.log(JSON.stringify({
      ok: false,
      message: 'Usage: node src/run_draft_composer.js <brief-json-path> <bundle-json-path> [style]'
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  const brief = loadJson(path.resolve(briefPathArg));
  const bundle = loadJson(path.resolve(bundlePathArg));
  const draft = composeDraft({ brief, bundle, style });
  const draftJsonPath = writeDraft(projectRoot, draft);
  const draftMdPath = writeDraftMarkdown(projectRoot, draft);

  console.log(JSON.stringify({
    ok: true,
    draft_id: draft.draft_id,
    brief_id: draft.brief_id,
    bundle_id: draft.bundle_id,
    paths: {
      draftJsonPath,
      draftMdPath
    }
  }, null, 2));
}

main();
