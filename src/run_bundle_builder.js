#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { buildBundle } = require('./bundle_builder');
const { writeBundle } = require('./note_artifact_io');

function loadConfig(configPath) {
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const configPath = process.argv[2] || path.join(projectRoot, 'note.config.json');
  const config = loadConfig(configPath);

  const bundle = buildBundle({
    baseDir: projectRoot,
    accounts: config.accounts,
    theme: config.theme,
    topK: config.top_k,
    originalOnly: config.original_only !== false
  });

  const bundlePath = writeBundle(projectRoot, bundle);

  console.log(JSON.stringify({
    ok: true,
    bundle_id: bundle.bundle_id,
    path: bundlePath
  }, null, 2));
}

main();
