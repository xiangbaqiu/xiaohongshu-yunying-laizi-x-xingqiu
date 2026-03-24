function firstSentence(text, fallback = '') {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return fallback;
  const hit = clean.match(/^(.{20,140}?[。.!?！？]|.{20,140})/);
  return hit ? hit[1].trim() : clean.slice(0, 120);
}

function supportRoleToPoint(role) {
  if (role === 'evidence') return '用数据补强这个判断';
  if (role === 'comparison') return '补充对比关系，说明变化方向';
  if (role === 'example') return '补一个工作流或产品案例';
  return '补一个相关讨论，避免论点过单';
}

function buildBrief(bundle) {
  const core = bundle.bundle?.core_post || null;
  const supporting = bundle.bundle?.supporting_posts || [];

  const claims = [];
  if (core) {
    claims.push({
      claim: firstSentence(core.text, '核心讨论值得作为整篇笔记的切入点'),
      evidence_post_ids: [core.tweet_id]
    });
  }

  for (const post of supporting.slice(0, 3)) {
    claims.push({
      claim: supportRoleToPoint(post.support_role),
      evidence_post_ids: [post.tweet_id]
    });
  }

  const briefId = `brief-${Date.now()}`;

  return {
    brief_id: briefId,
    bundle_id: bundle.bundle_id || null,
    theme: bundle.theme,
    core_angle: `围绕 ${bundle.theme}，从一条主观点出发，再用多条帖子补数据、对比和案例，整合成一篇更适合小红书阅读的笔记。`,
    narrative_structure: {
      hook_from_core_post: core ? firstSentence(core.text, '先用一个明确观点开场') : '先用主题切入',
      supporting_points: supporting.map((post) => ({
        tweet_id: post.tweet_id,
        account: post.account,
        support_role: post.support_role,
        point: supportRoleToPoint(post.support_role)
      })),
      final_takeaway: core
        ? `这组内容共同说明：${bundle.theme} 不是一条孤立讨论，而是可以被整理成一个更完整的趋势判断。`
        : `围绕 ${bundle.theme} 的当前素材还不够完整，但方向已经明确，可以继续补充。`
    },
    claims,
    audience_takeaway: core
      ? [
          '不要只看单条热帖，要看多条内容共同指向什么。',
          '把 X 上的碎片讨论整合后，才更适合转成中文平台的内容。'
        ]
      : [],
    source_bundle: {
      core_post_id: core?.tweet_id || null,
      supporting_post_ids: supporting.map((post) => post.tweet_id)
    },
    created_at: new Date().toISOString()
  };
}

module.exports = {
  firstSentence,
  supportRoleToPoint,
  buildBrief
};
