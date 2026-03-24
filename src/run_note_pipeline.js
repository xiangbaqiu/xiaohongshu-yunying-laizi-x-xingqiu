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

function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const configPath = process.argv[2] || path.join(projectRoot, 'note.config.json');
  const config = loadConfig(configPath);
  const rebuildDashboard = config.rebuild_dashboard !== false;

  try {
    const bundle = buildBundle({
      baseDir: projectRoot,
      accounts: config.accounts,
      theme: config.theme,
      topK: config.top_k,
      originalOnly: config.original_only !== false
    });

    const bundlePath = writeBundle(projectRoot, bundle);
    const brief = buildBrief(bundle);
    const briefPath = writeBrief(projectRoot, brief);
    const draft = composeDraft({
      brief,
      bundle,
      style: config.style
    });
    const draftJsonPath = writeDraft(projectRoot, draft);
    const draftMdPath = writeDraftMarkdown(projectRoot, draft);

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

    const runSummaryPath = writeRunSummary(projectRoot, runSummary);

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
  } catch (error) {
    console.log(JSON.stringify({
      ok: false,
      stage: 'artifact_write_failed',
      message: error.message
    }, null, 2));
    process.exitCode = 1;
  }
}

main();
