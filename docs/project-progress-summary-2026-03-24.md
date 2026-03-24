# 项目进展汇报（2026-03-24）

## 项目

`xiaohongshu-yunying-laizi-x-xingqiu`

## 一、这次改造的核心目标

把原本偏脚本式、耦合较高的小红书内容生成链路，升级为一条：

- 模块职责清晰
- 中间产物可落盘
- 可单步执行
- 可在 dashboard 中审阅 lineage
- 有基础自动化测试保护
- 有文档和 issue 闭环

的正式工程化 pipeline。

目标链路如下：

```text
Collector / Parser 输出结构化 posts
  ↓
BundleBuilder
  ↓
BriefBuilder
  ↓
DraftComposer
  ↓
notes/ artifacts
  ↓
dashboard review
```

---

## 二、这次总共完成了什么

这次实际上完成了两轮工作，共 12 张 GitHub issues，现已全部关闭。

### 第一轮（#1 ~ #6）

1. 拆分 note pipeline 为 3 个明确模块
2. 抽出统一 artifact persistence
3. 将 `run_note_pipeline.js` 收敛为 orchestrator
4. 让 dashboard 能看到 note lineage
5. 补上 builders + pipeline 测试
6. 补 README / contracts / task list / phase summary

### 第二轮（#7 ~ #12）

7. 统一主链路字段命名
8. 删除兼容层模块
9. 细化 stage-specific failure states
10. 增加单步 CLI 入口
11. 增强 dashboard 审阅能力
12. 扩展 edge / degraded case 测试覆盖

---

## 三、当前系统已经具备的能力

### 1. 模块化 note pipeline

当前已明确拆成：

- `src/bundle_builder.js`
- `src/brief_builder.js`
- `src/draft_composer.js`
- `src/run_note_pipeline.js`

各层职责清楚：
- BundleBuilder 只选素材
- BriefBuilder 只提炼写作策略
- DraftComposer 只生成草稿
- `run_note_pipeline.js` 只做编排

---

### 2. 中间产物正式落盘

当前会写出：

- `notes/bundles/*.json`
- `notes/briefs/*.json`
- `notes/drafts/*.json`
- `notes/drafts/*.md`
- `notes/runs/*.json`

这意味着当前链路已经支持：
- 调试
- 人工审核
- dashboard 消费
- 后续 agent 化接入

---

### 3. 统一 artifact IO

已新增：

- `src/note_artifact_io.js`

所有 note pipeline 的写盘动作现在都走统一 helper，而不是散落在脚本里。

---

### 4. 主链路字段已收口

当前主链路已经统一使用：

- `bundle_id`
- `brief_id`
- `draft_id`
- `source_bundle_id`

旧字段兼容已经收缩到：
- 历史 artifacts 读取层

不再继续污染新的主链路输出。

---

### 5. 兼容层模块已删除

已删除：

- `src/select_posts.js`
- `src/distill_posts.js`
- `src/compose_note.js`

当前内部主链路只保留 builders 作为正式入口。

---

### 6. 失败语义更清晰

`run_note_pipeline.js` 现在支持按阶段返回错误：

- `bundle_build_failed`
- `brief_build_failed`
- `draft_compose_failed`
- `artifact_write_failed`
- `dashboard_rebuild_failed`

这让 CLI 输出、调试和后续 agent 调用都更稳。

---

### 7. 支持单步执行

已新增 3 个阶段 CLI：

- `src/run_bundle_builder.js`
- `src/run_brief_builder.js`
- `src/run_draft_composer.js`

现在除了整条 pipeline 外，也能单独跑每一步。

这对下面几类场景很有价值：
- 调试某一层
- 人工审核
- 单步重跑
- agent 分阶段执行

---

### 8. Dashboard 已从“看结果”进化为“看链路”

当前 dashboard 已支持：

- note theme/style 筛选
- Bundle preview
- Brief preview
- Run preview
- source post 数量
- lineage ID（draft / brief / bundle / run）

也就是说，已经不只是展示生成稿，而是能审阅“这篇稿子怎么来的”。

---

### 9. 测试覆盖已明显增强

当前测试已覆盖：

- BundleBuilder
- BriefBuilder
- DraftComposer
- `run_note_pipeline.js`
- stage CLIs
- dashboard degraded input 路径

已覆盖的典型场景包括：
- 空输入
- 缺账号文件
- 空正文
- very short text
- `top_k=1`
- 单账号有数据、其他账号无数据
- brief / bundle 缺失时 dashboard 降级
- CLI 缺参 usage error
- stage-specific failure states

