const REVIEW_STATUSES = [
  'draft',
  'reviewing',
  'approved',
  'needs_edit',
  'rejected',
  'published'
];

function normalizeReviewStatus(value) {
  return REVIEW_STATUSES.includes(value) ? value : 'draft';
}

module.exports = {
  REVIEW_STATUSES,
  normalizeReviewStatus
};
