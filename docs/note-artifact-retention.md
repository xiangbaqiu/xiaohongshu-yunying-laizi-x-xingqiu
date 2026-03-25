# Note Artifact Retention Rules

## Goal

Keep the active `notes/` working set small enough for day-to-day review while preserving historical artifacts in a recoverable archive.

## First-pass rule

The current rule is intentionally simple and safe:

1. Keep the latest `N` draft lineages in the active `notes/` directories.
2. A kept draft lineage includes:
   - `notes/drafts/<draft_id>.json`
   - `notes/drafts/<draft_id>.md` if present
   - the linked `brief_id`
   - the linked `bundle_id`
   - any `run` artifact that references the kept `draft_id`
3. Any bundle / brief / draft / run artifact not referenced by those kept lineages is treated as historical and becomes an archive candidate.

Default `N` is `20`, but operators can override it.

## Safety model

- The archive flow is **dry-run by default**
- Files are **never deleted automatically**
- `--apply` moves files into `notes/archive/<archive-id>/...`
- Every apply run writes an `archive-manifest.json` with:
  - the retention rule used
  - the kept lineage IDs
  - the exact source and destination of each archived file

This keeps historical artifacts recoverable and auditable.

## Commands

Preview what would be archived:

```bash
node scripts/archive_note_artifacts.js --keep-drafts 20
```

Apply the archive:

```bash
node scripts/archive_note_artifacts.js --keep-drafts 20 --apply
```

Machine-readable preview:

```bash
node scripts/archive_note_artifacts.js --keep-drafts 20 --json
```

## Restore flow

To restore archived artifacts, move the files listed in the relevant `archive-manifest.json` back into:

- `notes/bundles/`
- `notes/briefs/`
- `notes/drafts/`
- `notes/runs/`

The first-pass goal is safe archiving, not aggressive deletion. Restore therefore stays explicit and operator-driven.
