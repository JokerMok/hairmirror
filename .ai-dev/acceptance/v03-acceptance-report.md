# HairMirror V0.3 验收记录

版本：V0.3  
日期：2026-07-30  
范围：P0 咨询流程、沟通卡、Salon 咨询记录、生成队列关联、隐私与权限、可配置咨询模型适配器。

## 结论

P0 咨询链路可进入 Salon 定向试用。默认未配置模型时使用安全回退；配置 `CONSULTATION_PROVIDER_URL` 后才调用外部模型。暂不作为开放式消费者产品发布。

## 已完成

- Consumer / Stylist / Salon 角色隔离及 Salon 咨询入口。
- `POST /api/consultations`、`PATCH /api/consultations/:id` 的分析、归档、选择方案流程。
- 可持久化的分析报告、推荐方案、选中方案和沟通卡。
- 未配置外部模型时的确定性安全回退，并记录 `source`、`status`、`reason`。
- 可选 HTTP 咨询模型适配器，支持 Bearer 密钥、超时边界和失败回退。
- 咨询历史留存、删除/归档、隐私边界及生成队列关联。
- 暂不改动计费，符合当前 PRD“先验证场景、暂停商业化收费”的策略。

## 咨询模型配置

- `CONSULTATION_PROVIDER_URL`：可选，外部分析服务地址。
- `CONSULTATION_PROVIDER_API_KEY`：可选，服务端 Bearer 密钥。
- `CONSULTATION_PROVIDER_TIMEOUT_MS`：可选，默认 20000；允许范围 1000–120000。
- 请求体只发送 `{ imageId, role }`。
- 响应支持 `{ report }`、`{ data: { report } }` 或直接返回报告对象。

## 已知边界

- 当前外部模型协议尚未包含签名图片 URL 或图片二进制；真实照片分析需要模型服务能通过 `imageId` 解析图片，或后续补充存储适配器。
- 生成图片继续走现有持久化队列，咨询分析不会绕过队列。
- P1 的侧脸上传、分享链接、二维码入口和更细的账号权限 UI，以及 P2 CRM、POS、多员工管理均按 PRD 延后。
- 支付和开放式消费者发布继续延后。

## 回归命令

- `npm run build -- --webpack`
- `npm run typecheck`
- `npm run lint`（保留 1 条既有 `@next/next/no-img-element` warning，无 error）
- `npm test -- --run`
- `git diff --check`

## 对抗式复核

- 未配置、配置非法或外部 HTTP 失败时，均回退到确定性报告并返回可恢复状态；未配置时不会发出外部请求。
- 外部地址仅允许 HTTP(S)，超时值会被限制在安全范围内。
- API 路由要求登录并执行租户/角色校验；沟通卡和历史记录只返回当前账号有权访问的数据。
- 删除和归档路径遵守现有留存策略，不暴露原始图片路径。
- 计费流程保持停用/延后，没有新增误扣费路径。
