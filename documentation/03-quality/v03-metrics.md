# HairMirror V0.3 验证指标

## 事件口径

产品事件通过 `POST /api/analytics` 采集，服务端统一写入时间。事件采用严格枚举，不接受自由文本、邮箱、手机号、图片内容、提示词或文件路径。身份和门店只保存带服务端盐的截断 SHA-256 摘要，不能由事件记录还原。

| 事件 | 关键字段 | 用途 |
| --- | --- | --- |
| `role_selected` | `role`, `entryPoint` | 客户/发型师入口转化；Salon 激活起点 |
| `photo_uploaded` | `role`, `surface`, `photoCount`, `source`, `fileType`, `fileSizeBucket` | 上传率和输入质量 |
| `analysis_completed` | `confidenceBand`, `recommendationCount`, `duration` | AI 分析完成率和耗时分布 |
| `recommendations_viewed` | `recommendationCount`, `viewMode` | 推荐阅读与对比使用 |
| `generation_succeeded` | `variantCount`, `duration` | 生成完成率和成功耗时 |
| `generation_failed` | `errorCode`, `retryable` | 失败原因和补偿优先级 |
| `communication_card_copied` | `format`, `hasSelectedStyle` | 发型师沟通卡使用 |
| `consultation_saved` | `recommendationCount`, `hasSelectedStyle` | Salon 有效咨询与复用 |

## Salon 激活与周使用

服务端事件详情统一带有 `schema_version`、`actor_role`、`tenant_type`、`actor_hash`、`tenant_hash`、`authenticated`。其中 `tenant_hash` 用于去重门店，`actor_hash` 用于去重发型师，不保存可识别个人信息。

周统计以 UTC 周一 00:00 为起点，可由 `getSalonWeeklyMetrics()` 聚合：

- `activatedSalons`：本周产生 `role_selected` 或 `consultation_saved` 的去重门店数。
- `activeSalons`：本周产生任意 Salon 事件的去重门店数。
- `activeStylists`：本周产生事件的去重发型师数。
- `consultationsSaved`：本周保存咨询数。
- `generationSuccessRate`：Salon 生成成功数 / 生成成功与失败总数。

产品验证阶段重点观察：上传率 ≥ 50%、生成完成率 ≥ 70%、每周实际使用 Salon 数，以及每个 Salon 的有效咨询次数。事件契约不承担客户内容存档；咨询内容仍由咨询数据模型负责。

