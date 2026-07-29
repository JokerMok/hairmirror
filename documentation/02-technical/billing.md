# Paddle Billing 支付与权益

## 产品结构

- 登录用户首次完整体验免费。
- Personal Preview Pack：一次性购买，默认 5 次完整体验，失败任务不扣次数。
- Salon Pro：月度订阅，门店管理员与员工共享月度额度。
- Personal Plus 作为可选月度套餐保留，未配置 Price ID 时不展示。

## 系统流程

定价页向服务端提交购买类型。服务端创建或复用 Paddle Customer，并创建带有 `userId`、`planCode` 的 Transaction。浏览器只使用 Paddle Client-side Token 打开 Overlay Checkout，不接触 API Key。

付款完成后，Paddle 向 `/api/webhooks/paddle` 发送通知。服务端使用原始请求体、`Paddle-Signature` 和 Webhook Secret 验签。只有 `transaction.completed` 可以发放次数；订阅状态以 `subscription.*` 事件为准；已批准退款通过 `adjustment.updated` 撤回未使用次数。事件 ID 与交易 ID 均作幂等控制，失败事件允许安全重试。

账号页展示本地已确认的套餐、剩余额度和交易记录。PDF 账单通过服务端验证交易归属后从 Paddle 获取。更换付款方式、取消订阅等敏感操作进入 Paddle Customer Portal。

## 必需配置

```text
BILLING_PROVIDER=paddle
PADDLE_ENVIRONMENT=sandbox
PADDLE_API_KEY=...
PADDLE_WEBHOOK_SECRET=...
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=...
PADDLE_PERSONAL_PACK_PRICE_ID=pri_...
PADDLE_SALON_PRO_PRICE_ID=pri_...
PADDLE_PERSONAL_PLUS_PRICE_ID=
PERSONAL_PACK_SETS=5
```

Sandbox 验收通过后，将环境切换为 `production` 并替换为 Live API Key、Client-side Token、Webhook Secret 和 Live Price IDs。Sandbox 与 Live 的商品、价格和密钥不能混用。

## 发布验收

必须完成一次性购买、重复 Webhook、订阅创建、续费、逾期、取消、全额退款、客户门户、账单下载和跨账号账单访问拦截测试。真实支付测试前不得将 `BILLING_PROVIDER` 切换为 `paddle`。

已有 Gumroad 次数已经进入本地钱包，继续有效；已有 Gumroad 订阅在迁移期仍可作为后备权益来源。新购买不再要求用户填写 License Key。
