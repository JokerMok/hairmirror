# 发型镜（AI Hairstyle Studio）

面向个人用户和理发门店的 AI 发型预览产品。用户端默认英文并支持中文切换；美国和东南亚用户统一使用 Paddle Billing 美元结算。登录账号可完成一次免费体验，个人用户购买次数包，门店使用共享月度订阅。当前版本包含三层账号、模型与密钥配置、持久化生成队列、计费权益、额度与成本控制、数据留存、运行监控及备份回滚能力。

## 本地运行

```bash
npm install
cp .env.example .env.local
npm run dev
```

产品入口：`http://127.0.0.1:3000`

运营入口：`http://127.0.0.1:3000/admin`

运行监控：`http://127.0.0.1:3000/admin/operations`

订阅定价：`http://127.0.0.1:3000/pricing`

## 队列 Worker

生产或稳定内测环境必须单独启动 Worker，并配置 `INTERNAL_JOB_SECRET`：

```bash
npm run worker
```

单实例本地演示可保留内联 Worker。多实例部署应设置 `DISABLE_INLINE_WORKER=1`，统一由独立 Worker 消费持久化队列。

## 验证与运维

```bash
npm run check
npm run release:create -- 0.2.0
npm run rollback:code -- release/0.2.0 --confirm
npm run rollback:data -- --backup <备份目录> --confirm
```

环境变量、维护频率、备份与回滚步骤见 [项目文档](documentation/README.md)。

Paddle Checkout、Webhook、账单门户和权益校验流程见 [支付接入文档](documentation/02-technical/billing.md)。Gumroad 数据仅作历史权益兼容。

## Railway 预上线

项目使用单服务运行 Web 与 Worker，持久卷统一挂载到 `/app/data`。Railway 会自动注入卷路径，启动程序将 SQLite、生成结果、原图和备份写入同一个持久卷。部署步骤及环境变量见 [Railway 部署说明](documentation/02-technical/railway-deployment.md)。

## 上线边界

当前 SQLite 与本地私有文件目录适合单机部署和受控内测。公开商用前应迁移至托管数据库和私有对象存储，并完成真人黄金样本评测、告警通道验证及恢复演练。
