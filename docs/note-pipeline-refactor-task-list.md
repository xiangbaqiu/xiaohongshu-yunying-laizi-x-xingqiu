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

> 状态说明：本清单最初用于拆分实施任务。当前仓库中，绝大部分核心任务已经落地完成；本文档现同时承担“实施清单 + 完成状态追踪”作用。

---

## 一、实施状态总览

### 已完成

- [x] `src/bundle_builder.js`
- [x] `src/brief_builder.js`
- [x] `src/draft_composer.js`
- [x] 旧模块兼容层保留：
  - [x] `src/select_posts.js`
  - [x] `src/distill_posts.js`
  - [x] `src/compose_note.js`
- [x] `src/note_artifact_io.js`
- [x] `src/run_note_pipeline.js` 收敛为 orchestrator
- [x] `notes/bundles/` / `notes/briefs/` / `notes/drafts/` / `notes/runs/` 路径落地
- [x] `scripts/build_dashboard_data.js` 接入 draft + brief + bundle lineage
- [x] `dashboard/app.js` 最小化展示 lineage 信息
- [x] 测试补齐：builders + pipeline integration
- [x] README / contracts / docs 基本对齐

### 仍可继续优化（非阻塞）

- [ ] 将 `run_note_pipeline.js` 失败阶段进一步细化为：
  - `bundle_build_failed`
  - `brief_build_failed`
  - `draft_compose_failed`
  - `artifact_write_failed`
  - `dashboard_rebuild_failed`
- [ ] 移除兼容字段和兼容层（待外部调用完全切稳后）
- [ ] dashboard 更完整展示 bundle / brief 详情，而不仅是 preview
- [ ] 为 dashboard lineage 增加更细粒度 UI 测试（当前未做）

---

## 二、分阶段回顾

### Phase 1：结构拆分，不改核心算法

**状态：已完成**

- [x] 新建 3 个 builder 文件
- [x] 迁移现有逻辑
- [x] `run_note_pipeline.js` 改为 orchestration-only
- [x] 新增 `notes/bundles/`

### Phase 2：统一落盘协议

**状态：已完成**

- [x] 新建 artifact IO helper
- [x] 增加 run summary
- [x] 所有中间产物和最终产物统一落盘

### Phase 3：补 dashboard 接入

**状态：已完成**

- [x] dashboard 数据构建脚本读取新产物
- [x] 输出 draft / bundle / brief 的关联信息

### Phase 4：补测试和文档

**状态：已完成**

- [x] 为 3 个 builder + pipeline 补测试
- [x] 更新 README / contract 文档

---

## 三、文件级实施结果

## 任务 1：新建 `src/bundle_builder.js`

**状态：已完成**

### 已落地内容

- 已从原 `src/select_posts.js` 提炼为独立模块
- 当前导出：
  - `readJsonl`
  - `themeWords`
  - `scorePost`
  - `classifySupportRole`
  - `dedupeByTweetId`
  - `buildBundle`
- 当前输出已统一为：
  - `bundle_id`

---

## 任务 2：保留 `src/select_posts.js` 作为兼容层

**状态：已完成**

### 已落地内容

- 当前 `src/select_posts.js` 已变为薄适配层
- 老调用路径仍可运行
- 新模块路径已可用

---

## 任务 3：新建 `src/brief_builder.js`

**状态：已完成**

### 已落地内容

- 已从原 `src/distill_posts.js` 提炼为独立模块
- 当前导出：
  - `firstSentence`
  - `supportRoleToPoint`
  - `buildBrief`
- 当前 brief 输出已包含 `bundle_id`
- `core_post = null` 时已有 fallback

---

## 任务 4：保留 `src/distill_posts.js` 作为兼容层

**状态：已完成**

### 已落地内容

- 当前 `src/distill_posts.js` 已变为薄适配层
- 老调用不崩
- 新调用可用

---

## 任务 5：新建 `src/draft_composer.js`

**状态：已完成**

### 已落地内容

- 已从原 `src/compose_note.js` 提炼为独立模块
- 当前导出：
  - `composeTitle`
  - `composeCoverText`
  - `composeDraft`
- 当前输出已包含：
  - `draft_id`
  - 兼容字段 `note_id`
  - `brief_id`
  - `bundle_id`
  - `source_brief_id`
  - `source_bundle_id`
  - `source_selection_id`

---

## 任务 6：保留 `src/compose_note.js` 作为兼容层

**状态：已完成**

### 已落地内容

- 当前 `src/compose_note.js` 已变为薄适配层
- 老逻辑还能跑
- 新逻辑路径成立

---

## 任务 7：新建 `src/note_artifact_io.js`

**状态：已完成**

### 已落地内容

当前已提供：

- `ensureDir`
- `writeJson`
- `writeText`
- `buildArtifactId`
- `writeBundle`
- `writeBrief`
- `writeDraft`
- `writeDraftMarkdown`
- `writeRunSummary`

### 当前落盘路径

```text
notes/bundles/<bundle_id>.json
notes/briefs/<brief_id>.json
notes/drafts/<draft_id>.json
notes/drafts/<draft_id>.md
notes/runs/<run_id>.json
```

---

## 任务 8：重构 `src/run_note_pipeline.js`

**状态：已完成（可继续优化错误粒度）**

### 已落地内容

当前 `src/run_note_pipeline.js` 已负责：

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

### 当前未完全做完的点

