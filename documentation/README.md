# 发型镜项目文档

本目录记录当前已经实现的能力、系统边界和上线要求。代码行为与文档冲突时，先停止发布并修正文档或实现。

## 当前状态

- 本地产品 Demo：可用
- 小范围真人内测：整改中
- 公开收费版本：暂不发布

## 目录结构

| 目录            | 内容                                   |
| --------------- | -------------------------------------- |
| `01-product/`   | 产品状态、阶段规划和正式项目方案       |
| `02-technical/` | 架构、业务流程、权限、自动化和环境变量 |
| `03-quality/`   | 测试、发布判断和验证截图               |
| `99-archive/`   | 字体测试等不参与当前开发的历史产物     |

## 主要入口

- 产品状态：`01-product/product-status.md`
- 下一阶段：`01-product/next-phase.md`
- 开发就绪方案：`01-product/plans/AI发型设计平台完整项目方案_V1.1_开发就绪版.docx`
- 技术架构：`02-technical/architecture.md`
- Worker、维护、备份与回滚：`02-technical/automation.md`
- 上线环境变量：`02-technical/variables.md`
- Gumroad 支付与订阅：`02-technical/billing.md`
- SEO 与 GEO 上线规范：`02-technical/seo-geo.md`
- 测试标准：`03-quality/tests.md`
- 上线底座验证记录：`03-quality/launch-foundation-verification.md`
- 发布判断：`03-quality/release-readiness.md`

## 文档维护规则

1. 新功能必须同时更新流程、权限和测试文档。
2. 发布判断只引用已经验证的证据。
3. Demo 能力、内测能力和商用能力分别标记，不混写。
4. 用户照片、模型费用、账号权限、订阅权益和删除行为发生变化时，必须重新评审。
