# Note Pipeline Contracts

本文档定义 note pipeline 各模块的输入输出约定，供工程实现、调试、dashboard 消费，以及后续 agent 化使用。

---

## 1. Pipeline 总览

```text
posts.jsonl
  ↓
BundleBuilder
  ↓
notes/bundles/<bundle_id>.json
  ↓
BriefBuilder
  ↓
notes/briefs/<brief_id>.json
  ↓
DraftComposer
  ↓
notes/drafts/<draft_id>.json
notes/drafts/<draft_id>.md
  ↓
notes/runs/<run_id>.json
  ↓
dashboard-data.json
```

---

## 2. BundleBuilder

### 职责

只负责：

- 读取结构化 posts
- 按 theme / account / filter 选候选内容
- 打分、排序、组合 bundle
- 输出 bundle artifact

不负责：

- 写小红书正文
- 生成 brief
- 决定最终发布内容

### 建议函数签名

```js
buildBundle({
  baseDir,
  accounts,
  theme,
  topK,
  originalOnly
})
```

### 输入 contract

```json
{
  "baseDir": "/abs/path/to/project",
  "accounts": ["sama", "elonmusk"],
  "theme": "AI coding",
  "topK": 4,
  "originalOnly": true
}
```

### 输出 contract

```json
{
  "bundle_id": "bundle-1742790000000",
  "theme": "AI coding",
  "bundle_strategy": "one-core-plus-supporting-posts",
  "selection_strategy": {
    "original_only": true,
    "top_k": 4,
    "sort_by": ["theme_score", "engagement_score", "recency_score", "length_score"]
  },
  "candidate_count": 28,
  "bundle": {
    "core_post": {
      "tweet_id": "123",
      "account": "sama",
      "url": "https://x.com/...",
      "text": "...",
      "reason": "主观点最完整，最适合作为整篇笔记切入点",
      "scores": {
        "themeScore": 0.8,
        "engagementScore": 1234,
        "recencyScore": 0.17,
        "lengthScore": 0.72,
        "finalScore": 88.2
      }
    },
    "supporting_posts": [
      {
        "tweet_id": "456",
        "account": "elonmusk",
        "url": "https://x.com/...",
        "text": "...",
        "support_role": "comparison",
        "reason": "补对比和变化",
        "scores": {
          "themeScore": 0.5,
          "engagementScore": 900,
          "recencyScore": 0.15,
          "lengthScore": 0.64,
          "finalScore": 61.3
        }
      }
    ]
  },
  "created_at": "2026-03-24T13:00:00.000Z"
}
```

### 空结果约定

当没有候选内容时，返回合法空 bundle，不应直接 silent fail：

```json
{
  "bundle_id": "bundle-1742790000000",
  "theme": "AI coding",
  "bundle_strategy": "one-core-plus-supporting-posts",
  "selection_strategy": {
    "original_only": true,
    "top_k": 4,
    "sort_by": ["theme_score", "engagement_score", "recency_score", "length_score"]
  },
  "candidate_count": 0,
  "bundle": {
    "core_post": null,
    "supporting_posts": []
  },
  "created_at": "2026-03-24T13:00:00.000Z"
}
```

### 落盘路径

```text
notes/bundles/<bundle_id>.json
```

---

## 3. BriefBuilder

### 职责

只负责：

- 读取 bundle
- 提炼核心角度
- 形成 narrative structure
- 输出写作策略 brief

不负责：

- 生成完整正文
- 回头改 bundle

### 建议函数签名

```js
buildBrief(bundle)
```

### 输入 contract

```json
{
  "bundle_id": "bundle-1742790000000",
  "theme": "AI coding",
  "bundle": {
    "core_post": {
      "tweet_id": "123",
      "account": "sama",
      "url": "https://x.com/...",
      "text": "..."
    },
    "supporting_posts": []
  }
}
```

### 输出 contract

```json
{
  "brief_id": "brief-1742790000100",
  "bundle_id": "bundle-1742790000000",
  "theme": "AI coding",
  "core_angle": "围绕 AI coding，从一条主观点切入，再用多条帖子补数据、对比和案例。",
  "narrative_structure": {
    "hook_from_core_post": "...",
    "supporting_points": [
      {
        "tweet_id": "456",
        "account": "elonmusk",
        "support_role": "comparison",
        "point": "补充对比关系，说明变化方向"
      }
    ],
    "final_takeaway": "这组内容共同说明：AI coding 不是孤立讨论，而是可以整理成一个更完整的趋势判断。"
  },
  "claims": [
    {
      "claim": "...",
      "evidence_post_ids": ["123"]
    }
  ],
  "audience_takeaway": [
    "不要只看单条热帖，要看多条内容共同指向什么。",
    "把 X 上的碎片讨论整合后，才更适合转成中文平台的内容。"
  ],
  "source_bundle": {
    "core_post_id": "123",
    "supporting_post_ids": ["456"]
  },
  "created_at": "2026-03-24T13:00:05.000Z"
}
```

