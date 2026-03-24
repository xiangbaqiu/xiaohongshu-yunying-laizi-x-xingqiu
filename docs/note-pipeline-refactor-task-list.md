# Note Pipeline 模块化重构实施任务清单

## 总目标

把当前 note pipeline 拆成 4 个明确部分：

1. `BundleBuilder`
2. `BriefBuilder`
3. `DraftComposer`
4. `run_note_pipeline.js` 作为总编排入口

并保证：

- 每层只做一件事
- 每层有明确输入/输出
- 每层支持单独运行
- 中间产物全部落盘
- dashboard 可消费最终结果，并逐步兼容中间产物

---

## 一、建议实施顺序

按这个顺序做，风险最低：

### Phase 1：结构拆分，不改核心算法

- 新建 3 个 builder 文件
- 迁移现有逻辑
- `run_note_pipeline.js` 改为 orchestration-only
- 新增 `notes/bundles/`

### Phase 2：统一落盘协议

- 新建 artifact IO helper
- 增加 run summary
- 所有中间产物和最终产物统一落盘

### Phase 3：补 dashboard 接入

- dashboard 数据构建脚本读取新产物
- 输出 draft/bundle/brief 的关联信息

### Phase 4：补测试和文档

- 为 3 个 builder + pipeline 补测试
- 更新 README / contract 文档

---

## 二、文件级任务清单

## 任务 1：新建 `src/bundle_builder.js`

### 目标

把现在 `src/select_posts.js` 中的“选帖和组合 bundle”逻辑迁移到 `BundleBuilder`。

### 输入

建议函数签名：

```js
buildBundle({
  baseDir,
  accounts,
  theme,
  topK,
  originalOnly
})
```

### 输出

返回结构：

```js
{
  bundle_id,
  theme,
  bundle_strategy,
  selection_strategy,
  candidate_count,
  bundle: {
    core_post,
    supporting_posts
  },
  created_at
}
```

### 实施内容

- 从 `select_posts.js` 迁移以下逻辑：
  - `readJsonl`
  - `themeWords`
  - `scorePost`
  - `classifySupportRole`
  - `dedupeByTweetId`
  - `selectPostBundle` 的主流程
- 重命名导出函数：
  - `selectPostBundle` → `buildBundle`
- 返回对象中的 `selection_id` 改为 `bundle_id`
- 落盘命名统一使用 `bundle_id`

### 验收标准

- 能从现有 `posts.jsonl` 生成合法 `bundle`
- `core_post` / `supporting_posts` 结构不丢字段
- 空数据时不崩
- 支持单独 `require()` 调用

### 风险点

- 现在外部还可能引用 `select_posts.js`
- 不要直接删老文件，先做兼容层

---

## 任务 2：保留 `src/select_posts.js` 作为兼容层

### 目标

避免已有引用直接失效。

### 实施内容

先把 `src/select_posts.js` 改成薄适配层，例如：

```js
const { buildBundle, readJsonl, scorePost } = require('./bundle_builder');

function selectPostBundle(args) {
  return buildBundle(args);
}

module.exports = {
  selectPostBundle,
  buildBundle,
  readJsonl,
  scorePost
};
```

### 验收标准

- 老调用路径仍可运行
- 新模块路径可运行

### 风险点

- 不能在第一轮就删老文件
- 先兼容，后清理

---

## 任务 3：新建 `src/brief_builder.js`

### 目标

把现在 `src/distill_posts.js` 中“从 bundle 提炼写作策略”的逻辑迁移出来。

### 输入

```js
buildBrief(bundle)
```

### 输出

```js
{
  brief_id,
  bundle_id,
  theme,
  core_angle,
  narrative_structure,
  claims,
  audience_takeaway,
  source_bundle,
  created_at
}
```

### 实施内容

- 从 `distill_posts.js` 迁移：
  - `firstSentence`
  - `supportRoleToPoint`
  - `distillBundle`
- 重命名导出函数：
  - `distillBundle` → `buildBrief`
- brief 中补上 `bundle_id`
- `source_bundle` 结构保留，但命名更稳定

### 验收标准

- 输入 bundle 后能稳定输出 brief
- 核心字段都存在：
  - `core_angle`
  - `narrative_structure`
  - `claims`
- bundle 为空时也能生成 fallback brief

### 风险点