当前测试命令：

```bash
node --test
```

---

### 10. 文档体系已形成闭环

当前已具备这些文档：

- `docs/note-pipeline-refactor-task-list.md`
- `docs/note-pipeline-contracts.md`
- `docs/note-pipeline-phase-summary-2026-03-24.md`
- `docs/project-progress-summary-2026-03-24.md`
- `README.md`
- `README.zh-CN.md`

这意味着：
- 任务规划有记录
- 数据契约有记录
- 阶段总结有记录
- 项目进展有记录
- README 有入口

---

## 四、这次实际改了哪些文件

### 新增文件（核心）

- `src/bundle_builder.js`
- `src/brief_builder.js`
- `src/draft_composer.js`
- `src/note_artifact_io.js`
- `src/run_bundle_builder.js`
- `src/run_brief_builder.js`
- `src/run_draft_composer.js`

### 新增测试

- `test/bundle_builder.test.js`
- `test/brief_builder.test.js`
- `test/draft_composer.test.js`
- `test/run_note_pipeline.test.js`
- `test/stage_clis.test.js`
- `test/dashboard_data.test.js`

### 新增文档

- `docs/note-pipeline-refactor-task-list.md`
- `docs/note-pipeline-contracts.md`
- `docs/note-pipeline-phase-summary-2026-03-24.md`
- `docs/project-progress-summary-2026-03-24.md`

### 重点修改文件

- `src/run_note_pipeline.js`
- `scripts/build_dashboard_data.js`
- `dashboard/index.html`
- `dashboard/app.js`
- `dashboard/styles.css`
- `README.md`
- `README.zh-CN.md`

### 已删除

- `src/select_posts.js`
- `src/distill_posts.js`
- `src/compose_note.js`

---

## 五、相关关键提交

### 第一轮
- `ad8089c` — `refactor: introduce bundle brief and draft builders`
- `923102e` — `refactor: centralize note artifacts and orchestrate note pipeline`
- `81642fa` — `feat: expose note lineage in dashboard data`
- `5644829` — `test: add note pipeline unit and integration coverage`

### 文档与总结
- `bd661d4` — `docs: add note pipeline refactor plan and contracts`
- `d24360b` — `docs: link note pipeline docs from README`
- `bd45eb6` — `docs: add note pipeline phase summary`

### 第二轮
- `13a5a9a` — `refactor: unify canonical note pipeline identifiers`
- `1b5065e` — `refactor: remove compatibility wrapper modules`
- `c7b8d6c` — `feat: add stage-specific note pipeline failure states`
- `4c508c2` — `feat: add standalone note pipeline stage CLIs`
- `3817fc8` — `feat: improve dashboard review surfaces for note lineage`
- `3a38e31` — `test: expand note pipeline edge and degraded coverage`

---

## 六、当前项目状态判断

### 已完成的事情

从工程化角度看，这条 note pipeline 已经完成了从“可跑脚本”到“正式模块化链路”的第一阶段升级。

已经具备：
- 模块边界
- artifact 协议
- 单步 CLI
- dashboard 审阅
- 测试保护
- docs 闭环
- issue 闭环

### 还没有做的事情

目前还没做，但后面值得考虑的方向：

1. 更强的 dashboard 审批/操作能力
   - 比如人工确认、状态流转、标注是否可发布

2. 历史 artifacts 的清理或归档机制
   - 现在会持续积累 `notes/` 产物

3. 发布链路
   - 从 draft 到真正发小红书的后半段还没工程化

4. 更高级的文案生成策略
   - 当前 DraftComposer 仍是偏模板化组合

5. CI / GitHub Actions
   - 现在测试能跑，但还没有自动化 CI 护栏

---

## 七、建议的下一步优先级

### P1
1. 给 dashboard 增加“可发布 / 待修改 / 废弃”等审核状态
2. 增加历史 artifacts 清理或归档规则
3. 把 `node --test` 接到 GitHub Actions

### P2
4. 增强 DraftComposer 的生成质量
5. 设计从 draft 到 publish 的发布链路
6. 引入更完整的运营工作台能力

---

## 八、一句话总结

**这次已经把小红书 note pipeline 从一条脚本式生成链路，升级成了一个模块清晰、产物可追踪、可单步运行、可 dashboard 审阅、并有自动化测试保护的工程化内容生产系统。**