### 空 bundle fallback 约定

即使 `core_post = null`，也应返回合法 brief：

```json
{
  "brief_id": "brief-1742790000100",
  "bundle_id": "bundle-1742790000000",
  "theme": "AI coding",
  "core_angle": "围绕 AI coding 整理多条讨论，形成适合小红书表达的结构化判断。",
  "narrative_structure": {
    "hook_from_core_post": "先用主题切入",
    "supporting_points": [],
    "final_takeaway": "当前素材不足，但主题方向仍可继续补充。"
  },
  "claims": [],
  "audience_takeaway": [],
  "source_bundle": {
    "core_post_id": null,
    "supporting_post_ids": []
  },
  "created_at": "2026-03-24T13:00:05.000Z"
}
```

### 落盘路径

```text
notes/briefs/<brief_id>.json
```

---

## 4. DraftComposer

### 职责

只负责：

- 读取 brief + bundle
- 生成小红书草稿
- 输出 draft json 和 markdown

不负责：

- 改选题
- 重做 brief

### 建议函数签名

```js
composeDraft({
  brief,
  bundle,
  style
})
```

### 输入 contract

```json
{
  "brief": {
    "brief_id": "brief-1742790000100",
    "bundle_id": "bundle-1742790000000",
    "theme": "AI coding",
    "core_angle": "..."
  },
  "bundle": {
    "bundle_id": "bundle-1742790000000",
    "bundle": {
      "core_post": {
        "tweet_id": "123",
        "url": "https://x.com/..."
      },
      "supporting_posts": []
    }
  },
  "style": "trend-analysis"
}
```

### 输出 contract

```json
{
  "draft_id": "draft-1742790000200",
  "brief_id": "brief-1742790000100",
  "bundle_id": "bundle-1742790000000",
  "theme": "AI coding",
  "style": "trend-analysis",
  "angle": "围绕 AI coding，从一条主观点切入，再用多条帖子补数据、对比和案例。",
  "title_options": [
    "我把最近 X 上关于 AI coding 的讨论，整理成了一篇笔记",
    "AI coding 最近在聊什么？我看完几条内容后有个判断"
  ],
  "cover_text_options": [
    "AI coding 的重点变了",
    "别只看单条热帖"
  ],
  "body_markdown": "...",
  "hashtags": ["#AI", "#小红书运营", "#AIcoding"],
  "source_posts": [
    {
      "tweet_id": "123",
      "url": "https://x.com/..."
    }
  ],
  "status": "draft",
  "created_at": "2026-03-24T13:00:10.000Z"
}
```

### Markdown 输出约定

除 JSON 外，还需要同步落盘 markdown：

```text
notes/drafts/<draft_id>.md
```

内容默认等于：

```text
<draft.body_markdown>
```

### 落盘路径

```text
notes/drafts/<draft_id>.json
notes/drafts/<draft_id>.md
```

---

## 5. run_note_pipeline.js

### 职责

只保留 orchestration：

1. 读取配置
2. 调用 BundleBuilder
3. 写 bundle artifact
4. 调用 BriefBuilder
5. 写 brief artifact
6. 调用 DraftComposer
7. 写 draft artifact
8. 写 run summary
9. 可选 rebuild dashboard
10. 返回结构化结果

### 建议输入配置

文件：`note.config.json`

```json
{
  "theme": "AI coding",
  "accounts": ["sama", "elonmusk"],
  "top_k": 4,
  "original_only": true,
  "style": "trend-analysis",
  "rebuild_dashboard": true
}
```

### 建议输出 contract

```json
{
  "ok": true,
  "run_id": "note-run-1742790000300",
  "bundle_id": "bundle-1742790000000",
  "brief_id": "brief-1742790000100",
  "draft_id": "draft-1742790000200",
  "paths": {
    "bundlePath": "notes/bundles/bundle-1742790000000.json",
    "briefPath": "notes/briefs/brief-1742790000100.json",
    "draftJsonPath": "notes/drafts/draft-1742790000200.json",
    "draftMdPath": "notes/drafts/draft-1742790000200.md",
    "runSummaryPath": "notes/runs/note-run-1742790000300.json"
  },
  "dashboard": {
    "attempted": true,
    "ok": true
  }
}
```

