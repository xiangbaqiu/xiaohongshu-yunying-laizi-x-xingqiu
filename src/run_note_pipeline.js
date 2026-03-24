#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildBundle } = require('./bundle_builder');
const { buildBrief } = require('./brief_builder');
const { composeDraft } = require('./draft_composer');
const {
  buildArtifactId,
  writeBundle,
  writeBrief,
  writeDraft,
  writeDraftMarkdown,
  writeRunSummary
} = require('./note_artifact_io');

function loadConfig(configPath) {
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function printAndExit(payload, exitCode = 1) {
  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = exitCode;
}

function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const configPath = process.argv[2] || path.join(projectRoot, 'note.config.json');
  const config = loadConfig(configPath);
  const rebuildDashboard = config.rebuild_dashboard !== false;

  let bundle;
  try {
    bundle = buildBundle({
      baseDir: projectRoot,
      accounts: config.accounts,
      theme: config.theme,
      topK: config.top_k,
      originalOnly: config.original_only !== false
    });
  } catch (error) {
    return printAndExit({ ok: false, stage: 'bundle_build_failed', message: error.message });
  }

  let brief;
  try {
    brief = buildBrief(bundle);
  } catch (error) {
    return printAndExit({ ok: false, stage: 'brief_build_failed', message: error.message });
  }

  let draft;
  try {
    draft = composeDraft({
      brief,
      bundle,
      style: config.style
    });
  } catch (error) {
    return printAndExit({ ok: false, stage: 'draft_compose_failed', message: error.message });
  }

  let bundlePath;
  let briefPath;
  let draftJsonPath;
  let draftMdPath;
  let runSummaryPath;

  try {
    bundlePath = writeBundle(projectRoot, bundle);
    briefPath = writeBrief(projectRoot, brief);
    draftJsonPath = writeDraft(projectRoot, draft);
    draftMdPath = writeDraftMarkdown(projectRoot, draft);
  } catch (error) {
    return printAndExit({ ok: false, stage: 'artifact_write_failed', message: error.message });
  }

  let dashboard = { attempted: rebuildDashboard, ok: false };
  if (rebuildDashboard) {
    try {
      execFileSync('node', [path.join(projectRoot, 'scripts', 'build_dashboard_data.js')], {
        cwd: projectRoot,
        stdio: 'pipe'
      });
      dashboard = { attempted: true, ok: true };
    } catch (error) {
      dashboard = {
        attempted: true,
        ok: false,
        stage: 'dashboard_rebuild_failed',
        message: error.message
      };
    }
  }

  const runSummary = {
    run_id: buildArtifactId('note-run'),
    theme: config.theme,
    bundle_id: bundle.bundle_id,
    brief_id: brief.brief_id,
    draft_id: draft.draft_id,
    paths: {
      bundle_json: path.relative(projectRoot, bundlePath),
      brief_json: path.relative(projectRoot, briefPath),
      draft_json: path.relative(projectRoot, draftJsonPath),
      draft_md: path.relative(projectRoot, draftMdPath)
    },
    dashboard,
    created_at: new Date().toISOString()
  };

  try {
    runSummaryPath = writeRunSummary(projectRoot, runSummary);
  } catch (error) {
    return printAndExit({ ok: false, stage: 'artifact_write_failed', message: error.message });
  }

  console.log(JSON.stringify({
    ok: true,
    run_id: runSummary.run_id,
    bundle_id: bundle.bundle_id,
    brief_id: brief.brief_id,
    draft_id: draft.draft_id,
    paths: {
      bundlePath,
      briefPath,
      draftJsonPath,
      draftMdPath,
      runSummaryPath
    },
    dashboard
  }, null, 2));
}

main();
