# Note Pipeline 阶段性总结（2026-03-24）

## 本轮目标

将原本相对耦合的 note 生成链路，重构为职责明确、可单独验证、可中间落盘、可被 dashboard 消费的模块化 pipeline。

目标链路：

```text
Collector / Parser 输出结构化 posts
  ↓
BundleBuilder
  ↓
BriefBuilder
  ↓
DraftComposer
  ↓
notes/ artifacts + dashboard
```

---

## 本轮已完成内容

### 1. 模块拆分完成

新增模块：

- `src/bundle_builder.js`
- `src/brief_builder.js`
- `src/draft_composer.js`

兼容层保留：

- `src/select_posts.js`
- `src/distill_posts.js`
- `src/compose_note.js`

说明：
- 已完成核心职责拆分
- 旧入口暂时保留，避免一次性打断现有调用
- 新命名已引入：`bundle_id` / `brief_id` / `draft_id`

---

### 2. Artifact persistence 完成

新增：

- `src/note_artifact_io.js`

当前 note pipeline 输出：

- `notes/bundles/*.json`
- `notes/briefs/*.json`
- `notes/drafts/*.json`
- `notes/drafts/*.md`
- `notes/runs/*.json`

说明：
- 中间产物已成为一等公民
- 支持调试、审阅、dashboard 消费与后续 agent 化

---

### 3. Orchestrator 收敛完成

重构：

- `src/run_note_pipeline.js`

当前职责：
- 读配置
- 调用 BundleBuilder
- 调用 BriefBuilder
- 调用 DraftComposer
- 统一落盘 artifacts
- 写 run summary
- 可选触发 dashboard rebuild

说明：
- `run_note_pipeline.js` 已不再承载具体业务细节
- pipeline 主链路已清晰稳定

---

### 4. Dashboard lineage 接入完成

更新：

- `scripts/build_dashboard_data.js`
- `dashboard/app.js`

当前 dashboard note 数据已支持：
- `draft_id`
- `brief_id`
- `bundle_id`
- `bundle_preview`
- `brief_preview`

说明：
- dashboard 不再只展示草稿结果
- 现在可以追踪草稿来自哪组 bundle、brief 如何总结

---

### 5. 测试补齐完成

新增测试：

- `test/bundle_builder.test.js`
- `test/brief_builder.test.js`
- `test/draft_composer.test.js`
- `test/run_note_pipeline.test.js`

当前测试覆盖：
- BundleBuilder 单测
- BriefBuilder 单测
- DraftComposer 单测
- run_note_pipeline 集成测试

验证方式：

```bash
node --test
```

说明：
- builders 与 pipeline 已有基础回归保护
- 空输入、兼容结构、artifact 写盘等关键路径已覆盖

---

### 6. 文档对齐完成

已补齐并对外可见：

- `docs/note-pipeline-refactor-task-list.md`
- `docs/note-pipeline-contracts.md`
- `README.md`
- `README.zh-CN.md`

说明：
- 任务清单、contracts、README 已形成闭环
- 新同学可以从 README 直接进入设计与契约文档

---

## 相关提交

- `ad8089c` — `refactor: introduce bundle brief and draft builders`
- `923102e` — `refactor: centralize note artifacts and orchestrate note pipeline`
- `81642fa` — `feat: expose note lineage in dashboard data`
- `5644829` — `test: add note pipeline unit and integration coverage`
- `bd661d4` — `docs: add note pipeline refactor plan and contracts`
- `d24360b` — `docs: link note pipeline docs from README`

---

## 当前系统状态

### 已达成

- note pipeline 已模块化
- 中间产物已落盘
- dashboard 已可见 lineage
- 测试已补齐基础覆盖
- GitHub issues 已全部关闭

### 当前仍保留的过渡策略

- `selection_id ↔ bundle_id`
- `note_id ↔ draft_id`
- 旧模块文件暂保留兼容层

说明：
- 这是为了避免一次性升级打断旧调用
- 后续稳定后，可以进入“兼容层清理阶段”

---

## 下一阶段建议

### 优先级 P1

1. 清理兼容层并统一字段命名
   - 目标：彻底统一到 `bundle_id / brief_id / draft_id`

2. 提升失败语义
   - 将当前统一 `artifact_write_failed` 细化为：
     - `bundle_build_failed`
     - `brief_build_failed`
     - `draft_compose_failed`
     - `dashboard_rebuild_failed`

3. 增强 dashboard 审阅能力
   - 展示更多 brief / bundle 摘要
   - 增加 run summary 可见性

### 优先级 P2

4. 增加 CLI / script 级单模块运行入口
   - 单独运行 bundle / brief / draft 生成

5. 为 note pipeline 补更多 fixture 和 edge case 测试
   - 空账号
   - 缺字段
   - 极短文本
   - 重复 tweet

6. 评估后续是否引入更强的 draft composition 机制
   - 在结构稳定后，再考虑更复杂的生成策略

---

## 一句话总结

**这一轮已经把 note pipeline 从“能跑的串联脚本”，升级成了“职责清晰、可审阅、可测试、可扩展的模块化内容生成链路”。**