### 失败输出建议

```json
{
  "ok": false,
  "stage": "bundle_build_failed",
  "message": "No candidate posts found for theme: AI coding"
}
```

可选 `stage`：

- `bundle_build_failed`
- `brief_build_failed`
- `draft_compose_failed`
- `artifact_write_failed`
- `dashboard_rebuild_failed`

---

## 6. Run Summary Artifact

### 目标

记录一次完整 pipeline 运行的产物关系，便于：

- 调试
- 人工审核
- dashboard 展示
- 未来 agent 化

### 输出 contract

```json
{
  "run_id": "note-run-1742790000300",
  "theme": "AI coding",
  "bundle_id": "bundle-1742790000000",
  "brief_id": "brief-1742790000100",
  "draft_id": "draft-1742790000200",
  "paths": {
    "bundle_json": "notes/bundles/bundle-1742790000000.json",
    "brief_json": "notes/briefs/brief-1742790000100.json",
    "draft_json": "notes/drafts/draft-1742790000200.json",
    "draft_md": "notes/drafts/draft-1742790000200.md"
  },
  "created_at": "2026-03-24T13:00:11.000Z"
}
```

### 落盘路径

```text
notes/runs/<run_id>.json
```

---

## 7. Dashboard 消费 contract

### 输入来源

至少读取：

- `notes/drafts/*.json`

建议逐步支持：

- `notes/briefs/*.json`
- `notes/bundles/*.json`
- `notes/runs/*.json`

### 建议输出结构

```json
{
  "notes": [
    {
      "draft_id": "draft-1742790000200",
      "brief_id": "brief-1742790000100",
      "bundle_id": "bundle-1742790000000",
      "theme": "AI coding",
      "title_options": ["..."],
      "body_markdown": "...",
      "created_at": "2026-03-24T13:00:10.000Z",
      "source_posts": [
        {
          "tweet_id": "123",
          "url": "https://x.com/..."
        }
      ],
      "bundle_preview": {
        "core_post": {
          "tweet_id": "123",
          "account": "sama"
        },
        "supporting_count": 3
      },
      "brief_preview": {
        "core_angle": "...",
        "final_takeaway": "..."
      }
    }
  ]
}
```

### 降级兼容要求

如果 brief 或 bundle 缺失：

- draft 不应被丢弃
- 对应 preview 字段允许为 `null`
- dashboard 前端不应报错

---

## 8. 字段兼容策略（过渡期）

为了避免一次性打断已有流程，过渡期允许兼容旧字段：

### 建议兼容映射

- `selection_id` ↔ `bundle_id`
- `note_id` ↔ `draft_id`
- `source_selection_id` ↔ `source_bundle_id`

### 示例

```js
const bundleId = artifact.bundle_id || artifact.selection_id || null;
const draftId = artifact.draft_id || artifact.note_id || null;
```

兼容策略建议只保留一个过渡阶段，稳定后统一切到：

- `bundle_id`
- `brief_id`
- `draft_id`

---

## 9. 落盘路径总表

```text
notes/bundles/<bundle_id>.json
notes/briefs/<brief_id>.json
notes/drafts/<draft_id>.json
notes/drafts/<draft_id>.md
notes/runs/<run_id>.json
```

---

## 10. 验收最低要求

### BundleBuilder

- 输入合法时产出 bundle
- 空输入时返回合法空 bundle
- 不因缺少某个账号文件直接崩溃

### BriefBuilder

- 输入 bundle 时产出 brief
- `core_post = null` 时有 fallback

### DraftComposer

- 输入 brief + bundle 时产出 draft json 和 markdown
- `source_posts` 继承正确

### run_note_pipeline.js

- 能完整落盘全部 artifact
- dashboard rebuild 失败时，draft 结果仍保留
- 返回明确 `ok/stage/message`

### Dashboard

- 能显示 draft
- 能兼容 brief/bundle 缺失

---

## 11. 非目标（当前不纳入 contract）

以下内容暂不纳入本轮 contract：

- LLM 驱动重写器
- 数据库存储层
- 任务队列 / 异步调度
- 自动发布到小红书
- 复杂插件系统

当前 contract 的目标是：

**先把 note pipeline 的模块边界、数据结构、落盘协议、dashboard 消费关系彻底定清楚。**
