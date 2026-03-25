#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { createPublishReady } = require('../src/publish_ready_builder');

function parseArgs(argv) {
  const options = {
    draftId: argv[0] || null,
    preparedBy: null,
    title: null,
    coverText: null,
    bodyMarkdown: null,
    hashtags: null
  };

  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--prepared-by') {
      options.preparedBy = argv[i + 1] || null;
      i += 1;
      continue;
    }
    if (arg === '--title') {
      options.title = argv[i + 1] || null;
      i += 1;
      continue;
    }
    if (arg === '--cover-text') {
      options.coverText = argv[i + 1] || null;
      i += 1;
      continue;
    }
    if (arg === '--body-file') {
      const filePath = argv[i + 1];
      if (!filePath) {
        throw new Error('--body-file requires a file path');
      }
      options.bodyMarkdown = fs.readFileSync(path.resolve(filePath), 'utf8');
      i += 1;
      continue;
    }
    if (arg === '--hashtags') {
      const value = argv[i + 1] || '';
      options.hashtags = value.split(',').map((item) => item.trim()).filter(Boolean);
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printUsage() {
  console.log(JSON.stringify({
    ok: false,
    message: 'Usage: node scripts/create_publish_ready.js <draft_id> [--prepared-by <name>] [--title <text>] [--cover-text <text>] [--body-file <path>] [--hashtags tag1,tag2]'
  }, null, 2));
}

function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const options = parseArgs(process.argv.slice(2));

  if (!options.draftId) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const result = createPublishReady(projectRoot, options);
  console.log(JSON.stringify({
    ok: true,
    draft_id: result.publishReady.draft_id,
    publish_ready_id: result.publishReady.publish_ready_id,
    path: result.filePath,
    source_review_status: result.publishReady.source_review_status
  }, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.log(JSON.stringify({
      ok: false,
      message: error.message
    }, null, 2));
    process.exit(1);
  }
}
