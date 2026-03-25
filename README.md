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
- 在本地 dashboard 中查看审核状态、publish-ready、publish record 等发布追踪信息
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

### 5) 独立运行各阶段

```bash
# 生成 bundle
node src/run_bundle_builder.js note.config.json

# 基于 bundle 生成 brief
node src/run_brief_builder.js notes/bundles/<bundle_id>.json

# 基于 brief + bundle 生成 draft
node src/run_draft_composer.js notes/briefs/<brief_id>.json notes/bundles/<bundle_id>.json
```

### 6) 运行测试

```bash
node --test
```

### 7) 预览或归档历史 note artifacts

默认是 dry-run，只预览将被归档的历史 artifacts：

```bash
node scripts/archive_note_artifacts.js --keep-drafts 20
```

确认无误后再执行实际归档：

```bash
node scripts/archive_note_artifacts.js --keep-drafts 20 --apply
```

如果要给其他脚本消费结果，可以输出 JSON：

```bash
node scripts/archive_note_artifacts.js --keep-drafts 20 --json
```

### 8) 本地打开 dashboard

只读模式：

```bash
python3 -m http.server 8008
```

然后访问：

`http://127.0.0.1:8008/dashboard/index.html`

如果要在 dashboard 里直接做审核状态流转、生成 publish-ready payload，请使用可写模式：

```bash
node scripts/dashboard_server.js
```

然后访问：

`http://127.0.0.1:8008/dashboard/index.html`

## 其他常用命令

### 从已通过的 draft 生成 publish-ready payload

```bash
node scripts/create_publish_ready.js <draft_id> --prepared-by xiangbaqiu
```

### 记录真实发布结果并回写 published 状态

```bash
node scripts/record_publish_result.js <draft_id> --published-by xiangbaqiu --platform-url https://www.xiaohongshu.com/explore/<note_id>
```

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
- `notes/publish-ready/*.json`
- `notes/publish-records/*.json`
- `notes/runs/*.json`

## 默认约定

- 推荐采集模式：`replace_latest`
- 默认以 `original` 内容作为主观察池
- 草稿生成基于多帖 bundle，而不是单帖改写
- `data/` 和 `notes/` 属于运行产物，默认不提交到仓库
- 当前主链路已统一使用：`bundle_id` / `brief_id` / `draft_id`
- 旧字段兼容仅保留在旧 artifacts 读取层，用于平滑迁移历史数据

## 文档入口

- [Note Pipeline Refactor Task List](./docs/note-pipeline-refactor-task-list.md)
- [Note Pipeline Contracts](./docs/note-pipeline-contracts.md)
- [Note Artifact Retention Rules](./docs/note-artifact-retention.md)
- [Draft To Publish Workflow](./docs/draft-to-publish-workflow.md)

## 相关仓库

- Skill repo: `https://github.com/xiangbaqiu/xiaohongshu-x-planet`

## License

MIT
