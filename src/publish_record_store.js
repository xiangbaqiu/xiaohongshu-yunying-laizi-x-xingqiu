const fs = require('fs');
const path = require('path');
const { writePublishRecord } = require('./note_artifact_io');
const {
  getDraftPath,
  normalizeOptionalText,
  normalizeStringList,
  readDraft
} = require('./publish_ready_builder');
const { normalizeReviewStatus } = require('./review_status');

function getPublishReadyPath(baseDir, draftId) {
  return path.join(baseDir, 'notes', 'publish-ready', `${draftId}.json`);
}

function readPublishReady(baseDir, draftId) {
  const publishReadyPath = getPublishReadyPath(baseDir, draftId);
  if (!fs.existsSync(publishReadyPath)) {
    throw new Error(`Publish-ready payload not found: ${draftId}`);
  }

  return JSON.parse(fs.readFileSync(publishReadyPath, 'utf8'));
}

function writeJsonAtomic(filePath, payload) {
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  fs.renameSync(tempPath, filePath);
}

function normalizeBodyMarkdown(value, fallback = '') {
  if (value == null) return fallback;
  return String(value);
}

function buildPublishRecordId(now = new Date()) {
  return `publish-${now.getTime()}`;
}

function buildPublishAnnotation({ publishedBy, publishedAt, note }) {
  return {
    reviewer_note: note || 'Published to Xiaohongshu',
    edit_suggestion: null,
    rejection_reason: null,
    operator_identity: publishedBy,
    review_status: 'published',
    updated_at: publishedAt
  };
}

function buildPublishRecord({ draft, publishReady, options, publishedAt }) {
  const platform = normalizeOptionalText(options.platform) || 'xiaohongshu';

  return {
    publish_record_id: buildPublishRecordId(new Date(publishedAt)),
    draft_id: draft.draft_id,
    publish_ready_id: publishReady.publish_ready_id,
    platform,
    published_at: publishedAt,
    published_by: normalizeOptionalText(options.publishedBy),
    platform_post_id: normalizeOptionalText(options.platformPostId),
    platform_post_url: normalizeOptionalText(options.platformUrl),
    final_title: normalizeOptionalText(options.finalTitle) || publishReady.title || null,
    final_body_markdown: normalizeBodyMarkdown(options.finalBodyMarkdown, publishReady.body_markdown || ''),
    final_hashtags: normalizeStringList(options.finalHashtags || publishReady.hashtags),
    notes: normalizeOptionalText(options.note)
  };
}

function recordPublishResult(baseDir, options = {}) {
  const draftId = normalizeOptionalText(options.draftId);
  if (!draftId) {
    throw new Error('draftId is required');
  }

  const publishedBy = normalizeOptionalText(options.publishedBy);
  if (!publishedBy) {
    throw new Error('publishedBy is required');
  }

  const platformUrl = normalizeOptionalText(options.platformUrl);
  if (!platformUrl) {
    throw new Error('platformUrl is required');
  }

  const publishedAtInput = normalizeOptionalText(options.publishedAt);
  const publishedAtDate = publishedAtInput ? new Date(publishedAtInput) : (options.now || new Date());
  if (Number.isNaN(publishedAtDate.getTime())) {
    throw new Error(`Invalid publishedAt: ${options.publishedAt}`);
  }

  const draftPath = getDraftPath(baseDir, draftId);
  const draft = readDraft(baseDir, draftId);
  const publishReady = readPublishReady(baseDir, draftId);
  const previousStatus = normalizeReviewStatus(draft.review_status || draft.status);

  if (previousStatus !== 'approved') {
    throw new Error(`Draft is not approved: ${draftId}`);
  }

  const publishedAt = publishedAtDate.toISOString();
  const publishRecord = buildPublishRecord({
    draft,
    publishReady,
    options: {
      ...options,
      publishedBy,
      platformUrl
    },
    publishedAt
  });
  const annotation = buildPublishAnnotation({
    publishedBy,
    publishedAt,
    note: publishRecord.notes
  });
  const nextHistory = Array.isArray(draft.review_history) ? [...draft.review_history] : [];

  nextHistory.push({
    from: previousStatus,
    to: 'published',
    source: options.source || 'publish_recorder',
    updated_at: publishedAt,
    annotation
  });

  const nextDraft = {
    ...draft,
    review_status: 'published',
    review_updated_at: publishedAt,
    review_annotation: annotation,
    review_history: nextHistory,
    published_at: publishedAt,
    published_by: publishedBy,
    publish_record_id: publishRecord.publish_record_id,
    publish_ready_id: publishReady.publish_ready_id,
    published_platform: publishRecord.platform,
    published_url: platformUrl,
    platform_post_id: publishRecord.platform_post_id
  };

  const publishRecordPath = writePublishRecord(baseDir, publishRecord);
  writeJsonAtomic(draftPath, nextDraft);

  return {
    draftPath,
    draft: nextDraft,
    publishReady,
    publishRecord,
    publishRecordPath,
    previousStatus
  };
}

module.exports = {
  buildPublishAnnotation,
  buildPublishRecord,
  buildPublishRecordId,
  getPublishReadyPath,
  readPublishReady,
  recordPublishResult
};
