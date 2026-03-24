# 小红书运营来自 X 星球

[中文说明](./README.zh-CN.md)

一个把 **X/Twitter 内容采集 → 结构化清洗 → 小红书草稿生成 → 本地 dashboard 展示** 串起来的最小实现项目。

> 这是实现仓库（engine / app repo）。
> 对应的 OpenClaw skill 仓库：
> `https://github.com/xiangbaqiu/xiaohongshu-x-planet`

## 项目目标

跑通一条可重复执行的内容运营流水线：

1. 采集一个或多个 X 账号内容
2. 标准化、去重、落盘
3. 从多条帖子组合生成一篇小红书草稿
4. 在本地 dashboard 中查看账号内容和生成稿

## 当前能力

- 采集一个或多个 X 账号内容
- 按账号保留最近 N 条内容，并按 `tweet_id` 去重
- 生成标准化 `posts.jsonl` / `state.json` / `summary.json`
- 通过模块化 note pipeline 生成 bundle / brief / draft / run summary
- 在本地 dashboard 中查看草稿及其 lineage（bundle / brief / draft）
- 内置 Node test coverage，覆盖 builders 和 pipeline integration

## 当前 note pipeline

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

## 目录结构

```text
xiaohongshu-yunying-laizi-x-xingqiu/
  collect.config.json
  note.config.json
  config.example.json
  src/
  scripts/
  dashboard/
  docs/
  test/
  samples/
  data/      # 运行生成，默认不入库
  notes/     # 运行生成，默认不入库
```

## 快速开始

### 1) 配置采集任务

编辑 `collect.config.json`：

```json
{
  "accounts": ["sama", "elonmusk"],
  "count_per_account": 20,
  "max_scroll_rounds": 6,
  "mode": "replace_latest"
}
```

### 2) 运行采集

```bash
node src/auto_collect.js collect.config.json
```

### 3) 生成小红书草稿

编辑 `note.config.json`：

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

运行：

```bash
node src/run_note_pipeline.js note.config.json
```

### 4) 重建 dashboard 数据

```bash
node scripts/build_dashboard_data.js
```

### 5) 运行测试

```bash
node --test
```

### 6) 本地打开 dashboard

```bash
python3 -m http.server 8008
```

然后访问：

`http://127.0.0.1:8008/dashboard/index.html`

## 其他常用命令

### 从已有 raw 重新生成结构化数据

```bash
node src/run_from_raw.js samples/raw/sama-raw.json sama
```

## 主要输出

### 采集输出

- `data/x/accounts/<handle>/posts.jsonl`
- `data/x/accounts/<handle>/raw-batches/<runId>.json`
- `data/x/accounts/<handle>/state.json`
- `data/runs/<runId>/summary.json`
- `data/dashboard/dashboard-data.json`

### Note pipeline 输出

- `notes/bundles/*.json`
- `notes/briefs/*.json`
- `notes/drafts/*.json`
- `notes/drafts/*.md`
- `notes/runs/*.json`

## 默认约定

- 推荐采集模式：`replace_latest`
- 默认以 `original` 内容作为主观察池
- 草稿生成基于多帖 bundle，而不是单帖改写
- `data/` 和 `notes/` 属于运行产物，默认不提交到仓库
- 当前存在兼容字段过渡：`selection_id ↔ bundle_id`，`note_id ↔ draft_id`

## 文档入口

- [Note Pipeline Refactor Task List](./docs/note-pipeline-refactor-task-list.md)
- [Note Pipeline Contracts](./docs/note-pipeline-contracts.md)

## 相关仓库

- Skill repo: `https://github.com/xiangbaqiu/xiaohongshu-x-planet`

## License

MIT
