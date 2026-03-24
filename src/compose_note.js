function composeTitle(theme) {
  return [
    `我把最近 X 上关于 ${theme} 的讨论，整理成了一篇笔记`,
    `${theme} 最近在聊什么？我看完几条内容后有个判断`
  ];
}

function composeCoverText(theme) {
  return [
    `${theme} 的重点变了`,
    `别只看单条热帖`
  ];
}

function composeNote(brief, selection, options = {}) {
  const style = options.style || 'trend-analysis';
  const core = selection.bundle?.core_post || null;
  const supports = selection.bundle?.supporting_posts || [];

  const intro = `最近我在看 X 上关于「${brief.theme}」的讨论，发现如果只看单条帖子，很容易觉得信息是碎的。但把几条内容放在一起看，结论会清楚很多。`;

  const hook = core
    ? `先说我看到的一个核心点：${brief.narrative_structure?.hook_from_core_post || core.text.slice(0, 100)}`
    : `先说结论：${brief.core_angle}`;

  const supportBlocks = supports
    .map((post, idx) => {
      const roleText =
        post.support_role === 'evidence'
          ? '这条内容最有价值的是它补了数字和事实。'
          : post.support_role === 'comparison'
            ? '这条内容最有价值的是它补了对比关系，能看出变化方向。'
            : post.support_role === 'example'
              ? '这条内容最有价值的是它补了案例和工作流视角。'
              : '这条内容最有价值的是它补了另一个相关角度。';
      return `### ${idx + 1}. 来自 @${post.account} 的补充

${roleText}

${String(post.text || '').slice(0, 220)}...`;
    })
    .join('\n\n');

  const takeaway = `### 我自己的结论\n\n${brief.narrative_structure?.final_takeaway || brief.core_angle}\n\n如果要把 X 上的信息转成小红书内容，重点不是翻译某一条，而是把多条内容整合成一个读者能看懂的判断。`;

  const body = [intro, '', hook, '', supportBlocks, '', takeaway].join('\n');

  return {
    note_id: `note-${Date.now()}`,
    theme: brief.theme,
    style,
    angle: brief.core_angle,
    title_options: composeTitle(brief.theme),
    cover_text_options: composeCoverText(brief.theme),
    body_markdown: body,
    hashtags: ['#AI', '#小红书运营', `#${brief.theme.replace(/\s+/g, '')}`],
    source_selection_id: selection.selection_id,
    source_brief_id: brief.brief_id,
    source_posts: [
      ...(selection.bundle?.core_post ? [{ tweet_id: selection.bundle.core_post.tweet_id, url: selection.bundle.core_post.url }] : []),
      ...(selection.bundle?.supporting_posts || []).map((post) => ({ tweet_id: post.tweet_id, url: post.url }))
    ],
    status: 'draft',
    created_at: new Date().toISOString()
  };
}

module.exports = {
  composeNote
};
