#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { selectPostBundle } = require('./select_posts');
const { distillBundle } = require('./distill_posts');
const { composeNote } = require('./compose_note');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function writeText(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const configPath = process.argv[2] || path.join(projectRoot, 'note.config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  const selection = selectPostBundle({
    baseDir: projectRoot,
    accounts: config.accounts,
    theme: config.theme,
    topK: config.top_k,
    originalOnly: config.original_only !== false
  });

  const brief = distillBundle(selection);
  const note = composeNote(brief, selection, { style: config.style });

  const selectionPath = path.join(projectRoot, 'notes', 'selections', `${selection.selection_id}.json`);
  const briefPath = path.join(projectRoot, 'notes', 'briefs', `${brief.brief_id}.json`);
  const noteJsonPath = path.join(projectRoot, 'notes', 'drafts', `${note.note_id}.json`);
  const noteMdPath = path.join(projectRoot, 'notes', 'drafts', `${note.note_id}.md`);

  writeJson(selectionPath, selection);
  writeJson(briefPath, brief);
  writeJson(noteJsonPath, note);
  writeText(noteMdPath, note.body_markdown);

  console.log(JSON.stringify({
    ok: true,
    selection_id: selection.selection_id,
    brief_id: brief.brief_id,
    note_id: note.note_id,
    paths: {
      selectionPath,
      briefPath,
      noteJsonPath,
      noteMdPath
    }
  }, null, 2));
}

main();