- 当前逻辑对 `core_post` 为空的处理较弱，要补 fallback

---

## 任务 4：保留 `src/distill_posts.js` 作为兼容层

### 实施内容

改成：

```js
const { buildBrief } = require('./brief_builder');

function distillBundle(bundle) {
  return buildBrief(bundle);
}

module.exports = {
  distillBundle,
  buildBrief
};
```

### 验收标准

- 老调用不崩
- 新调用可用

---

## 任务 5：新建 `src/draft_composer.js`

### 目标

把现在 `src/compose_note.js` 中“根据 brief + bundle 生成草稿”的逻辑迁移出来。

### 输入

建议函数签名：

```js
composeDraft({
  brief,
  bundle,
  style
})
```

### 输出

```js
{
  draft_id,
  brief_id,
  bundle_id,
  theme,
  style,
  angle,
  title_options,
  cover_text_options,
  body_markdown,
  hashtags,
  source_posts,
  status,
  created_at
}
```

### 实施内容

- 从 `compose_note.js` 迁移：
  - `composeTitle`
  - `composeCoverText`
  - `composeNote`
- 重命名导出函数：
  - `composeNote` → `composeDraft`
- `note_id` 改成 `draft_id`
- `source_selection_id` 改成 `source_bundle_id`
- 增加 `brief_id` / `bundle_id`

### 验收标准

- 输入 brief + bundle 后能输出 draft
- 同时保留：
  - `title_options`
  - `cover_text_options`
  - `body_markdown`
  - `source_posts`
- 空 supporting posts 不崩

### 风险点

- 现有字段名里 `note_id` / `selection_id` 要统一替换
- dashboard 侧如果依赖老字段，要兼容一段时间

---

## 任务 6：保留 `src/compose_note.js` 作为兼容层

### 实施内容

```js
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
```

### 验收标准

- 老逻辑还能跑
- 新逻辑路径成立

---

## 任务 7：新建 `src/note_artifact_io.js`

### 目标

把所有中间产物和最终产物的写入逻辑统一。

### 提供能力

建议包括：

```js
ensureDir(dir)
writeJson(filePath, data)
writeText(filePath, content)
buildArtifactId(prefix)
writeBundle(baseDir, bundle)
writeBrief(baseDir, brief)
writeDraft(baseDir, draft)
writeDraftMarkdown(baseDir, draft)
writeRunSummary(baseDir, runSummary)
```

### 路径约定

```text
notes/bundles/<bundle_id>.json
notes/briefs/<brief_id>.json
notes/drafts/<draft_id>.json
notes/drafts/<draft_id>.md
notes/runs/<run_id>.json
```

### 验收标准

- 所有落盘操作收敛到一个 helper
- 不允许 `run_note_pipeline.js` 自己散写路径
- 写出的 JSON 有统一格式

### 风险点

- 如果异常处理不统一，容易出现“json 写了，md 没写”
- 要保证写入顺序和错误日志清晰

---

## 任务 8：重构 `src/run_note_pipeline.js`

### 目标

让它只做总编排，不再包含业务细节。

### 改造后职责

1. 读取 config
2. 调 `buildBundle`
3. 写 `bundle.json`
4. 调 `buildBrief`
5. 写 `brief.json`
6. 调 `composeDraft`
7. 写 `draft.json` + `draft.md`
8. 写 `run summary`
9. 可选触发 dashboard rebuild
10. 输出结构化结果

### 建议输出

```js
{
  ok: true,
  run_id,
  bundle_id,
  brief_id,
  draft_id,
  paths: {
    bundlePath,
    briefPath,
    draftJsonPath,
    draftMdPath,
    runSummaryPath
  }
}
```

### 实施内容

- 移除本文件中的：
  - `writeJson`
  - `writeText`
  - 业务生成逻辑
- 改成只调 builder + artifact IO
- 增加 `rebuild_dashboard` 配置支持
- dashboard rebuild 失败时，不要把整个 draft 生成判死

### 验收标准

- pipeline 逻辑短小清晰
- 可以通过一眼看明白整个链路
- 中间产物完整落盘

### 风险点

- 不要在这里重新发明 fallback 逻辑
- fallback 应在各 builder 内部兜底

---

## 任务 9：新增 `notes/bundles/` 目录约定

### 目标

补齐中间产物落盘目录。

### 实施内容

