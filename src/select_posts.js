const { readJsonl, scorePost, buildBundle } = require('./bundle_builder');

function selectPostBundle(args) {
  return buildBundle(args);
}

module.exports = {
  selectPostBundle,
  buildBundle,
  readJsonl,
  scorePost
};
