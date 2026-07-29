# V0.3 规划上下文

- 基线提交：`a36816b`
- 范围：Salon-first AI Hair Consultation 验证 MVP；本轮只规划，不改业务代码。
- 已检查：`src/app`, `src/components`, `src/lib`, `tests`, `documentation/01-product`, `documentation/02-technical`, `documentation/03-quality`。
- 复用：现有认证、图片存储、队列、生成服务、后台、权益与账单接口。
- 新增重点：咨询实体、结构化分析/推荐、Salon 入口、沟通卡、咨询历史、租户访问、收费开关。
- 排除：CRM、预约、POS、多员工管理、真实自动收费发布、侧脸/二维码/公开分享链接（保留后续接口）。
- 关键风险：生成服务失败、照片隐私、模型输出不稳定、现有消费者流程回归。
- 排除快照：`.next/`、`node_modules/`、`coverage/`、`test-results/`、`.git/`、`.env*`；不排除源代码与规划文件。