- [ ] 失败 stage 还没有细化到 builder 级别

---

## 任务 9：新增 `notes/bundles/` 目录约定

**状态：已完成**

### 已落地内容

- pipeline 写 bundle 时会自动创建目录
- README 已补路径说明
- dashboard 构建逻辑已能读取这一层

---

## 任务 10：更新 `scripts/build_dashboard_data.js`

**状态：已完成**

### 已落地内容

当前已支持读取：

- `notes/drafts/*.json`
- `notes/briefs/*.json`
- `notes/bundles/*.json`

当前 note 输出已包含：

- `draft_id`
- `brief_id`
- `bundle_id`
- `bundle_preview`
- `brief_preview`

并且 brief / bundle 缺失时支持 degrade，不会整条 note 丢失。

---

## 任务 11：更新 `dashboard/app.js`

**状态：已完成（最小实现）**

### 已落地内容

当前“生成内容”卡片已展示：

- `theme`
- `draft_id / brief_id / bundle_id`
- `bundle_preview`
- `brief_preview`
- `source_posts` 数量
- `created_at`

### 仍可继续优化

- [ ] 更丰富的可视化 lineage 展示
- [ ] 展开 bundle / brief 详情

---

## 任务 12：更新项目 README

**状态：已完成**

### 已落地内容

README 当前已补：

- 新 pipeline 结构图
- 4 个模块职责与路径
- artifact 落盘路径
- `run_note_pipeline.js` 的当前输入
- dashboard 如何消费这些产物
- 测试运行方式

---

## 任务 13：新增 contract 文档

**状态：已完成**

### 已落地文件

- `docs/note-pipeline-contracts.md`

---

## 四、测试状态

## 任务 14：给 `bundle_builder.js` 补测试

**状态：已完成**

### 当前覆盖

- 多账号 posts 选出 `core_post`
- `supporting_posts` 数量符合 `top_k`
- `original_only=true` 过滤非原创
- tweet 去重生效
- 空输入输出合法空 bundle

---

## 任务 15：给 `brief_builder.js` 补测试

**状态：已完成**

### 当前覆盖

- core post 存在时生成 hook / supporting points / claims
- 空 bundle 时生成 fallback brief

---

## 任务 16：给 `draft_composer.js` 补测试

**状态：已完成**

### 当前覆盖

- 输入 brief + bundle 输出合法 draft
- `draft_id / brief_id / bundle_id` 正确关联
- `body_markdown` 非空
- `source_posts` 正确继承
- 无 supporting posts 时也能生成 draft

---

## 任务 17：给 `run_note_pipeline.js` 补集成测试

**状态：已完成**

### 当前覆盖

- 整条链路跑通
- 产出：
  - bundle.json
  - brief.json
  - draft.json
  - draft.md
  - run summary
- 配置项 `rebuild_dashboard=false` 生效

---

## 五、配置和协议状态

## 任务 18：规范 `note.config.json`

**状态：已完成（当前实现已支持）**

### 当前结构

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

---

## 任务 19：增加 run summary 协议

**状态：已完成**

### 当前落盘

```text
notes/runs/<run_id>.json
```

---

## 六、兼容性与清理状态

## 任务 20：兼容旧字段，避免一次性全量破坏

**状态：已完成（主链路已统一）**

### 当前策略

- 主链路字段已统一到：
  - `bundle_id`
  - `brief_id`
  - `draft_id`
  - `source_bundle_id`
- 旧字段兼容仅保留在历史 artifacts 读取层

### 后续动作

- [ ] 继续收缩旧 artifacts 的兼容读取逻辑

---

## 任务 21：第二阶段再删除旧模块

**状态：未做（有意延后）**

### 当前策略

- 兼容层先保留
- 待所有调用切到新名字后再删：
  - `select_posts.js`
  - `distill_posts.js`
  - `compose_note.js`

---

## 七、失败处理状态

## 任务 22：统一失败语义

**状态：部分完成**

### 当前状态

- 已避免 silent fail
- `run_note_pipeline.js` 当前能返回：
  - `ok`
  - `stage`
  - `message`

### 尚未完成

- [ ] 将失败阶段进一步细化到各 builder

---

## 八、交付验收结果

### 功能验收

- [x] `BundleBuilder` 可单独运行
- [x] `BriefBuilder` 可单独运行
- [x] `DraftComposer` 可单独运行
- [x] `run_note_pipeline.js` 只做编排
- [x] 中间产物全部落盘
- [x] dashboard 能展示最终 draft
- [x] dashboard 至少兼容 bundle/brief 预览

### 结构验收

- [x] 新旧模块兼容期内都可用
- [x] artifact 路径统一
- [x] 字段命名基本统一：bundle / brief / draft

### 测试验收

- [x] 三个 builder 各自有单测
- [x] pipeline 有集成测试
- [x] 空输入/缺文件/部分失败有覆盖（基础覆盖已完成）

### 文档验收

- [x] README 更新
- [x] contract 文档补齐
- [x] 路径和字段说明与实际一致

---

## 九、推荐后续 commit / issue 方向

如果继续推进，建议下一阶段拆成这些独立工作：

1. `refactor: remove transitional compatibility fields from note artifacts`
2. `refactor: remove legacy compatibility wrappers for note pipeline`
3. `feat: make pipeline failure stages explicit per builder`
4. `feat: enrich dashboard lineage inspection UI`
