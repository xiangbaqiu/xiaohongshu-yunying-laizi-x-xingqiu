# Draft To Publish Workflow

## 目标

把当前仓库里已经存在的：

- `notes/drafts/*.json`
- `notes/drafts/*.md`
- `review_status`
- dashboard review flow

往后延伸成一条可操作、可追踪、但仍然保持本地优先的发布链路。

本文档描述的是 **下一阶段设计**，不是当前仓库已全部实现的能力。

---

## 当前基线

当前系统已经具备：

1. draft / review artifact 已正式落盘
2. draft 有显式 `review_status`
3. dashboard 可以做：
   - `reviewing`
   - `approved`
   - `needs_edit`
   - `rejected`
4. draft artifact 已能持久化：
   - `review_status`
   - `review_annotation`
   - `review_history`

当前还没有正式工程化的是：

- approved 之后如何交接成可发布 payload
- 发布动作如何记录
- 发布后如何把外部结果写回当前 artifact lineage

---

## 设计原则

1. 不直接把“发布”混成一个不可追踪的人工步骤
2. 不在第一阶段自动调用小红书发布接口
3. 尽量复用现有 draft / run / dashboard 结构，不重做主链路
4. 让“准备发布”和“已经发布”都有独立 artifact，可审计、可回溯
5. 让手工操作只发生在真正需要人工判断的地方

---

## 一阶段建议范围

先补齐下面三件事：

1. 从 `approved` draft 生成 publish-ready payload
2. 人工在小红书侧完成最终编辑与发布
3. 把发布结果回写为 publish record，并把 draft 标成 `published`

不建议一阶段做的事情：

- 自动调用小红书发布接口
- 自动上传图片/封面
- 自动做发布时间排程
- 在 dashboard 中实现完整富文本编辑器

---

## 状态模型

当前 review status 已有：

- `draft`
- `reviewing`
- `approved`
- `needs_edit`
- `rejected`
- `published`

建议继续沿用这组状态，不再额外引入 `publish_ready` 作为新 status。

原因：

1. `publish_ready` 更像一个交接阶段，而不是 review judgement
2. 当前 dashboard / artifact 已围绕 review status 建立，少加状态更稳
3. “是否已经生成 publish payload” 更适合用独立 artifact 表达

因此：

- `approved` 表示审核通过，可以进入发布准备
- `published` 表示已经有明确发布记录
- “待发布但未发出”由 publish-ready artifact 表达，而不是新增 status

---

## 核心流程

```text
draft
  ↓ dashboard review
reviewing
  ↓
approved
  ↓ generate publish-ready payload
notes/publish-ready/<draft_id>.json
  ↓ operator manual edit + publish in Xiaohongshu
notes/publish-records/<publish_record_id>.json
  ↓ write back published result
draft.review_status = published
```

---

## 角色分工

### 1. Pipeline

负责：

- 生成 bundle / brief / draft / run
- 保持 lineage 完整

不负责：

- 决定是否可发布
- 真正执行小红书发布

### 2. Reviewer / Operator

负责：

- 在 dashboard 中做审核流转
- 给出批注和修改建议
- 决定某篇 approved draft 是否进入发布
- 在小红书侧做最终人工编辑和实际发布

### 3. Publish recorder

可以是轻量脚本，也可以是 dashboard 的下一阶段操作。

负责：

- 记录发布结果
- 回写 draft 的 `published` 状态
- 建立 draft 与外部发布结果的可追踪关系

---

## 新增 artifact 设计

### 1. Publish-ready payload

建议路径：

```text
notes/publish-ready/<draft_id>.json
```

作用：

- 把一个 `approved` draft 转成“准备发”的标准交接包
- 给人工发布提供稳定输入
- 固化真正准备拿去发的文本版本，避免后续追责时只剩 draft 快照

建议字段：

```json
{
  "publish_ready_id": "publish-ready-draft-1742880000000",
  "draft_id": "draft-1742790000200",
  "brief_id": "brief-1742790000100",
  "bundle_id": "bundle-1742790000000",
  "theme": "AI coding",
  "style": "trend-analysis",
  "title": "我把最近 X 上关于 AI coding 的讨论，整理成了一篇笔记",
  "body_markdown": "...",
  "hashtags": ["#AI", "#小红书运营", "#AIcoding"],
  "source_posts": [],
  "review_annotation": {},
  "prepared_at": "2026-03-25T10:00:00.000Z",
  "prepared_by": "xiangbaqiu",
  "source_review_status": "approved",
  "editable_fields": ["title", "body_markdown", "hashtags", "cover_text"]
}
```

