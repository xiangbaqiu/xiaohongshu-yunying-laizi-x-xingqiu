#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { recordPublishResult } = require('../src/publish_record_store');

function parseArgs(argv) {
  const options = {
    draftId: argv[0] || null,
    publishedBy: null,
    publishedAt: null,
    platform: null,
    platformUrl: null,
    platformPostId: null,
    note: null,
    finalTitle: null,
    finalBodyMarkdown: null,
    finalHashtags: null
  };

  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--published-by') {
      options.publishedBy = argv[i + 1] || null;
      i += 1;
      continue;
    }
    if (arg === '--published-at') {
      options.publishedAt = argv[i + 1] || null;
      i += 1;
      continue;
    }
    if (arg === '--platform') {
      options.platform = argv[i + 1] || null;
      i += 1;
      continue;
    }
    if (arg === '--platform-url') {
      options.platformUrl = argv[i + 1] || null;
      i += 1;
      continue;
    }
    if (arg === '--platform-post-id') {
      options.platformPostId = argv[i + 1] || null;
      i += 1;
      continue;
    }
    if (arg === '--note') {
      options.note = argv[i + 1] || null;
      i += 1;
      continue;
    }
    if (arg === '--final-title') {
      options.finalTitle = argv[i + 1] || null;
      i += 1;
      continue;
    }
    if (arg === '--final-body-file') {
      const filePath = argv[i + 1];
      if (!filePath) {
        throw new Error('--final-body-file requires a file path');
      }
      options.finalBodyMarkdown = fs.readFileSync(path.resolve(filePath), 'utf8');
      i += 1;
      continue;
    }
    if (arg === '--final-hashtags') {
      const value = argv[i + 1] || '';
      options.finalHashtags = value.split(',').map((item) => item.trim()).filter(Boolean);
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
    message: 'Usage: node scripts/record_publish_result.js <draft_id> --published-by <name> --platform-url <url> [--published-at <iso>] [--platform <name>] [--platform-post-id <id>] [--note <text>] [--final-title <text>] [--final-body-file <path>] [--final-hashtags tag1,tag2]'
  }, null, 2));
}

function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const options = parseArgs(process.argv.slice(2));

  if (!options.draftId || !options.publishedBy || !options.platformUrl) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const result = recordPublishResult(projectRoot, options);
  console.log(JSON.stringify({
    ok: true,
    draft_id: result.draft.draft_id,
    publish_record_id: result.publishRecord.publish_record_id,
    path: result.publishRecordPath,
    published_at: result.publishRecord.published_at,
    published_url: result.publishRecord.platform_post_url
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
