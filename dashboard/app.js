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

function escapeHtml(text) {
  return String(text || '').replace(/</g, '&lt;');
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
        <div class="sub">${escapeHtml((p.text || '').slice(0, 120))}</div>
        <div class="sub">${metricKey}：${formatNum(p.metrics?.[metricKey])} · <a href="${p.url}" target="_blank">查看原帖</a></div>
      </div>
    `)
    .join('');
}

function renderReviewStatus(status) {
  const map = {
    draft: '草稿',
    reviewing: '审核中',
    approved: '已通过',
    needs_edit: '待修改',
    rejected: '已拒绝',
    published: '已发布'
  };
  return map[status] || status || '草稿';
}

const appState = {
  data: null,
  apiAvailable: false,
  postFilters: {
    query: '',
    account: '',
    type: 'original'
  },
  noteFilters: {
    theme: '',
    style: '',
    reviewStatus: ''
  },
  pendingDraftId: null,
  feedback: ''
};

function renderModeBadge() {
  const badge = document.getElementById('dashboardMode');
  badge.textContent = appState.apiAvailable ? '可操作模式' : '只读模式';
  badge.className = `mode-badge ${appState.apiAvailable ? 'live' : 'readonly'}`;
}

function renderFeedback() {
  document.getElementById('actionFeedback').textContent = appState.feedback || '';
}

function renderReviewActions(note) {
  if (!appState.apiAvailable) {
    return '<div class="review-actions hint">当前是只读模式。请用 `node scripts/dashboard_server.js` 打开 dashboard 以启用审核操作。</div>';
  }

  const actions = [
    ['reviewing', '标记审核中'],
    ['approved', '标记通过'],
    ['needs_edit', '标记待修改'],
    ['rejected', '标记拒绝']
  ];

  return `
    <div class="review-actions">
      ${actions.map(([status, label]) => `
        <button
          type="button"
          class="review-action ${note.review_status === status ? 'active' : ''}"
          data-draft-id="${note.draft_id}"
          data-review-status="${status}"
          ${appState.pendingDraftId === note.draft_id ? 'disabled' : ''}
        >
          ${label}
        </button>
      `).join('')}
    </div>
  `;
}

function renderNotes(notes) {
  document.getElementById('notesList').innerHTML = (notes || [])
    .map((note) => `
      <div class="note-card">
        <h3>${escapeHtml((note.title_options && note.title_options[0]) || '未命名草稿')}</h3>
        <div class="note-meta">主题：${note.theme || '-'} · 风格：${note.style || '-'} · 状态：${note.status || 'draft'} · 审核状态：<span class="status-chip">${renderReviewStatus(note.review_status)}</span> · 生成时间：${formatTime(note.created_at)}</div>
        <div class="note-meta">Draft：${note.draft_id || '-'} · Brief：${note.brief_id || '-'} · Bundle：${note.bundle_id || '-'} · Run：${note.run_id || '-'}</div>
        <div class="note-preview">${escapeHtml(String(note.body_markdown || '').slice(0, 300))}${String(note.body_markdown || '').length > 300 ? '...' : ''}</div>
        <div class="note-tags">来源帖子数：${note.source_post_count || 0} · 标签：${(note.hashtags || []).join(' ')}</div>
        ${renderReviewActions(note)}
        ${note.bundle_preview ? `
          <div class="detail-block">
            <div class="detail-title">Bundle 预览</div>
            <div class="note-meta">候选数：${note.bundle_preview.candidate_count || 0} · supporting：${note.bundle_preview.supporting_count || 0}</div>
            <div class="note-meta">核心帖子：@${note.bundle_preview.core_post?.account || '-'} ${escapeHtml((note.bundle_preview.core_post?.text || '').slice(0, 120))}</div>
          </div>
        ` : ''}
        ${note.brief_preview ? `
          <div class="detail-block">
            <div class="detail-title">Brief 预览</div>
            <div class="note-meta">Claims：${note.brief_preview.claims_count || 0} · Supporting Points：${note.brief_preview.supporting_points_count || 0}</div>
            <div class="note-meta">核心角度：${escapeHtml((note.brief_preview.core_angle || '').slice(0, 160))}</div>
            <div class="note-meta">总结：${escapeHtml((note.brief_preview.final_takeaway || '').slice(0, 160))}</div>
          </div>
        ` : ''}
        ${note.run_preview ? `
          <div class="detail-block">
            <div class="detail-title">Run 预览</div>
            <div class="note-meta">Run：${note.run_preview.run_id || '-'} · 生成时间：${formatTime(note.run_preview.created_at)}</div>
            <div class="note-meta">Dashboard rebuild：${note.run_preview.dashboard_attempted ? (note.run_preview.dashboard_ok ? '成功' : '失败') : '未执行'}</div>
          </div>
        ` : ''}
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
        <td class="text-cell">${escapeHtml(p.text || '')}</td>
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

function renderPostsFromState() {
  if (!appState.data) return;
  const filtered = appState.data.posts.filter((p) => {
    const handle = p.account || p.timeline_owner || p.display_author_handle || p.author_handle;
    const okAccount = !appState.postFilters.account || handle === appState.postFilters.account;
    const okType = !appState.postFilters.type || (p.content_type || 'unknown') === appState.postFilters.type;
    const okText = !appState.postFilters.query || (p.text || '').toLowerCase().includes(appState.postFilters.query);
    return okAccount && okType && okText;
  });
  renderPosts(filtered);
}

function renderNotesFromState() {
  if (!appState.data) return;
  const filtered = (appState.data.notes || []).filter((note) => {
    const okTheme = !appState.noteFilters.theme || note.theme === appState.noteFilters.theme;
    const okStyle = !appState.noteFilters.style || note.style === appState.noteFilters.style;
    const okReviewStatus = !appState.noteFilters.reviewStatus || note.review_status === appState.noteFilters.reviewStatus;
    return okTheme && okStyle && okReviewStatus;
  });
  renderNotes(filtered);
}

function setupPostFilters(data) {
  const searchInput = document.getElementById('searchInput');
  const accountFilter = document.getElementById('accountFilter');
  const typeFilter = document.getElementById('typeFilter');

  accountFilter.innerHTML = '<option value="">全部账号</option>';
  for (const acc of data.accounts) {
    const option = document.createElement('option');
    option.value = acc.handle;
    option.textContent = '@' + acc.handle;
    accountFilter.appendChild(option);
  }

  searchInput.value = appState.postFilters.query;
  accountFilter.value = appState.postFilters.account;
  typeFilter.value = appState.postFilters.type;

  searchInput.oninput = () => {
    appState.postFilters.query = searchInput.value.trim().toLowerCase();
    renderPostsFromState();
  };
  accountFilter.onchange = () => {
    appState.postFilters.account = accountFilter.value;
    renderPostsFromState();
  };
  typeFilter.onchange = () => {
    appState.postFilters.type = typeFilter.value;
    renderPostsFromState();
  };

  renderPostsFromState();
}

function setupNoteFilters(data) {
  const themeFilter = document.getElementById('noteThemeFilter');
  const styleFilter = document.getElementById('noteStyleFilter');
  const reviewStatusFilter = document.getElementById('noteReviewStatusFilter');

  themeFilter.innerHTML = '<option value="">全部主题</option>';
  styleFilter.innerHTML = '<option value="">全部风格</option>';
  reviewStatusFilter.innerHTML = '<option value="">全部审核状态</option>';

  for (const theme of data.filters_meta?.note_themes || []) {
    const option = document.createElement('option');
    option.value = theme;
    option.textContent = theme;
    themeFilter.appendChild(option);
  }

  for (const style of data.filters_meta?.note_styles || []) {
    const option = document.createElement('option');
    option.value = style;
    option.textContent = style;
    styleFilter.appendChild(option);
  }

  for (const status of data.filters_meta?.review_statuses || []) {
    const option = document.createElement('option');
    option.value = status;
    option.textContent = renderReviewStatus(status);
    reviewStatusFilter.appendChild(option);
  }

  themeFilter.value = appState.noteFilters.theme;
  styleFilter.value = appState.noteFilters.style;
  reviewStatusFilter.value = appState.noteFilters.reviewStatus;

  themeFilter.onchange = () => {
    appState.noteFilters.theme = themeFilter.value;
    renderNotesFromState();
  };
  styleFilter.onchange = () => {
    appState.noteFilters.style = styleFilter.value;
    renderNotesFromState();
  };
  reviewStatusFilter.onchange = () => {
    appState.noteFilters.reviewStatus = reviewStatusFilter.value;
    renderNotesFromState();
  };

  renderNotesFromState();
}

async function loadDashboardData() {
  try {
    const response = await fetch('/api/dashboard-data');
    if (!response.ok) throw new Error(`API ${response.status}`);
    appState.apiAvailable = true;
    return await response.json();
  } catch (_error) {
    const fallbackResponse = await fetch('../data/dashboard/dashboard-data.json');
    if (!fallbackResponse.ok) throw new Error(`Dashboard data ${fallbackResponse.status}`);
    appState.apiAvailable = false;
    return await fallbackResponse.json();
  }
}

function renderDashboard(data) {
  appState.data = data;
  document.getElementById('generatedAt').textContent = '数据生成时间：' + formatTime(data.generated_at);
  renderModeBadge();
  renderFeedback();
  renderKpis(data.overview);
  renderAccounts(data.accounts);
  renderTop('topLiked', data.top_lists.liked, 'like');
  renderTop('topViewed', data.top_lists.viewed, 'view');
  setupPostFilters(data);
  setupNoteFilters(data);
}

async function updateReviewStatus(draftId, reviewStatus) {
  appState.pendingDraftId = draftId;
  appState.feedback = '正在更新审核状态…';
  renderFeedback();
  renderNotesFromState();

  try {
    const response = await fetch(`/api/drafts/${encodeURIComponent(draftId)}/review-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review_status: reviewStatus })
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.message || '状态更新失败');
    }

    appState.feedback = `已更新 ${draftId} -> ${renderReviewStatus(payload.review_status)}`;
    const data = await loadDashboardData();
    renderDashboard(data);
  } catch (error) {
    appState.feedback = `状态更新失败：${error.message}`;
    renderFeedback();
  } finally {
    appState.pendingDraftId = null;
    renderNotesFromState();
    renderFeedback();
  }
}

document.getElementById('notesList').addEventListener('click', async (event) => {
  const button = event.target.closest('.review-action');
  if (!button) return;

  await updateReviewStatus(button.dataset.draftId, button.dataset.reviewStatus);
});

loadDashboardData()
  .then((data) => {
    renderDashboard(data);
  })
  .catch((err) => {
    document.getElementById('generatedAt').textContent = '数据加载失败：' + err.message;
    document.getElementById('dashboardMode').textContent = '加载失败';
  });
