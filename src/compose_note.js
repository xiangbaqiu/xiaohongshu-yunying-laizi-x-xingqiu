const { composeDraft } = require('./draft_composer');

function composeNote(brief, selection, options = {}) {
  return composeDraft({
    brief,
    bundle: selection,
    style: options.style
  });
}

module.exports = {
  composeNote,
  composeDraft
};