- 代码里确保自动创建目录
- README 里补这一层
- dashboard 构建逻辑后续能读取这一层

### 验收标准

- pipeline 首次运行能自动生成目录
- 不依赖手动创建

---

## 任务 10：更新 `scripts/build_dashboard_data.js`

### 目标

让 dashboard 消费新的 artifact 链路。

### 至少要支持读取

- `notes/drafts/*.json`
- 可选读取：
  - `notes/briefs/*.json`
  - `notes/bundles/*.json`
  - `notes/runs/*.json`

### 建议输出结构

```js
{
  notes: [
    {
      draft_id,
      brief_id,
      bundle_id,
      theme,
      title_options,
      body_markdown,
      created_at,
      source_posts,
      bundle_preview: {
        core_post,
        supporting_count
      },
      brief_preview: {
        core_angle,
        final_takeaway
      }
    }
  ]
}
```

### 实施内容

- 先保证 draft 列表不受影响
- 增加 brief/bundle 的关联预览信息
- 若 brief 或 bundle 缺失，不应导致整条 note 丢失

### 验收标准

- dashboard 仍能展示 draft
- 新增链路信息后，前端不崩
- 老 draft 数据也能兼容

### 风险点

- 不要把 dashboard 数据构建写死成必须同时存在全部 artifact
- 允许部分缺失，做 degrade

---

## 任务 11：更新 `dashboard/app.js`（如需要）

### 目标

如果 dashboard 需要展示更多审核信息，补轻量 UI。

### 建议新增展示

- `theme`
- `bundle_preview`
- `brief_preview`
- `source_posts` 数量
- `created_at`

### 验收标准

- 前端展示不影响现有浏览
- 新字段缺失时 UI 不报错

### 风险点

- 先做轻量展示，不要大改前端布局

---

## 任务 12：更新项目 README

### 目标

让外部工程师看 README 就知道新链路。

### README 必须补的内容

- 新 pipeline 结构图
- 4 个模块职责
- artifact 落盘路径
- 运行 `run_note_pipeline.js` 后有哪些产物
- dashboard 如何消费这些产物

### 建议加入图

```text
posts.jsonl
  ↓
BundleBuilder
  ↓
bundle.json
  ↓
BriefBuilder
  ↓
brief.json
  ↓
DraftComposer
  ↓
draft.json + draft.md
  ↓
dashboard
```

### 验收标准

- 新同学不读源码也能理解结构
- README 与实际路径一致

---

## 任务 13：新增 contract 文档

### 文件建议

二选一即可：

- `docs/note-pipeline-contracts.md`
- 或 `src/note_pipeline_contracts.md`

### 目标

明确每层输入输出 schema。

### 文档至少包含

- BundleBuilder input/output
- BriefBuilder input/output
- DraftComposer input/output
- run summary output
- dashboard 消费字段

### 验收标准

- 工程师能根据文档 mock 数据
- 后续 agent 也能直接读 contract 工作

---

## 三、测试任务清单

## 任务 14：给 `bundle_builder.js` 补测试

### 用例

1. 多账号 posts 能正确选出 `core_post`
2. `supporting_posts` 数量符合 `top_k`
3. `original_only=true` 时过滤 repost/reply
4. tweet 去重生效
5. 空输入时输出合法空 bundle

### 验收标准

- 不依赖真实线上数据
- fixtures 可复用

---

## 任务 15：给 `brief_builder.js` 补测试

### 用例

1. core post 存在时，能生成 hook
2. supporting posts 能映射出 supporting_points
3. claims 结构正确
4. 空 bundle 时生成 fallback brief

### 验收标准

- 结构稳定
- 不因文案轻微变化导致测试脆弱

---

## 任务 16：给 `draft_composer.js` 补测试

### 用例

1. 输入 brief + bundle 能输出合法 draft
2. `draft_id / brief_id / bundle_id` 正确关联
3. `body_markdown` 非空
4. `source_posts` 正确继承
5. 无 supporting posts 时也能生成 draft

### 验收标准

- 测结构，不要过度测整段文案全文等值

---

## 任务 17：给 `run_note_pipeline.js` 补集成测试

### 用例

1. 整条链路能成功跑通
2. 产出：
   - bundle.json
   - brief.json
   - draft.json
   - draft.md
   - run summary
