const { buildBrief } = require('./brief_builder');

function distillBundle(bundle) {
  return buildBrief(bundle);
}

module.exports = {
  distillBundle,
  buildBrief
};