说明：

- 它不是新的内容生成阶段
- 它是“审核通过后的发布交接包”
- 它应该保留和 draft 的 lineage 关系

### 2. Publish record

建议路径：

```text
notes/publish-records/<publish_record_id>.json
```

作用：

- 记录外部平台上真实发生过的发布
- 让 `published` 不只是一个状态，而是一个有证据的结果

建议字段：

```json
{
  "publish_record_id": "publish-1742883600000",
  "draft_id": "draft-1742790000200",
  "publish_ready_id": "publish-ready-draft-1742880000000",
  "platform": "xiaohongshu",
  "published_at": "2026-03-25T11:00:00.000Z",
  "published_by": "xiangbaqiu",
  "platform_post_id": "xhs-note-id",
  "platform_post_url": "https://www.xiaohongshu.com/...",
  "final_title": "...",
  "final_body_markdown": "...",
  "final_hashtags": ["#AI", "#小红书运营", "#AIcoding"],
  "notes": "发布前做了轻微措辞修改"
}
```

说明：

- 这里允许记录“最终发布版本”和 approved draft 略有偏差
- 这是必要的，因为真实发布前通常会有人工微调

---

## Draft 回写规则

当 publish record 写入后，建议同步更新对应 draft artifact：

```json
{
  "review_status": "published",
  "published_at": "2026-03-25T11:00:00.000Z",
  "publish_record_id": "publish-1742883600000",
  "publish_ready_id": "publish-ready-draft-1742880000000",
  "published_platform": "xiaohongshu",
  "published_url": "https://www.xiaohongshu.com/..."
}
```

同时在 `review_history` 里追加一条 transition：

```json
{
  "from": "approved",
  "to": "published",
  "source": "publish_recorder",
  "updated_at": "2026-03-25T11:00:00.000Z",
  "annotation": {
    "operator_identity": "xiangbaqiu",
    "review_status": "published",
    "reviewer_note": "Published to Xiaohongshu"
  }
}
```

这样 `published` 既能在 dashboard 里显示，也能反查具体发布记录。

---

## 推荐状态流转

### 正常路径

```text
draft
→ reviewing
→ approved
→ published
```

### 需要修改

```text
draft
→ reviewing
→ needs_edit
→ reviewing
→ approved
→ published
```

### 放弃发布

```text
draft
→ reviewing
→ rejected
```

### 已通过但暂不发布

```text
approved
→ 保持 approved
```

说明：

- `approved` 不代表必须立刻发
- 只有当 publish record 存在时，才进入 `published`

---

## Dashboard 下一阶段建议

当前 dashboard 已经能做 review action。下一阶段建议只补最小功能：

1. 对 `approved` draft 增加“生成发布包”操作
2. 在 note 卡片里展示是否已有 publish-ready artifact
3. 增加“记录已发布”操作，要求填写：
   - 发布人
   - 发布时间
   - 平台链接
   - 可选发布备注
4. 在 note detail 中展示：
   - publish ready 时间
   - publish record 时间
   - 外部发布 URL

不建议下一阶段就做：

- dashboard 内直接排版最终正文
- dashboard 内直接上传图片
- dashboard 内直接调用平台发布

---

## 自动化与人工边界

### 适合自动化

- 从 approved draft 生成 publish-ready payload
- 校验必填字段是否完整
- 回写 publish record
- dashboard 展示 publish traceability

### 必须保留人工判断

- 最终标题和语气微调
- 封面与配图选择
- 是否现在就发
- 平台侧真实发布动作

这样能保证系统先把“可追踪性”补齐，而不是过早进入高风险平台自动化。

---

## 与现有仓库结构的对应关系

当前已有：

- `notes/bundles/`
- `notes/briefs/`
- `notes/drafts/`
- `notes/runs/`
- `review_status`
- dashboard review annotations

建议新增：

- `notes/publish-ready/`
- `notes/publish-records/`

这样新的发布链路仍然保持“artifact-first”风格，和当前仓库结构一致。

---

## 一阶段验收标准

当后续真正实现时，建议按下面标准验收：

1. `approved` draft 可以生成 publish-ready artifact
2. operator 可以记录一次真实发布结果
3. draft 能从 `approved` 回写成 `published`
4. dashboard 可以看到 publish traceability
5. 历史 publish record 可按 `draft_id` 追溯

---

## 一句话结论

下一阶段不应该直接做“自动发小红书”，而应该先把 `approved draft -> publish-ready payload -> publish record -> published writeback` 这条轻量但可追踪的后半段补齐。
