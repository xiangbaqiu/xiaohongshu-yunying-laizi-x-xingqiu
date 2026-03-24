#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { buildBrief } = require('./brief_builder');
const { writeBrief } = require('./note_artifact_io');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const bundlePath = process.argv[2];

  if (!bundlePath) {
    console.log(JSON.stringify({
      ok: false,
      message: 'Usage: node src/run_brief_builder.js <bundle-json-path>'
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  const bundle = loadJson(path.resolve(bundlePath));
  const brief = buildBrief(bundle);
  const briefPath = writeBrief(projectRoot, brief);

  console.log(JSON.stringify({
    ok: true,
    brief_id: brief.brief_id,
    bundle_id: brief.bundle_id,
    path: briefPath
  }, null, 2));
}

main();
