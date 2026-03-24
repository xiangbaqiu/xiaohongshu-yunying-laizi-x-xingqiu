#!/usr/bin/env node
const path = require('path');
const { runFromRawBatch } = require('./pipeline');

function main() {
  const rawPath = process.argv[2];
  if (!rawPath) {
    console.error('Usage: node src/run_from_raw.js <raw-batch.json> [account]');
    process.exit(1);
  }

  const account = process.argv[3];
  const result = runFromRawBatch(path.resolve(rawPath), {
    account,
    version: 'mvp-v0.1'
  });

  console.log(JSON.stringify(result, null, 2));
}

main();
