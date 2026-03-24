function formatNum(n) {
  if (n == null) return '-';
  return new Intl.NumberFormat('zh-CN').format(n);
}

function formatTime(s) {
  if (!s) return '-';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString('zh-CN');
}

function formatType(t) {
  const map = {
    original: '原创',
    repost: '转发',
    quote: '引用',
    reply: '回复',
    unknown: '未知'
  };
  return map[t] || t || '-';
}

function renderKpis(overview) {
  const kpis = [
    ['监控账号数', overview.accounts_total],
    ['帖子总数', overview.posts_total],
    ['原创数', overview.originals_total],
    ['笔记草稿数', overview.notes_total]
  ];
  document.getElementById('kpis').innerHTML = kpis
    .map(([label, value]) => `<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div></div>`)
    .join('');
}

function renderAccounts(accounts) {
  document.getElementById('accounts').innerHTML = accounts
    .map((a) => `
      <div class="account-card">
        <h3>@${a.handle}</h3>
        <p>帖子数：${formatNum(a.post_count)} · 原创：${formatNum(a.original_count)}</p>
        <p>转发：${formatNum(a.repost_count)} · 引用：${formatNum(a.quote_count)} · 回复：${formatNum(a.reply_count)}</p>
        <p>最近发帖：${formatTime(a.latest_post_at)}</p>
        <p>平均点赞：${formatNum(a.avg_like)}</p>
        <p>平均浏览：${formatNum(a.avg_view)}</p>
        ${a.top_post ? `<p>最高点赞：<a href="${a.top_post.url}" target="_blank">${formatNum(a.top_post.like)}</a></p>` : ''}
      </div>
    `)
    .join('');
}

function renderTop(elId, items, metricKey) {
  document.getElementById(elId).innerHTML = items
    .map((p, idx) => `
      <div class="rank-item">
        <div><strong>#${idx + 1}</strong> @${p.account || p.display_author_handle || p.author_handle}</div>
        <div class="sub">类型：${formatType(p.content_type)}</div>
        <div class="sub">${(p.text || '').slice(0, 120)}</div>
        <div class="sub">${metricKey}：${formatNum(p.metrics?.[metricKey])} · <a href="${p.url}" target="_blank">查看原帖</a></div>
      </div>
    `)
    .join('');
}

function renderNotes(notes) {
  document.getElementById('notesList').innerHTML = (notes || [])
    .map((note) => `
      <div class="note-card">
        <h3>${(note.title_options && note.title_options[0]) || '未命名草稿'}</h3>
        <div class="note-meta">主题：${note.theme || '-'} · 风格：${note.style || '-'} · 状态：${note.status || 'draft'} · 生成时间：${formatTime(note.created_at)}</div>
        <div class="note-meta">Draft：${note.draft_id || '-'} · Brief：${note.brief_id || '-'} · Bundle：${note.bundle_id || '-'}</div>
        <div class="note-preview">${String(note.body_markdown || '').slice(0, 300).replace(/</g, '&lt;')}${String(note.body_markdown || '').length > 300 ? '...' : ''}</div>
        <div class="note-tags">来源帖子数：${(note.source_posts || []).length} · 标签：${(note.hashtags || []).join(' ')}</div>
        ${note.bundle_preview ? `<div class="note-meta">Bundle预览：核心帖子 @${note.bundle_preview.core_post?.account || '-'} · supporting ${note.bundle_preview.supporting_count || 0} 条</div>` : ''}
        ${note.brief_preview ? `<div class="note-meta">Brief预览：${(note.brief_preview.core_angle || '').replace(/</g, '&lt;').slice(0, 100)}</div>` : ''}
      </div>
    `)
    .join('');
}

function renderPosts(posts) {
  document.getElementById('postsTable').innerHTML = posts
    .map((p) => `
      <tr>
        <td>${formatTime(p.created_at)}</td>
        <td>@${p.account || p.display_author_handle || p.author_handle || '-'}</td>
        <td class="text-cell">${(p.text || '').replace(/</g, '&lt;')}</td>
        <td>${formatType(p.content_type)}</td>
        <td>${formatNum(p.metrics?.like)}</td>
        <td>${formatNum(p.metrics?.repost)}</td>
        <td>${formatNum(p.metrics?.reply)}</td>
        <td>${formatNum(p.metrics?.view)}</td>
        <td><a href="${p.url}" target="_blank">原帖</a></td>
      </tr>
    `)
    .join('');
}

function setupFilters(data) {
  const searchInput = document.getElementById('searchInput');
  const accountFilter = document.getElementById('accountFilter');
  const typeFilter = document.getElementById('typeFilter');

  for (const acc of data.accounts) {
    const option = document.createElement('option');
    option.value = acc.handle;
    option.textContent = '@' + acc.handle;
    accountFilter.appendChild(option);
  }

  const apply = () => {
    const q = searchInput.value.trim().toLowerCase();
    const account = accountFilter.value;
    const type = typeFilter.value;
    const filtered = data.posts.filter((p) => {
      const handle = p.account || p.timeline_owner || p.display_author_handle || p.author_handle;
      const okAccount = !account || handle === account;
      const okType = !type || (p.content_type || 'unknown') === type;
      const okText = !q || (p.text || '').toLowerCase().includes(q);
      return okAccount && okType && okText;
    });
    renderPosts(filtered);
  };

  searchInput.addEventListener('input', apply);
  accountFilter.addEventListener('change', apply);
  typeFilter.addEventListener('change', apply);
  apply();
}

fetch('../data/dashboard/dashboard-data.json')
  .then((r) => r.json())
  .then((data) => {
    document.getElementById('generatedAt').textContent = '数据生成时间：' + formatTime(data.generated_at);
    renderKpis(data.overview);
    renderAccounts(data.accounts);
    renderNotes(data.notes || []);
    renderTop('topLiked', data.top_lists.liked, 'like');
    renderTop('topViewed', data.top_lists.viewed, 'view');
    setupFilters(data);
  })
  .catch((err) => {
    document.getElementById('generatedAt').textContent = '数据加载失败：' + err.message;
  });
