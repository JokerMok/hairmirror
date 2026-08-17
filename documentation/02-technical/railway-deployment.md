# Railway 部署说明

## 当前环境

- 上线时间：2026-07-16
- 当前公开测试地址：<https://hairmirror-v03.lopezerendira678.chatgpt.site>
- Railway 项目：`hairmirror`
- 服务：`web`
- 数据卷：`web-volume`，挂载路径 `/app/data`
- 生成模型：RunningHub G31 Flash Lite，已启用
- 部署状态：健康检查、公开页面、Worker、持久化重启和备份校验均已通过

## 部署结构

- 一个 Railway Service 同时运行 Next.js Web 与持久化队列 Worker。
- 一个 Railway Volume 挂载至 `/app/data`。
- SQLite、生成图片、临时原图和备份均写入该持久卷。
- 健康检查使用 `/api/health`，部署失败最多自动重启五次。

## 必要配置

Railway 服务必须挂载持久卷。运行时会检查 `RAILWAY_VOLUME_MOUNT_PATH`，未挂载卷时拒绝启动，避免把用户数据写入临时文件系统。

必须配置以下密钥：

- `ADMIN_ACCESS_KEY`
- `INTERNAL_JOB_SECRET`
- `MODEL_SECRET_KEY`：32 字节 Base64
- `BILLING_SECRET_KEY`：32 字节 Base64

Gumroad 配置：

- `BILLING_PROVIDER=gumroad`
- `GUMROAD_PERSONAL_PRODUCT_ID`
- `GUMROAD_SALON_PRODUCT_ID`
- `GUMROAD_PERSONAL_CHECKOUT_URL`
- `GUMROAD_SALON_CHECKOUT_URL`
- `GUMROAD_PERSONAL_MONTHLY_PRICE_USD=9`
- `GUMROAD_SALON_MONTHLY_PRICE_USD=29`

生成模型通过上线后的 `/admin/models` 配置。API Key 仅加密保存在持久卷数据库中。

## 首次上线检查

1. `/api/health` 返回 200。
2. 首页、登录、定价和隐私页面正常打开。
3. 管理员登录后可以查看模型、用户和运行监控。
4. 注册测试账号，退出后重新登录。
5. 重启服务，确认账号和模型配置仍然存在。
6. 检查 Railway Volume 使用量，达到 300MB 前迁移或扩容。

## 回滚与迁移

代码回滚使用 Railway Deployment History。数据迁移前调用管理员备份接口或运行 `npm run release:create`，下载并校验 SQLite 与生成资产备份后再切换服务。免费验证环境收到第一笔订单、运行满 20 天或卷使用量达到 300MB 时，迁移至正式环境。

Railway 免费试用额度到期后会降级为 Free Plan；必须在额度到期前导出数据或升级、迁移。当前应用内备份位于同一数据卷，可防止应用层误操作，但不能替代异地备份。
