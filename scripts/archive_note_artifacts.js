#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ARTIFACT_TYPES = ['bundles', 'briefs', 'drafts', 'runs'];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readArtifactDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const filePath = path.join(dir, name);
      return {
        filePath,
        fileName: name,
        payload: readJson(filePath)
      };
    });
}

function parseArgs(argv) {
  const options = {
    keepDrafts: 20,
    apply: false,
    json: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') {
      options.apply = true;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--keep-drafts') {
      const value = Number(argv[i + 1]);
      if (!Number.isInteger(value) || value < 0) {
        throw new Error('--keep-drafts must be a non-negative integer');
      }
      options.keepDrafts = value;
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function buildArchiveId(now = new Date()) {
  return `archive-${now.toISOString().replace(/[:.]/g, '-').replace('T', '_')}`;
}

function sortByCreatedDesc(items, getDateValue) {
  return [...items].sort((a, b) => {
    const aValue = new Date(getDateValue(a) || 0).getTime();
    const bValue = new Date(getDateValue(b) || 0).getTime();
    return bValue - aValue;
  });
}

function collectArtifacts(projectRoot) {
  const notesRoot = path.join(projectRoot, 'notes');
  return {
    notesRoot,
    drafts: readArtifactDir(path.join(notesRoot, 'drafts')),
    briefs: readArtifactDir(path.join(notesRoot, 'briefs')),
    bundles: readArtifactDir(path.join(notesRoot, 'bundles')),
    runs: readArtifactDir(path.join(notesRoot, 'runs'))
  };
}

function buildKeepSets({ drafts, runs, keepDrafts }) {
  const sortedDrafts = sortByCreatedDesc(drafts, (item) => item.payload.created_at);
  const keptDrafts = sortedDrafts.slice(0, keepDrafts);
  const keptDraftIds = new Set(keptDrafts.map((item) => item.payload.draft_id).filter(Boolean));
  const keptBriefIds = new Set();
  const keptBundleIds = new Set();
  const keptRunIds = new Set();

  for (const draft of keptDrafts) {
    if (draft.payload.brief_id) keptBriefIds.add(draft.payload.brief_id);
    if (draft.payload.bundle_id) keptBundleIds.add(draft.payload.bundle_id);
    if (draft.payload.source_brief_id) keptBriefIds.add(draft.payload.source_brief_id);
    if (draft.payload.source_bundle_id) keptBundleIds.add(draft.payload.source_bundle_id);
  }

  for (const run of runs) {
    if (run.payload.draft_id && keptDraftIds.has(run.payload.draft_id)) {
      keptRunIds.add(run.payload.run_id);
    }
  }

  return {
    keptDraftIds,
    keptBriefIds,
    keptBundleIds,
    keptRunIds
  };
}

function listArchiveCandidates(artifacts, keepSets) {
  const candidates = [];

  for (const draft of artifacts.drafts) {
    const draftId = draft.payload.draft_id;
    if (!keepSets.keptDraftIds.has(draftId)) {
      candidates.push({
        type: 'drafts',
        id: draftId,
        filePath: draft.filePath,
        fileName: draft.fileName
      });

      const markdownPath = draft.filePath.replace(/\.json$/, '.md');
      if (fs.existsSync(markdownPath)) {
        candidates.push({
          type: 'drafts',
          id: draftId,
          filePath: markdownPath,
          fileName: path.basename(markdownPath)
        });
      }
    }
  }

  for (const brief of artifacts.briefs) {
    const briefId = brief.payload.brief_id;
    if (!keepSets.keptBriefIds.has(briefId)) {
      candidates.push({
        type: 'briefs',
        id: briefId,
        filePath: brief.filePath,
        fileName: brief.fileName
      });
    }
  }

  for (const bundle of artifacts.bundles) {
    const bundleId = bundle.payload.bundle_id || bundle.payload.selection_id;
    if (!keepSets.keptBundleIds.has(bundleId)) {
      candidates.push({
        type: 'bundles',
        id: bundleId,
        filePath: bundle.filePath,
        fileName: bundle.fileName
      });
    }
  }

  for (const run of artifacts.runs) {
    const runId = run.payload.run_id;
    if (!keepSets.keptRunIds.has(runId)) {
      candidates.push({
        type: 'runs',
        id: runId,
        filePath: run.filePath,
        fileName: run.fileName
      });
    }
  }

  return candidates;
}

function summarizeCandidates(candidates) {
  return ARTIFACT_TYPES.reduce((acc, type) => {
    acc[type] = candidates.filter((item) => item.type === type).length;
    return acc;
  }, {});
}

function archiveNoteArtifacts(projectRoot, options = {}) {
  const keepDrafts = options.keepDrafts ?? 20;
  const apply = Boolean(options.apply);
  const now = options.now || new Date();
  const archiveId = buildArchiveId(now);
  const artifacts = collectArtifacts(projectRoot);
  const keepSets = buildKeepSets({ ...artifacts, keepDrafts });
  const candidates = listArchiveCandidates(artifacts, keepSets);
  const summary = summarizeCandidates(candidates);
  const archiveRoot = path.join(artifacts.notesRoot, 'archive', archiveId);

  const manifest = {
    archive_id: archiveId,
    created_at: now.toISOString(),
    mode: apply ? 'apply' : 'dry-run',
    rule: {
      keep_latest_draft_lineages: keepDrafts,
      archive_scope: 'archive any bundle/brief/draft/run artifact not referenced by the kept draft lineages'
    },
    kept: {
      draft_ids: [...keepSets.keptDraftIds],
      brief_ids: [...keepSets.keptBriefIds],
      bundle_ids: [...keepSets.keptBundleIds],
      run_ids: [...keepSets.keptRunIds]
    },
    archived_counts: summary,
    archived_files: candidates.map((item) => ({
      type: item.type,
      id: item.id,
      source: path.relative(projectRoot, item.filePath),
      destination: path.relative(projectRoot, path.join(archiveRoot, item.type, item.fileName))
    }))
  };

  if (apply) {
    ensureDir(archiveRoot);

    if (candidates.length > 0) {
      for (const type of ARTIFACT_TYPES) {
        ensureDir(path.join(archiveRoot, type));
      }

      for (const candidate of candidates) {
        fs.renameSync(candidate.filePath, path.join(archiveRoot, candidate.type, candidate.fileName));
      }
    }

    fs.writeFileSync(
      path.join(archiveRoot, 'archive-manifest.json'),
      JSON.stringify(manifest, null, 2) + '\n',
      'utf8'
    );
  }

  return {
    ok: true,
    apply,
    archiveRoot: path.relative(projectRoot, archiveRoot),
    keepDrafts,
    archivedCounts: summary,
    archivedFileCount: candidates.length,
    manifest
  };
}

function printSummary(result) {
  const lines = [
    result.apply ? 'Archive apply mode completed.' : 'Archive dry-run completed.',
    `Keep latest draft lineages: ${result.keepDrafts}`,
    `Archive root: ${result.archiveRoot}`,
    `Archived files: ${result.archivedFileCount}`,
    `  bundles: ${result.archivedCounts.bundles}`,
    `  briefs: ${result.archivedCounts.briefs}`,
    `  drafts: ${result.archivedCounts.drafts}`,
    `  runs: ${result.archivedCounts.runs}`
  ];

  if (!result.apply) {
    lines.push('No files were moved. Re-run with --apply to archive the candidates.');
  }

  console.log(lines.join('\n'));
}

function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const options = parseArgs(process.argv.slice(2));
  const result = archiveNoteArtifacts(projectRoot, options);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printSummary(result);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  archiveNoteArtifacts,
  buildArchiveId,
  buildKeepSets,
  collectArtifacts,
  listArchiveCandidates,
  parseArgs
};
