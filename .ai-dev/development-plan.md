# HairMirror V0.3 开发计划

## 技术决策

1. 在现有 Next.js、SQLite/Postgres 兼容数据层和队列上增量扩展，不引入新框架。
2. Consultation 以引用 ID 关联原图与生成资产，分析/推荐保存版本化 JSON；所有写接口携带幂等键。
3. AI provider 采用严格 schema + deterministic fixture + 可插拔真实 provider；生成 provider 保留现有 RunningHub/本地演示路径。
4. Tenant boundary 以 `salon_id` 和角色检查作为 API 第一层，页面检查不能替代服务端授权。
5. 通过 feature flag 暂停收费，不删除 Paddle 数据或代码；迁移采用向前兼容字段，失败可回滚。

## 依赖批次

```text
Wave 1: T001, T002, T003
Wave 2: T004, T007
Wave 3: T005, T006, T008, T009
Wave 4: T010
```

依赖图：T004←T001,T003；T005←T001,T004；T006←T003,T004；T007←T003,T004；T008←T001,T002；T009←T001；T010←T001..T009。

## 数据与迁移

新增 `salons`, `consultations`, `consultation_recommendations`, `consultation_shares`（P1 预留）及必要索引；使用 `photo_asset_id`、`generated_asset_id` 引用现有资产。迁移前备份，失败执行数据回滚脚本；旧 `design_tasks` 不迁移，保持读取兼容。

## 全局验收

开发完成后依次运行 `.ai-dev/test-plan.md` 命令，再进行权限、隐私、移动端和收费开关对抗式审查。任何 P0 失败、跨租户泄露、原图残留或付款入口误显示均阻止发布。

## 交付策略

先 deterministic fixture 验证咨询产品链路，再接真实分析模型；先邀请 2 家 Salon 内测，确认记录/卡片/失败兜底后扩展到 20 家。未获得用户明确批准前不启动开发代理、不创建 approval.json。

