const fs = require('fs');
const path = require('path');
const { writePublishReady } = require('./note_artifact_io');
const { normalizeReviewStatus } = require('./review_status');

function getDraftPath(baseDir, draftId) {
  return path.join(baseDir, 'notes', 'drafts', `${draftId}.json`);
}

function readDraft(baseDir, draftId) {
  const draftPath = getDraftPath(baseDir, draftId);
  if (!fs.existsSync(draftPath)) {
    throw new Error(`Draft not found: ${draftId}`);
  }

  return JSON.parse(fs.readFileSync(draftPath, 'utf8'));
}

function normalizeOptionalText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function normalizeStringList(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => normalizeOptionalText(value))
    .filter(Boolean);
}

function buildPublishReadyId(draftId) {
  return `publish-ready-${draftId}`;
}

function pickDefaultTitle(draft) {
  return normalizeOptionalText(Array.isArray(draft.title_options) ? draft.title_options[0] : null);
}

function pickDefaultCoverText(draft) {
  return normalizeOptionalText(Array.isArray(draft.cover_text_options) ? draft.cover_text_options[0] : null);
}

function buildPublishReadyPayload(draft, options = {}) {
  const reviewStatus = normalizeReviewStatus(draft.review_status || draft.status);
  if (reviewStatus !== 'approved') {
    throw new Error(`Draft is not approved: ${draft.draft_id}`);
  }

  const preparedAt = (options.now || new Date()).toISOString();

  return {
    publish_ready_id: buildPublishReadyId(draft.draft_id),
    draft_id: draft.draft_id,
    brief_id: draft.brief_id || draft.source_brief_id || null,
    bundle_id: draft.bundle_id || draft.source_bundle_id || null,
    theme: draft.theme || null,
    style: draft.style || null,
    title: normalizeOptionalText(options.title) || pickDefaultTitle(draft),
    cover_text: normalizeOptionalText(options.coverText) || pickDefaultCoverText(draft),
    body_markdown: normalizeOptionalText(options.bodyMarkdown) || draft.body_markdown || '',
    hashtags: normalizeStringList(options.hashtags || draft.hashtags),
    source_posts: Array.isArray(draft.source_posts) ? draft.source_posts : [],
    review_annotation: draft.review_annotation || null,
    prepared_at: preparedAt,
    prepared_by: normalizeOptionalText(options.preparedBy),
    source_review_status: reviewStatus,
    editable_fields: ['title', 'body_markdown', 'hashtags', 'cover_text']
  };
}

function createPublishReady(baseDir, options = {}) {
  const draftId = normalizeOptionalText(options.draftId);
  if (!draftId) {
    throw new Error('draftId is required');
  }

  const draft = readDraft(baseDir, draftId);
  const publishReady = buildPublishReadyPayload(draft, options);
  const filePath = writePublishReady(baseDir, publishReady);

  return {
    draft,
    publishReady,
    filePath
  };
}

module.exports = {
  buildPublishReadyId,
  buildPublishReadyPayload,
  createPublishReady,
  getDraftPath,
  normalizeOptionalText,
  normalizeStringList,
  readDraft
};
