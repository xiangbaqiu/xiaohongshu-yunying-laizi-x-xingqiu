const fs = require('fs');
const path = require('path');
const { REVIEW_STATUSES, normalizeReviewStatus } = require('./review_status');

const DASHBOARD_ACTION_STATUSES = ['reviewing', 'approved', 'needs_edit', 'rejected'];

function getDraftPath(projectRoot, draftId) {
  return path.join(projectRoot, 'notes', 'drafts', `${draftId}.json`);
}

function readDraft(projectRoot, draftId) {
  const draftPath = getDraftPath(projectRoot, draftId);
  if (!fs.existsSync(draftPath)) {
    throw new Error(`Draft not found: ${draftId}`);
  }

  return {
    draftPath,
    draft: JSON.parse(fs.readFileSync(draftPath, 'utf8'))
  };
}

function writeJsonAtomic(filePath, payload) {
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  fs.renameSync(tempPath, filePath);
}

function updateDraftReviewStatus(projectRoot, { draftId, reviewStatus, source = 'dashboard' }) {
  if (!draftId) {
    throw new Error('draftId is required');
  }

  if (!reviewStatus || !REVIEW_STATUSES.includes(reviewStatus)) {
    throw new Error(`Invalid review status: ${reviewStatus}`);
  }

  if (!DASHBOARD_ACTION_STATUSES.includes(reviewStatus)) {
    throw new Error(`Review status is not allowed from dashboard actions: ${reviewStatus}`);
  }

  const { draftPath, draft } = readDraft(projectRoot, draftId);
  const previousStatus = normalizeReviewStatus(draft.review_status || draft.status);
  const updatedAt = new Date().toISOString();
  const nextHistory = Array.isArray(draft.review_history) ? [...draft.review_history] : [];

  nextHistory.push({
    from: previousStatus,
    to: reviewStatus,
    source,
    updated_at: updatedAt
  });

  const nextDraft = {
    ...draft,
    review_status: reviewStatus,
    review_updated_at: updatedAt,
    review_history: nextHistory
  };

  writeJsonAtomic(draftPath, nextDraft);

  return {
    draftPath,
    previousStatus,
    draft: nextDraft
  };
}

module.exports = {
  DASHBOARD_ACTION_STATUSES,
  getDraftPath,
  readDraft,
  updateDraftReviewStatus
};
