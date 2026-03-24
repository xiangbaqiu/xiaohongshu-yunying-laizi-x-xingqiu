# Note Pipeline Contracts

本文档定义当前 note pipeline 各模块的输入输出约定，供工程实现、调试、dashboard 消费，以及后续 agent 化使用。

> 状态说明：本文档描述的是**当前仓库已落地实现**，并包含少量过渡兼容字段说明。

---

## 1. Pipeline 总览

```text
posts.jsonl
  ↓
BundleBuilder (`src/bundle_builder.js`)
  ↓
notes/bundles/<bundle_id>.json
  ↓
BriefBuilder (`src/brief_builder.js`)
  ↓
notes/briefs/<brief_id>.json
  ↓
DraftComposer (`src/draft_composer.js`)
  ↓
notes/drafts/<draft_id>.json
notes/drafts/<draft_id>.md
  ↓
notes/runs/<run_id>.json
  ↓
scripts/build_dashboard_data.js
  ↓
data/dashboard/dashboard-data.json
```

---

## 2. BundleBuilder

### 当前位置

- 文件：`src/bundle_builder.js`
- 兼容入口：`src/select_posts.js`

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

### 当前函数签名

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

### 当前输出 contract

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
    "supporting_posts": []
  },
  "created_at": "2026-03-24T13:00:00.000Z"
}
```

### 空结果约定

当没有候选内容时，返回合法空 bundle：

```json
{
  "bundle_id": "bundle-1742790000000",
  "selection_id": "bundle-1742790000000",
  "theme": "AI coding",
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

### 当前位置

- 文件：`src/brief_builder.js`
- 兼容入口：`src/distill_posts.js`

### 职责

只负责：

- 读取 bundle
- 提炼核心角度
- 形成 narrative structure
- 输出写作策略 brief

不负责：

- 生成完整正文
- 回头改 bundle

### 当前函数签名

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

### 当前输出 contract

```json
{
  "brief_id": "brief-1742790000100",
  "bundle_id": "bundle-1742790000000",
  "theme": "AI coding",
  "core_angle": "围绕 AI coding，从一条主观点出发，再用多条帖子补数据、对比和案例，整合成一篇更适合小红书阅读的笔记。",
  "narrative_structure": {
    "hook_from_core_post": "...",
    "supporting_points": [],
    "final_takeaway": "这组内容共同说明：AI coding 不是一条孤立讨论，而是可以被整理成一个更完整的趋势判断。"
  },
  "claims": [],
  "audience_takeaway": [],
  "source_bundle": {
    "core_post_id": "123",
    "supporting_post_ids": []
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
  "core_angle": "围绕 AI coding，从一条主观点出发，再用多条帖子补数据、对比和案例，整合成一篇更适合小红书阅读的笔记。",
  "narrative_structure": {
    "hook_from_core_post": "先用主题切入",
    "supporting_points": [],
    "final_takeaway": "围绕 AI coding 的当前素材还不够完整，但方向已经明确，可以继续补充。"
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

### 当前位置

- 文件：`src/draft_composer.js`

### 职责

只负责：

- 读取 brief + bundle
- 生成小红书草稿
- 输出 draft json 和 markdown

不负责：

- 改选题
- 重做 brief

### 当前函数签名

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

### 当前输出 contract

```json
{
  "draft_id": "draft-1742790000200",
  "brief_id": "brief-1742790000100",
  "bundle_id": "bundle-1742790000000",
  "source_brief_id": "brief-1742790000100",
  "source_bundle_id": "bundle-1742790000000",
  "theme": "AI coding",
  "style": "trend-analysis",
  "angle": "...",
  "title_options": [],
  "cover_text_options": [],
  "body_markdown": "...",
  "hashtags": [],
  "source_posts": [],
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

### 当前位置

- 文件：`src/run_note_pipeline.js`

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

### 当前输入配置

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

### 当前输出 contract

```json
{
  "ok": true,
  "run_id": "note-run-1742790000300",
  "bundle_id": "bundle-1742790000000",
  "brief_id": "brief-1742790000100",
  "draft_id": "draft-1742790000200",
  "paths": {
    "bundlePath": "/abs/path/notes/bundles/bundle-1742790000000.json",
    "briefPath": "/abs/path/notes/briefs/brief-1742790000100.json",
    "draftJsonPath": "/abs/path/notes/drafts/draft-1742790000200.json",
    "draftMdPath": "/abs/path/notes/drafts/draft-1742790000200.md",
    "runSummaryPath": "/abs/path/notes/runs/note-run-1742790000300.json"
  },
  "dashboard": {
    "attempted": true,
    "ok": true
  }
}
```

### 当前失败输出

当前实现统一返回：

```json
{
  "ok": false,
  "stage": "artifact_write_failed",
  "message": "..."
}
```

> 说明：更细粒度的 `bundle_build_failed` / `brief_build_failed` / `draft_compose_failed` 还可以继续细化，但当前实现已经至少能避免 silent fail。

---

## 6. Run Summary Artifact

### 目标

记录一次完整 pipeline 运行的产物关系，便于：

- 调试
- 人工审核
- dashboard 展示
- 未来 agent 化

### 当前输出 contract

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
  "dashboard": {
    "attempted": true,
    "ok": true
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

### 当前输入来源

当前已读取：

- `notes/drafts/*.json`
- `notes/briefs/*.json`
- `notes/bundles/*.json`

### 当前输出结构

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
      "source_posts": [],
      "bundle_preview": {
        "core_post": {
          "tweet_id": "123",
          "account": "sama",
          "text": "...",
          "url": "https://x.com/..."
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

为了避免一次性打断已有流程，当前实现保留兼容旧字段：

### 当前兼容映射

- `selection_id` ↔ `bundle_id`
- `note_id` ↔ `draft_id`
- `source_selection_id` ↔ `source_bundle_id`

### 示例

```js
const bundleId = artifact.bundle_id || artifact.selection_id || null;
const draftId = artifact.draft_id || artifact.note_id || null;
```

后续如果外部调用和 dashboard 都已切稳，可以逐步移除兼容字段，统一切到：

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

## 10. 测试状态

当前仓库已存在并通过：

- `test/bundle_builder.test.js`
- `test/brief_builder.test.js`
- `test/draft_composer.test.js`
- `test/run_note_pipeline.test.js`

运行方式：

```bash
node --test
```

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
dashboard 消费关系彻底定清楚。**
��边界、数据结构、落盘协议、dashboard 消费关系彻底定清楚。**
