# 环境变量

| 变量                                        | 用途                                       | 生产要求                     |
| ------------------------------------------- | ------------------------------------------ | ---------------------------- |
| `ADMIN_ACCESS_KEY`                          | 运营台访问密钥                             | 必填                         |
| `INTERNAL_JOB_SECRET`                       | Worker、维护和内部备份接口密钥             | 必填，使用随机长密钥         |
| `MODEL_SECRET_KEY`                          | AES-256-GCM 模型密钥主密钥，32 字节 Base64 | 必填                         |
| `SQLITE_PATH`                               | SQLite 数据库路径                          | 单机部署必填                 |
| `GENERATED_ASSETS_DIR`                      | 私有生成结果目录                           | 单机部署必填                 |
| `SOURCE_UPLOADS_DIR`                        | 临时原图目录                               | 单机部署必填                 |
| `GENERATION_RATE_LIMIT_15M`                 | 每主体及网络 15 分钟任务上限               | 默认 10                      |
| `GENERATION_RATE_LIMIT_DAILY`               | 每主体及网络日任务上限                     | 默认 30                      |
| `GENERATION_GLOBAL_DAILY_LIMIT`             | 平台日任务总量上限                         | 默认 100                     |
| `GENERATION_GLOBAL_DAILY_COST_LIMIT_MICROS` | 24 小时实际费用与排队承诺费用总上限，微元  | 默认 20000000                |
| `GENERATION_DEFAULT_COST_PER_IMAGE_MICROS`  | 模型成本未知时的单图保守估值，微元         | 默认 70000                   |
| `GENERATION_MAX_ATTEMPTS`                   | 自动尝试总次数                             | 默认 3                       |
| `DISABLE_INLINE_WORKER`                     | 设为 1 后仅允许独立 Worker 消费            | 多实例必设为 1               |
| `JOB_STALE_MS`                              | 任务心跳失效阈值，应大于最长模型超时       | 默认 900000                  |
| `WORKER_BASE_URL`                           | Worker 访问的应用地址                      | 必填                         |
| `PUBLIC_APP_URL`                            | 对外访问地址，用于登录及表单跳转            | 生产环境必填                 |
| `WORKER_POLL_MS`                            | Worker 空闲轮询间隔                        | 默认 2000                    |
| `MAINTENANCE_INTERVAL_MS`                   | Worker 维护调用间隔                        | 默认 900000                  |
| `ALERT_WEBHOOK_URL`                         | 告警接收地址                               | 正式环境必填并验证           |
| `ALERT_FAILURE_RATE`                        | 小时失败率告警线                           | 默认 0.2                     |
| `ALERT_FAILURE_MIN_SAMPLES`                 | 失败率统计最小样本数                       | 默认 5                       |
| `ALERT_QUEUE_AGE_MS`                        | 最老排队任务告警线                         | 默认 300000                  |
| `ALERT_DAILY_COST_MICROS`                   | 24 小时成本告警线                          | 默认 10000000                |
| `BACKUP_DIR`                                | 备份目录                                   | 必填，建议独立磁盘或异地同步 |
| `BACKUP_INTERVAL_HOURS`                     | 自动备份间隔                               | 默认 24                      |
| `BACKUP_RETENTION_COUNT`                    | 本地备份保留数量                           | 默认 7                       |
| `APP_VERSION`                               | 写入备份清单和运行信息的版本号             | 每次发布更新                 |
| `PUBLIC_APP_URL`                            | 应用公开 HTTPS 地址                        | 正式环境必填                 |
| `BILLING_PROVIDER`                          | 主支付通道：正式使用 `paddle`               | 上线前必填                    |
| `PADDLE_ENVIRONMENT`                        | `sandbox` 或 `production`                   | 联调默认 `sandbox`            |
| `PADDLE_API_KEY`                            | Paddle 服务端 API Key                       | Paddle 环境必填               |
| `PADDLE_WEBHOOK_SECRET`                     | Paddle Webhook 验签密钥                     | Paddle 环境必填               |
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`            | Paddle.js 公开客户端令牌                    | Paddle 环境必填               |
| `PADDLE_PERSONAL_PACK_PRICE_ID`              | 个人次数包 Price ID                         | 开放个人购买前必填            |
| `PADDLE_PERSONAL_PLUS_PRICE_ID`              | 可选个人月度套餐 Price ID                   | 未启用时留空                  |
| `PADDLE_SALON_PRO_PRICE_ID`                  | 门店月度套餐 Price ID                       | 开放门店订阅前必填            |
| `BILLING_SECRET_KEY`                        | AES-256-GCM 订阅密钥主密钥，32 字节 Base64 | Gumroad 收费环境必填         |
| `GUMROAD_PERSONAL_PACK_PRODUCT_ID`          | 个人次数包的 Gumroad Product ID             | 开放个人购买前必填           |
| `GUMROAD_PERSONAL_PACK_CHECKOUT_URL`        | 个人次数包公开购买地址                      | 开放个人购买前必填           |
| `GUMROAD_PERSONAL_PACK_PRICE_USD`           | 个人次数包页面展示美元价                    | 默认 1.99                    |
| `PERSONAL_PACK_SETS`                        | 每个个人次数包包含的完整体验数              | 默认 5                       |
| `GUMROAD_SALON_PRODUCT_ID`                  | Salon Pro 的 Gumroad Product ID             | Gumroad 收费环境必填         |
| `GUMROAD_SALON_CHECKOUT_URL`                | Salon Pro 公开购买地址                      | 开放购买前必填               |
| `GUMROAD_SALON_MONTHLY_PRICE_USD`            | Salon Pro 页面展示美元月价                  | Gumroad 收费环境必填         |
| `GUMROAD_VERIFY_TIMEOUT_MS`                 | License API 单次超时                        | 默认 10000                   |
| `GUMROAD_REFRESH_INTERVAL_MS`               | 订阅复核间隔                               | 默认 21600000                |
| `GUMROAD_VERIFICATION_GRACE_MS`             | Gumroad 故障时权益宽限期                    | 默认 259200000               |
| `STRIPE_SECRET_KEY`                         | Stripe 服务端密钥                          | 备用通道启用时必填           |
| `STRIPE_WEBHOOK_SECRET`                     | Stripe Webhook 签名密钥                    | 备用通道启用时必填           |
| `STRIPE_PERSONAL_PRICE_ID`                  | Personal Plus 的美元周期价 ID              | 备用通道启用时必填           |
| `STRIPE_SALON_PRICE_ID`                     | Salon Pro 的美元周期价 ID                  | 备用通道启用时必填           |
| `STRIPE_AUTOMATIC_TAX`                      | 设为 1 启用 Stripe Tax                     | 备用通道税务配置完成后开启   |
| `SALON_PRO_MONTHLY_IMAGES`                  | Salon Pro 月图片额度                       | 默认 600                     |

`GUMROAD_PERSONAL_PRODUCT_ID`、`GUMROAD_PERSONAL_CHECKOUT_URL`、`GUMROAD_PERSONAL_MONTHLY_PRICE_USD` 和 `PERSONAL_PLUS_MONTHLY_IMAGES` 仅用于兼容历史 Personal Plus 订阅，不再用于新销售。

任何密钥都不得使用 `NEXT_PUBLIC_` 前缀。Gumroad Product ID 和公开购买地址可以公开，License Key 与 `BILLING_SECRET_KEY` 不得进入浏览器日志。测试必须使用独立的 `SQLITE_PATH`、`GENERATED_ASSETS_DIR`、`SOURCE_UPLOADS_DIR` 和 `BACKUP_DIR`。
