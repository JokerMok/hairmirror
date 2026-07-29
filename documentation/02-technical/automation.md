# 自动化与后台任务

## 生成队列

生成请求先写入 SQLite，再由独立 Worker 消费。任务状态、输入快照、模型快照、幂等键、锁、心跳、重试次数和成本均持久化。进程重启不会丢失已入队任务。

```bash
INTERNAL_JOB_SECRET=<随机长密钥> npm run worker
```

Worker 调用 `/api/internal/worker`，默认每 2 秒拉取任务。失败采用指数退避，默认最多尝试 3 次；明确的输入或配置错误不自动重试。处理中的取消为协作式取消，供应商返回后不再交付结果，并记录已经产生的费用。

同一主体使用相同 `Idempotency-Key` 重复提交时只保留一个任务。失败任务允许手动重新入队；原图超过临时留存期后不得重试。

## 定时维护

Worker 默认每 15 分钟调用 `/api/internal/maintenance`，执行：

- 恢复失去心跳的任务；
- 完成待取消任务的补偿；
- 删除超过 30 天的结果、任务、反馈和用户选择；
- 删除超过 24 小时的临时原图；
- 评估队列积压、失败率、费用和僵死任务告警；
- 按计划创建数据库与生成资产备份。

维护接口必须使用 `Authorization: Bearer <INTERNAL_JOB_SECRET>`，不得暴露到公共定时任务平台。

## 告警

开放告警写入 `operational_alerts`，运行事件写入 `operational_events`。配置 `ALERT_WEBHOOK_URL` 后，系统向 Webhook 发送首次开放告警。通知失败不会影响生成或维护任务。

## 备份与回滚

默认每 24 小时生成一次 SQLite 在线备份和生成资产快照，保留最近 7 份。备份包含清单、版本号和 SHA-256 校验值，完成前执行数据库完整性检查。

数据回滚必须先停写并停止 Worker，再执行：

```bash
npm run rollback:data -- --backup <备份目录> --confirm
```

脚本会先保存当前数据库和资产的紧急副本，再校验并恢复目标备份。代码版本使用带注释的 `release/<版本号>` 标签：

```bash
npm run release:create -- 0.2.0
npm run rollback:code -- release/0.2.0 --confirm
```

每次正式发布前必须完成一次备份恢复演练，并核对任务、资产、账号和告警页面。