3. 配置项 `rebuild_dashboard=false` 时不触发 dashboard
4. 数据缺失时返回清晰错误/状态

### 验收标准

- 跑完后产物路径可断言
- 不 silent fail

---

## 四、建议新增的配置和协议

## 任务 18：规范 `note.config.json`

### 目标

统一 note pipeline 的配置入口。

### 建议结构

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

### 验收标准

- 所有必要配置都有默认值
- 配置缺省时不崩

---

## 任务 19：增加 run summary 协议

### 文件

```text
notes/runs/<run_id>.json
```

### 目标

把一次 pipeline 运行的 artifact 关系记下来。

### 建议结构

```json
{
  "run_id": "note-run-xxx",
  "theme": "AI coding",
  "bundle_id": "bundle-xxx",
  "brief_id": "brief-xxx",
  "draft_id": "draft-xxx",
  "paths": {
    "bundle_json": "...",
    "brief_json": "...",
    "draft_json": "...",
    "draft_md": "..."
  },
  "created_at": "..."
}
```

### 验收标准

- 能追踪最近一次运行
- 后续 dashboard / agent / 审核都可直接消费

---

## 五、兼容性与清理任务

## 任务 20：兼容旧字段，避免一次性全量破坏

### 目标

降低 dashboard / 脚本 / 未来调用的升级成本。

### 兼容建议

在过渡期内：

- `selection_id` 和 `bundle_id` 可同时保留一版
- `note_id` 和 `draft_id` 可同时保留一版

或者至少在 dashboard 数据构建时做兼容：

```js
const bundleId = draft.bundle_id || draft.source_selection_id || null;
const draftId = draft.draft_id || draft.note_id || null;
```

### 验收标准

- 老产物不至于完全不可读
- 新产物优先使用新字段

---

## 任务 21：第二阶段再删除旧模块

### 目标

确认稳定后再清理：

- `select_posts.js`
- `distill_posts.js`
- `compose_note.js`

### 当前阶段要求

- 先保留兼容层
- 待所有调用切到新名字后再删

---

## 六、失败处理要求

## 任务 22：统一失败语义

### 要求

每个模块都要能明确区分：

- 成功但结果为空
- 输入非法
- 文件缺失
- 落盘失败

### 建议

至少做到：

- 抛错信息清晰
- pipeline 最终输出能指出失败阶段：
  - `bundle_build_failed`
  - `brief_build_failed`
  - `draft_compose_failed`
  - `dashboard_rebuild_failed`

### 验收标准

- 不出现 silent fail
- 工程师能从日志快速定位是哪一层出的问题

---

## 七、交付验收清单

工程师提测前，至少满足下面这些：

### 功能验收

- [ ] `BundleBuilder` 可单独运行
- [ ] `BriefBuilder` 可单独运行
- [ ] `DraftComposer` 可单独运行
- [ ] `run_note_pipeline.js` 只做编排
- [ ] 中间产物全部落盘
- [ ] dashboard 能展示最终 draft
- [ ] dashboard 至少兼容 bundle/brief 预览

### 结构验收

- [ ] 新旧模块兼容期内都可用
- [ ] artifact 路径统一
- [ ] 字段命名基本统一：bundle / brief / draft

### 测试验收

- [ ] 三个 builder 各自有单测
- [ ] pipeline 有集成测试
- [ ] 空输入/缺文件/部分失败有覆盖

### 文档验收

- [ ] README 更新
- [ ] contract 文档补齐
- [ ] 路径和字段说明与实际一致

---

## 八、推荐分工方式

如果是 1 个工程师：

### Day 1

- 任务 1~8：模块拆分 + IO helper + pipeline 重构

### Day 2

- 任务 10~19：dashboard 接入 + tests + docs

如果是 2 个工程师并行：

### 工程师 A

- 任务 1~9
- 任务 18~22

### 工程师 B

- 任务 10~17
- 任务 12~13

---

## 九、推荐 commit 划分

### Commit 1

`refactor: introduce bundle/brief/draft builders`

### Commit 2

`refactor: centralize note artifact persistence`

### Commit 3

`feat: persist bundle artifacts and run summaries`

### Commit 4

`feat: expose brief/bundle lineage in dashboard data`

### Commit 5

`test: add note pipeline unit and integration coverage`

### Commit 6

`docs: document note pipeline contracts and artifacts`
