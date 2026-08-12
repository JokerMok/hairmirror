# HairMirror V0.3 测试计划

每个测试均映射 PRD 需求；同时覆盖正常、异常、空态、边界、权限、安全和回归。

| ID | 需求 | 层级 | 场景与预期 |
|---|---|---|---|
| TEST-001 | REQ-001 | UI/E2E | Consumer/Stylist 入口可选；未登录创建咨询跳转登录；375px 无横向滚动。 |
| TEST-002 | REQ-002 | API/单元 | 非法格式、>8MB、签名异常、低于 512×512 的照片被拒；前端要求创建者确认单人、正面、清晰。多人/无脸自动识别留给外部视觉质量模型。 |
| TEST-003 | REQ-003 | 单元/契约 | 合法 JSON 通过；缺字段、额外危险字段、非 JSON 进入 fallback 并返回错误码。 |
| TEST-004 | REQ-004 | 单元/契约 | 最多 3 项，每项字段齐全；低置信度包含限制说明；空推荐可解释。 |
| TEST-005 | REQ-005 | API/集成 | 创建后刷新可读；重复 request id 幂等；删除咨询级联/软删除资产。 |
| TEST-006 | REQ-006 | 集成/API | 全部成功、全部失败、结果缺失、取消、重试；咨询级状态和一次性权益结算一致，部分失败仍可查看报告和卡片。 |
| TEST-007 | REQ-007 | 单元/UI | 卡片字段顺序稳定；复制成功；缺失字段显示确认项而非 undefined。 |
| TEST-008 | REQ-008 | API/安全 | 同租户可读，跨租户 404/403；Consumer 无分享凭证不能读 Salon 记录；越权 URL 不泄露数据。 |
| TEST-009 | REQ-009 | API/E2E | 历史空态、分页、详情、删除、30 天清理；删除后原图 URL 不可访问。 |
| TEST-010 | REQ-010 | 回归 | feature flag 关闭付费入口；现有 Paddle/权益 API 不报错，数据库旧账单仍可读。 |
| TEST-011 | GOAL-006 | 性能 | fixture 下分析 p95 ≤10s；队列场景记录完成/失败耗时，超过阈值告警。 |
| TEST-012 | 全部 | 回归 | 现有 `src/app/api/auth`, `design-tasks`, `billing`, `webhooks/paddle` 测试通过；`npm run check` 通过。 |

## 自动化命令

`npm run check`
`npm test -- --run`

本轮浏览器验收使用本地浏览器完成入口、登录目标、鉴权重定向和 console error 冒烟；项目当前未配置 Playwright runner，不能把不存在的 E2E 命令作为通过证据。
