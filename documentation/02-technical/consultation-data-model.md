# Consultation 数据模型与授权边界

## 范围

V0.3 以发型咨询为核心。`salons`、`consultations` 与 `recommendations` 是新增领域表，旧的设计任务、生成任务和账单表保持原有语义。

## 偏好契约

咨询流程把发型处理方式和发色意图拆成独立字段：

- `treatmentMode`：`cut_only` 或 `perm_allowed`。
- `colorMode`：`preserve` 或 `change`，默认 `preserve`。
- `targetHairColor`：预设发色或 `custom`；当 `colorMode` 为 `change` 时必填。
- `customHairColor`：仅当 `targetHairColor` 为 `custom` 时必填。

同一份偏好快照会在付费生成任务入队前写入任务和咨询 JSON。缺少 `colorMode` 的历史数据按 `preserve` 读取；旧 `chemical` 只映射到 `treatmentMode`，不会授权改变发色。RunningHub 会在每个模板描述前、提示词结尾分别接收发色保持或明确目标发色约束。

## 数据模型

| 表 | 关键字段 | 约束 |
| --- | --- | --- |
| `salons` | `id`, `name`, `owner_user_id`, `created_at`, `updated_at` | 门店主体；拥有者可为空，以兼容导入数据 |
| `consultations` | `id`, `salon_id`, `customer_user_id`, `stylist_user_id`, `status`, `source_photo_path`, `analysis_json`, `generated_images_json`, `selected_recommendation_id` | 至少由门店或消费者关联；状态使用固定枚举 |
| `recommendations` | `id`, `consultation_id`, `style_name`, `rationale`, `execution_json`, `image_url`, `rank` | 必须归属于一条咨询；删除咨询时级联删除 |

迁移使用 `CREATE TABLE IF NOT EXISTS` 与 `CREATE INDEX IF NOT EXISTS`，可在已有数据库上重复执行。外键在数据库连接级别启用，删除策略不会影响旧的 `design_tasks`、使用记录或账单读取。

## 咨询状态

允许的状态：`draft`、`analyzing`、`ready`、`shared`、`completed`、`archived`。

状态流转：

```text
draft -> analyzing -> ready -> shared -> completed -> archived
  |          |          |       |          |
  +----------+----------+-------+----------+--> archived
```

除自身状态保持外，只允许领域服务定义的流转；`archived` 为终态。非法流转返回 `INVALID_STATUS_TRANSITION`。

## 租户授权

- `consumer` 只能读取自己作为 `customer_user_id` 的咨询。
- `stylist` 与 `salon_admin` 必须携带 `tenantId`，且必须与咨询的 `salon_id` 完全相等。
- 缺少门店租户返回 `TENANT_REQUIRED`；跨门店访问统一返回 `CONSULTATION_FORBIDDEN`。
- 推荐方案必须通过 `consultation_id` 归属校验，归属不一致返回 `RECOMMENDATION_NOT_FOUND`。

错误码全集：`CONSULTATION_NOT_FOUND`、`CONSULTATION_FORBIDDEN`、`INVALID_STATUS_TRANSITION`、`INVALID_CONSULTATION_INPUT`、`RECOMMENDATION_NOT_FOUND`、`TENANT_REQUIRED`。

## 收费暂停开关

服务端读取 `BILLING_PAUSED`。未配置或值无法解析时默认为 `true`，避免验证期间误扣款；显式使用 `false` 才允许后续计费能力读取。该开关只提供底层配置，不改变页面和旧账单接口。
