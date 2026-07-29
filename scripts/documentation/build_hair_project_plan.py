from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.section import WD_SECTION
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.text import WD_BREAK
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / 'documentation/01-product/plans/AI发型设计平台完整项目方案_V1.1_开发就绪版.docx'
NAVY = '183B56'; BLUE = '2878A5'; TEAL = '2A9D8F'; PALE = 'EAF3F7'; LIGHT = 'F4F7F9'; GRAY = '5C6873'; WHITE = 'FFFFFF'; RED='B23A48'; GOLD='C28B2C'

doc = Document()
sec = doc.sections[0]
sec.page_width = Inches(8.5); sec.page_height = Inches(11)
sec.top_margin = Inches(.8); sec.bottom_margin = Inches(.75); sec.left_margin = Inches(.85); sec.right_margin = Inches(.85)

def font(run, size=None, bold=None, color=None, name='PingFang SC'):
    run.font.name=name; run._element.get_or_add_rPr().rFonts.set(qn('w:eastAsia'), 'PingFang SC')
    run._element.rPr.rFonts.set(qn('w:ascii'), name); run._element.rPr.rFonts.set(qn('w:hAnsi'), name)
    if size: run.font.size=Pt(size)
    if bold is not None: run.bold=bold
    if color: run.font.color.rgb=RGBColor.from_string(color)
    return run

styles=doc.styles
normal=styles['Normal']; normal.font.name='PingFang SC'; normal._element.rPr.rFonts.set(qn('w:eastAsia'),'PingFang SC'); normal.font.size=Pt(10.2); normal.font.color.rgb=RGBColor.from_string('202830')
normal.paragraph_format.space_after=Pt(5); normal.paragraph_format.line_spacing=1.23
for n,size,color,before,after in [('Title',27,NAVY,0,8),('Subtitle',13,GRAY,0,10),('Heading 1',18,NAVY,16,8),('Heading 2',13,BLUE,12,5),('Heading 3',11,TEAL,8,3)]:
    s=styles[n]; s.font.name='PingFang SC'; s._element.rPr.rFonts.set(qn('w:eastAsia'),'PingFang SC'); s.font.size=Pt(size); s.font.bold=n!='Subtitle'; s.font.color.rgb=RGBColor.from_string(color); s.paragraph_format.space_before=Pt(before); s.paragraph_format.space_after=Pt(after); s.paragraph_format.keep_with_next=True

for style_name in ['List Bullet','List Number']:
    s=styles[style_name]; s.font.name='PingFang SC'; s._element.rPr.rFonts.set(qn('w:eastAsia'),'PingFang SC'); s.font.size=Pt(10.2); s.paragraph_format.left_indent=Inches(.28); s.paragraph_format.first_line_indent=Inches(-.16); s.paragraph_format.space_after=Pt(3)

def shade(cell, fill):
    tcPr=cell._tc.get_or_add_tcPr(); shd=tcPr.find(qn('w:shd'))
    if shd is None: shd=OxmlElement('w:shd'); tcPr.append(shd)
    shd.set(qn('w:fill'),fill)

def margins(cell, top=90, start=110, bottom=90, end=110):
    tc=cell._tc.get_or_add_tcPr(); m=tc.first_child_found_in('w:tcMar')
    if m is None: m=OxmlElement('w:tcMar'); tc.append(m)
    for tag,val in [('top',top),('start',start),('bottom',bottom),('end',end)]:
        el=m.find(qn('w:'+tag))
        if el is None: el=OxmlElement('w:'+tag); m.append(el)
        el.set(qn('w:w'),str(val)); el.set(qn('w:type'),'dxa')

def set_cell(cell, text, bold=False, color=None, size=9.2, align=None):
    cell.text=''; p=cell.paragraphs[0]; p.paragraph_format.space_after=Pt(0); p.paragraph_format.line_spacing=1.08
    if align: p.alignment=align
    font(p.add_run(str(text)),size,bold,color)
    cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER; margins(cell)

def table(headers, rows, widths=None):
    t=doc.add_table(rows=1, cols=len(headers)); t.alignment=WD_TABLE_ALIGNMENT.CENTER; t.autofit=False
    for i,h in enumerate(headers):
        set_cell(t.rows[0].cells[i],h,True,WHITE,9); shade(t.rows[0].cells[i],NAVY)
    for ri,row in enumerate(rows):
        cells=t.add_row().cells
        for i,v in enumerate(row):
            set_cell(cells[i],v,False,None,8.8); shade(cells[i], WHITE if ri%2==0 else LIGHT)
    if widths:
        for row in t.rows:
            for i,w in enumerate(widths): row.cells[i].width=Inches(w)
    doc.add_paragraph().paragraph_format.space_after=Pt(1)
    return t

def p(text='', bold=False, color=None, size=None, align=None, style=None):
    q=doc.add_paragraph(style=style)
    if align: q.alignment=align
    font(q.add_run(text),size,bold,color)
    return q

def bullet(text): p(text,style='List Bullet')
def num(text): p(text,style='List Number')
def h1(text): doc.add_heading(text,level=1)
def h2(text): doc.add_heading(text,level=2)
def h3(text): doc.add_heading(text,level=3)
def callout(label,text,fill=PALE,accent=BLUE):
    t=doc.add_table(rows=1,cols=1); t.alignment=WD_TABLE_ALIGNMENT.CENTER; t.autofit=False; c=t.cell(0,0); c.width=Inches(6.65); shade(c,fill); margins(c,150,170,150,170)
    c.text=''; q=c.paragraphs[0]; q.paragraph_format.space_after=Pt(0); font(q.add_run(label+'  '),10,True,accent); font(q.add_run(text),10,False,NAVY)
    doc.add_paragraph().paragraph_format.space_after=Pt(1)
def page(): doc.add_page_break()

# header/footer
header=sec.header.paragraphs[0]; header.alignment=WD_ALIGN_PARAGRAPH.RIGHT; font(header.add_run('AI发型设计平台｜项目方案 V1.1 开发就绪版'),8,False,GRAY)
footer=sec.footer.paragraphs[0]; footer.alignment=WD_ALIGN_PARAGRAPH.CENTER
font(footer.add_run('内部项目文件｜2026年7月'),8,False,GRAY)

# Cover
p('产品项目方案',True,TEAL,11,WD_ALIGN_PARAGRAPH.CENTER)
p('AI发型设计平台',True,NAVY,29,WD_ALIGN_PARAGRAPH.CENTER)
p('个人体验与美发门店服务的一体化产品',False,GRAY,14,WD_ALIGN_PARAGRAPH.CENTER)
p('',align=WD_ALIGN_PARAGRAPH.CENTER)
callout('项目决策','第一版覆盖男女及长短发；采用统一AI发型设计核心，提供个人体验模式与门店服务模式。')
p('',align=WD_ALIGN_PARAGRAPH.CENTER)
table(['项目','内容'],[
 ('版本','V1.1 开发就绪版'),('日期','2026年7月12日'),('阶段','开发准入'),('首发形态','响应式Web应用 / H5'),('核心目标','完成Sprint 0及P0公开体验MVP')],[1.6,5.0])
p('文档性质：产品、技术、AI、运营与商业化的一体化执行基线。',False,GRAY,9,WD_ALIGN_PARAGRAPH.CENTER)
page()

h1('1. 执行摘要')
callout('产品定义','面向个人用户与美发门店的AI发型决策平台，通过标准化发型库、个性化推荐、身份一致的效果预览和专业确认，降低发型选择的不确定性。')
h2('1.1 核心判断')
bullet('个人版与门店版共用同一条“上传—选择—生成—比较—确认”主链路。')
bullet('差异位于身份、数据归属、协作、经营管理和商业化层，不应拆成两套产品。')
bullet('第一版覆盖男女及长短发会显著扩大质量矩阵，因此必须以标准发型模板、输入质量检测和失败降级控制风险。')
bullet('首发重点不是自动判断谁适合什么，而是生成可信、可比较、可解释的候选方案。')
h2('1.2 首发决策')
table(['决策项','V1选择','原因'],[
('目标市场','个人公开体验 + 门店预留','先积累真实图片与反馈，同时避免未来重构'),
('覆盖范围','男女、短中长发','满足明确产品方向'),
('推荐方式','结构化问卷 + 规则排序','比纯模型诊断更可控、可解释'),
('生成方式','模板化编辑生成','提高身份和背景一致性'),
('终端','H5优先','开发快、分享和门店二维码接入方便'),
('收费','测试期免费额度，后续积分包与SaaS','先验证质量和成本')],[1.25,1.7,3.65])
h2('1.3 立项成功条件')
bullet('100名有效体验用户完成至少一次三方案生成。')
bullet('身份一致性人工评分达到4.0/5，发型清晰度达到4.0/5。')
bullet('至少60%的用户认为结果帮助其缩小选择范围。')
bullet('生成成功率不低于90%，P95完整任务时间不超过180秒。')
bullet('单个三方案任务的可变成本进入可持续收费区间。')

h1('2. 产品战略与边界')
h2('2.1 用户问题')
p('用户缺少对剪后效果的直观预期，发型师又难以仅靠语言建立共同理解。传统“明星参考图”没有考虑用户本人脸型、发量和打理条件，容易造成期望偏差。')
h2('2.2 产品价值')
table(['用户','核心价值','完成信号'],[
('个人用户','低成本比较不同发型','选出至少一个愿意尝试的方案'),
('顾客','与发型师建立共同参考','最终方案被双方确认'),
('发型师','缩短沟通并管理预期','确认、调整或否决AI方案'),
('门店经营者','把预览转化为预约与复购','形成可追踪的服务记录')],[1.2,2.65,2.75])
h2('2.3 非目标')
bullet('不承诺100%还原真实剪后效果。')
bullet('不进行颜值、年龄或人格评价。')
bullet('不在V1建立完整CRM、收银和排班系统。')
bullet('不支持无限开放式提示词或任意夸张造型。')
bullet('不以AI结论替代发型师的专业判断。')
page()

h1('3. 用户、场景与旅程')
h2('3.1 目标用户')
table(['角色','典型需求','优先级'],[
('个人尝鲜者','快速查看换发型效果并保存分享','P0'),
('有明确剪发计划者','降低选择风险，带图到店沟通','P0'),
('门店顾客','在发型师协助下确认方案','P1'),
('发型师','校验可实现性并给出专业调整','P1'),
('店长/连锁运营','管理顾客、门店与转化数据','P2')],[1.45,4.2,.95])
h2('3.2 个人体验主旅程')
for x in ['进入产品并理解结果仅供设计参考','上传清晰正脸或轻侧脸照片','选择当前发长、目标发长、刘海、卷度、颜色与核心诉求','从系统推荐中确认3个候选发型','等待生成并比较原图与三种方案','选择、评分、保存或删除结果','按需生成分享卡片或携带方案到店']:
    num(x)
h2('3.3 门店服务旅程')
for x in ['顾客扫描门店专属二维码进入','完成与个人版相同的诊断和生成','结果自动归属门店服务会话','发型师标注可实现、需调整或不建议','顾客与发型师确认最终方案','服务完成后记录真实成品和满意度','系统用于复购提醒与历史方案查看']:
    num(x)
h2('3.4 异常与空状态')
bullet('照片模糊、遮挡或多人：阻止生成并给出重拍指引。')
bullet('当前发长不足以支持目标：展示“需接发/留长/烫染”等现实条件。')
bullet('模型失败：保留任务、自动重试一次；仍失败则退回额度。')
bullet('结果改变身份或明显失真：允许单张免费重生成并提交问题标签。')

h1('4. 信息架构与功能范围')
h2('4.1 产品模块')
table(['模块','个人模式','门店模式'],[
('账号与权限','游客/手机号登录','门店、员工、角色权限'),
('发型设计','上传、问卷、推荐、生成、比较','同核心能力'),
('结果管理','临时历史、保存、删除','顾客档案与服务记录'),
('专业确认','不强制','发型师确认、调整、备注'),
('商业化','免费次数、积分包','订阅、用量包、多门店'),
('数据分析','个人任务状态','漏斗、成本、转化、质量')],[1.2,2.7,2.7])
h2('4.2 P0：公开体验MVP')
bullet('隐私授权、照片上传与质量检测。')
bullet('结构化需求问卷，覆盖男女及短中长发。')
bullet('标准发型库浏览、筛选与规则推荐。')
bullet('单次生成3个方案，支持原图对比。')
bullet('推荐理由、现实条件、打理难度与风险提示。')
bullet('任务状态、失败重试、额度退回。')
bullet('保存、分享、删除及用户反馈。')
bullet('运营后台：发型模板、任务、成本、异常和反馈。')
h2('4.3 P1：门店试用版')
bullet('门店空间、专属二维码与品牌信息。')
bullet('顾客服务会话、发型师确认和方案备注。')
bullet('顾客授权后保存档案，支持到期删除。')
bullet('预约意向、服务结果和满意度记录。')
h2('4.4 P2：规模化能力')
bullet('多门店与员工权限、套餐计费、连锁看板。')
bullet('真实成品反馈驱动的推荐排序优化。')
bullet('CRM、预约、支付和私域系统对接。')
page()

h1('5. 发型库与推荐体系')
h2('5.1 发型分类维度')
table(['维度','枚举示例'],[
('适用人群','男性、女性、中性'),('目标长度','极短、短、中、长'),('结构','层次、齐切、渐变、碎发、露额、刘海'),('纹理','直、微卷、卷、蓬松、湿发'),('颜色','自然黑、棕色系、冷色系、暖色系'),('维护成本','低、中、高'),('施工条件','剪、烫、染、接发、留长'),('风格','职业、减龄、清爽、复古、时尚、自然')],[1.45,5.15])
h2('5.2 推荐逻辑')
p('V1采用“硬约束过滤 + 软偏好排序”，而非让大模型自由推荐。硬约束包括当前长度、目标长度、是否接受烫染、职业限制和每日打理时间；软偏好包括风格、刘海、蓬松度和颜色。')
h2('5.3 首发发型库规模')
table(['类别','建议模板数','说明'],[
('男性短发',18,'覆盖渐变、碎盖、侧分、背头、纹理'),('男性中长发',8,'覆盖中分、狼尾、自然卷等'),('女性短发',12,'覆盖精灵短发、波波、层次短发'),('女性中发',12,'覆盖锁骨、层次、卷度和刘海组合'),('女性长发',15,'覆盖直发、卷发、层次与多类刘海'),('中性风格',5,'弱化性别标签，可跨组使用')],[1.7,1.25,3.65])
callout('范围约束','首发约70个标准模板。颜色作为独立参数，不为每种颜色复制完整模板，避免组合爆炸。', 'FFF7E7', GOLD)

h1('6. AI能力合同')
h2('6.1 输入合同')
bullet('单人、无遮挡、清晰、光线均匀的正脸或轻侧脸照片。')
bullet('最短边不低于768像素，支持JPEG、PNG、HEIC转换。')
bullet('明确获得本人或监护人授权；未成年人场景默认不开放。')
h2('6.2 输出合同')
bullet('保持人物身份、脸型、五官、肤色、姿态和背景基本一致。')
bullet('只修改头发区域及必要的边缘遮挡，不进行美颜和年龄变化。')
bullet('每个方案包含模板ID、推荐理由、现实条件、打理难度、免责声明和生成图。')
h2('6.3 禁止行为与降级')
bullet('不得虚增不现实的发量、改变发际线事实或隐藏明显脱发条件。')
bullet('不得输出冒犯性身体评价或确定性适配结论。')
bullet('无法可靠生成时，应拒绝并提示重拍、换模板或转人工，不输出低质量结果。')
h2('6.4 模型策略')
table(['环节','V1策略','后备方案'],[
('照片质检','视觉模型/规则检测','人工问题标签'),('推荐排序','规则引擎 + 结构化模型说明','仅展示筛选结果'),('图像生成','支持参考图编辑的合规模型API','第二供应商或队列重试'),('安全审核','内容安全与人脸政策检查','阻断并退回额度')],[1.25,3.1,2.2])
page()

h1('7. AI评估与质量门槛')
h2('7.1 黄金测试集')
p('上线前建立不少于120张经授权测试照片，覆盖性别表达、短中长发、不同脸型、发量、发际线、肤色、眼镜、光照和背景。每张照片至少测试3种目标发型，形成不低于360个样本结果。')
h2('7.2 人工评分量表')
table(['指标','定义','上线门槛'],[
('身份一致性','是否仍明显是同一人','均值≥4.0/5，严重失败<3%'),('发型清晰度','轮廓、发丝与边缘是否自然','均值≥4.0/5'),('局部完整性','耳朵、额头、眼镜和背景是否异常','严重缺陷<5%'),('现实可实现性','发型师判断是否具备实现条件','可实现/条件实现≥75%'),('偏差透明度','是否正确提示留长、烫染和发量限制','关键提示召回≥90%')],[1.35,3.25,2.0])
h2('7.3 回归门禁')
bullet('更换模型、提示词、参考模板或后处理逻辑，必须重跑固定黄金集。')
bullet('身份一致性下降0.2分以上或严重失败率超过3%，禁止发布。')
bullet('任一人群分组的质量显著低于总体，需限制对应模板或单独修复。')
h2('7.4 线上质量监控')
bullet('记录生成成功率、重试率、用户差评标签、单任务成本和耗时。')
bullet('支持用户标记“不像本人、头发不自然、改变脸型、无法实现、其他”。')
bullet('出现隐私泄露、跨用户数据、明显身份替换时立即关闭生成功能。')

h1('8. 数据、隐私与安全')
h2('8.1 数据原则')
bullet('数据最小化：仅收集完成发型设计所需信息。')
bullet('目的限定：未经单独授权，不用于训练、广告或对外展示。')
bullet('默认短期保存：游客原图及结果建议24小时后删除；登录用户可主动延长。')
bullet('门店档案必须由顾客明确授权，门店仅能访问所属服务记录。')
h2('8.2 关键数据对象')
table(['对象','核心字段','保存策略'],[
('用户','user_id、登录方式、授权状态','账号存续期'),('门店','tenant_id、品牌、套餐、状态','合同存续期'),('设计任务','task_id、用户/门店、参数、状态、成本','去标识化后用于运营'),('媒体文件','原图、结果图、缩略图、删除时间','按授权期限自动清理'),('发型模板','template_id、标签、约束、版本','长期'),('反馈','评分、问题标签、选择结果','去标识化长期保留')],[1.2,3.5,1.9])
h2('8.3 安全要求')
bullet('对象存储使用私有桶和短期签名URL；数据库不保存公开图片地址。')
bullet('多租户查询强制校验tenant_id，禁止仅依赖前端过滤。')
bullet('管理后台采用最小权限、操作日志和高风险操作二次确认。')
bullet('供应商请求关闭训练用途，并在隐私政策中披露处理方。')
bullet('提供数据导出、撤回授权和删除入口，删除任务可审计。')
page()

h1('9. 技术架构方案')
h2('9.1 架构原则')
bullet('统一核心、租户可选：个人任务tenant_id为空，门店任务绑定tenant_id。')
bullet('异步生成：上传后创建任务，经队列调度模型API，前端轮询或订阅状态。')
bullet('供应商可替换：模型适配层统一输入输出、重试、成本和审计。')
bullet('隐私优先：媒体与业务数据分离，所有访问使用短期授权。')
h2('9.2 逻辑组件')
table(['组件','职责','建议实现'],[
('Web/H5','上传、问卷、比较、反馈','Next.js/React'),('业务API','用户、任务、模板、门店、计费','TypeScript服务'),('任务队列','异步生成、重试、限流','Redis队列/托管队列'),('AI编排层','质检、推荐、提示词、模型路由','独立模块'),('数据库','业务对象、权限、事件','PostgreSQL'),('对象存储','原图、结果图、缩略图','私有对象存储'),('运营后台','模板、质量、成本、异常','同一前端后台路由'),('观测系统','日志、指标、错误和成本','结构化日志 + 告警')],[1.25,3.15,2.2])
h2('9.3 核心接口')
bullet('POST /media/upload-url：申请受控上传地址。')
bullet('POST /design-tasks：创建发型设计任务。')
bullet('GET /design-tasks/{id}：查询任务及三方案状态。')
bullet('POST /design-tasks/{id}/retry：重试指定失败方案。')
bullet('POST /design-tasks/{id}/feedback：提交选择和质量反馈。')
bullet('DELETE /design-tasks/{id}/media：删除原图及结果。')
bullet('POST /salon-sessions：创建门店服务会话。')
bullet('POST /salon-sessions/{id}/confirm：发型师确认或调整。')
h2('9.4 生成任务状态')
p('draft → validating → queued → generating → partially_completed/completed；异常进入 action_required、failed 或 deleted。每次状态变化必须写入事件日志。')

h1('10. 详细需求与验收标准')
h2('10.1 上传与质检')
bullet('Given 用户上传合规单人照片，When 质检通过，Then 进入需求问卷并保存授权记录。')
bullet('Given 照片模糊、多人或遮挡，When 质检失败，Then 不创建生成任务并明确提示重拍原因。')
bullet('Given 用户未勾选处理授权，When 点击继续，Then 系统不得上传原图。')
h2('10.2 推荐与生成')
bullet('Given 用户完成必填问题，When 请求推荐，Then 返回3—8个满足硬约束的候选模板。')
bullet('Given 用户选定3个模板，When 提交生成，Then 系统创建可追踪的异步任务并展示进度。')
bullet('Given 仅部分方案成功，When 任务结束，Then 用户可查看成功结果，并对失败方案免费重试。')
h2('10.3 结果与控制')
bullet('Given 结果完成，When 用户打开比较页，Then 可在原图与任一方案间切换或滑动比较。')
bullet('Given 用户选择删除，When 二次确认完成，Then 媒体立即不可访问，并进入后台清理队列。')
bullet('Given 用户提交质量问题，When 保存反馈，Then 反馈必须关联模型、模板、提示词和任务版本。')
h2('10.4 门店隔离')
bullet('Given 用户从门店二维码进入，When 创建任务，Then task必须绑定正确tenant_id。')
bullet('Given 其他门店员工请求该任务，When 权限校验失败，Then 返回无权限且不暴露任务是否存在。')
page()

h1('11. 指标体系与实验计划')
h2('11.1 北极星指标')
callout('北极星指标','每周被用户明确选定的有效发型方案数。有效方案必须生成成功、通过基本质量检查，并获得“愿意尝试”选择。')
h2('11.2 指标分层')
table(['层级','指标','首轮目标'],[
('获客','访问→开始上传','≥25%'),('激活','上传→完成三方案','≥65%'),('价值','完成→选定至少一款','≥60%'),('质量','身份一致性评分','≥4.0/5'),('可靠性','三方案任务成功率','≥90%'),('效率','P95完整任务耗时','≤180秒'),('成本','三方案可变成本','低于计划售价的30%'),('风险','严重身份/隐私事故','0')],[1.05,3.65,1.85])
h2('11.3 三阶段验证')
table(['阶段','样本','验证重点','通过标准'],[
('封闭测试','20人/60任务','输入、生成质量、异常','无P0缺陷，核心质量≥4.0'),('公开灰度','100人','完成率、选择率、成本','完成率≥65%，选择率≥60%'),('门店试点','3—5家/100次服务','沟通、成交、可实现性','发型师认可≥70%，无重大客诉')],[1.15,1.35,2.3,1.75])
h2('11.4 关键事件')
p('visit、upload_started、upload_passed、questionnaire_completed、templates_selected、generation_started、generation_completed、result_selected、result_shared、feedback_submitted、media_deleted、salon_confirmed、appointment_intent。')

h1('12. 商业模式与单位经济')
h2('12.1 个人用户')
bullet('新用户获得一次低分辨率或带水印体验。')
bullet('按积分购买三方案任务、高清导出和额外重生成。')
bullet('正式定价必须以实际模型成本、支付费率、退款率和获客成本倒推。')
h2('12.2 门店客户')
bullet('单店基础订阅：门店空间、品牌页、固定月度额度和顾客记录。')
bullet('增长套餐：更多额度、员工账号、数据看板与自定义发型库。')
bullet('连锁套餐：多门店、总部权限、API和独立部署选项。')
h2('12.3 单位经济公式')
callout('贡献毛利','任务售价 − 模型生成成本 − 存储与带宽 − 支付通道费 − 退款损失。正式开放付费前，目标贡献毛利率不低于70%。','FFF7E7',GOLD)
h2('12.4 收费门槛')
bullet('没有达到身份一致性和成功率门槛前，不开放正式收费。')
bullet('用户因系统错误或严重失真重生成，不重复扣费。')
bullet('门店套餐必须体现经营价值，不能只包装成更便宜的图片额度。')
page()

h1('13. 上线与增长方案')
h2('13.1 冷启动')
bullet('用公开体验版获取首批100名用户，不承诺专业诊断。')
bullet('以“带一张更清楚的参考图去理发店”为核心传播价值。')
bullet('邀请发型师对匿名结果做可实现性评分，建立专业反馈池。')
bullet('从高质量案例中制作前后对比内容，但必须取得独立展示授权。')
h2('13.2 门店获取')
bullet('用真实个人版数据和案例，而非概念演示拜访门店。')
bullet('向门店提供14天试用和专属二维码，验证服务会话数量。')
bullet('优先寻找愿意参与产品共创、客群稳定的小型门店。')
h2('13.3 增长闭环')
p('个人用户分享方案带来新用户；用户携带方案到店产生门店线索；门店确认和真实成品反向提高模板质量；更可信的结果继续提高分享与采用。')
h2('13.4 对外表述')
bullet('推荐表述：AI辅助发型预览与设计参考。')
bullet('禁止表述：100%还原、保证适合、保证剪出同款、AI专业诊断。')

h1('14. 项目计划与资源')
h2('14.1 12周实施计划')
table(['阶段','周次','主要交付','退出条件'],[
('产品与技术基线','1—2','需求、原型、数据模型、供应商试验','关键路径与模型可行'),('核心MVP','3—6','上传、问卷、发型库、生成、比较、后台','端到端流程可用'),('质量与合规','7—8','黄金集、评测、授权删除、监控','达到封闭测试门槛'),('灰度测试','9—10','20—100人测试、修复、成本测算','核心指标达标'),('公开Beta','11—12','额度、分享、运营和支持机制','无P0缺陷，可控开放')],[1.2,.75,3.05,1.6])
h2('14.2 最小团队')
table(['角色','配置','职责'],[
('产品负责人','1','范围、体验、指标、试点与商业化'),('全栈工程','1—2','前后端、数据、任务队列和后台'),('AI/图像工程','0.5—1','模型评估、提示词、模板与质量体系'),('设计','0.5','交互、视觉、上传和比较体验'),('发型顾问','兼职','发型库、现实约束和质量评审'),('法务/隐私','按需','授权、隐私政策和供应商审查')],[1.35,.85,4.4])
h2('14.3 预算科目')
bullet('模型API与失败重试成本。')
bullet('对象存储、带宽、数据库与监控。')
bullet('域名、短信、支付和内容安全服务。')
bullet('发型模板制作、测试样本授权及专业顾问。')
bullet('隐私合规文本与供应商合同审查。')

h1('15. 风险、对抗审查与停止条件')
h2('15.1 主要风险')
table(['风险','触发信号','应对'],[
('结果好看但不可实现','发型师否决率高','强化现实条件、限制模板、人工确认'),('人物身份漂移','不像本人差评升高','模型切换、局部编辑、自动质检'),('覆盖过宽导致质量失衡','某类发型失败集中','按分组门禁，临时下架问题模板'),('生图成本不可控','重试率与单任务成本升高','配额、缓存、分辨率分级、供应商路由'),('隐私信任不足','上传转化低、删除请求多','短期保存、透明说明、显著删除入口'),('个人用户低复购','使用一次后流失','以获客和门店线索看待，不虚构高留存'),('门店不愿改变流程','服务会话使用低','二维码即用、减少录入、绑定经营结果')],[1.45,2.05,3.1])
h2('15.2 对抗式结论')
bullet('“能生成换发型图”不构成产品壁垒；壁垒来自高质量发型模板、真实反馈、门店工作流和可验证的可信度。')
bullet('第一版覆盖男女及长短发可执行，但不能同时追求无限发型、全自动诊断、门店CRM和高精度商业化。')
bullet('没有真实门店资源并不阻止公开Beta，但不能据此证明B端价值。门店版必须在P1单独验证。')
bullet('如果结果无法保持身份一致或现实可实现性，宁可限制模板，也不能靠免责声明掩盖质量问题。')
h2('15.3 停止或收缩条件')
bullet('经过两轮模型与模板优化，身份一致性仍低于3.8/5。')
bullet('100名有效用户中，愿意尝试任一方案的比例低于35%。')
bullet('三方案任务成本无法进入合理定价的30%以内。')
bullet('隐私、供应商条款或人脸处理要求无法满足。')
bullet('门店试点中，发型师认可率持续低于50%。')
page()

h1('16. 立项清单与下一步')
h2('16.1 立即执行')
for x in ['确定产品临时名称、域名和首发地区','筛选2—3个支持参考图编辑的合规模型供应商','制作首批70个标准发型模板及标签','完成核心流程低保真原型','建立120张授权黄金测试集与评分表','确定原图和结果图的保存期限','搭建任务成本台账与事件埋点','招募20名封闭测试用户']:
    bullet(x)
h2('16.2 上线前必须完成')
for x in ['隐私政策、用户授权、删除与供应商披露','身份一致性、现实可实现性和分组公平性评测','失败重试、额度退回、限流与熔断','后台异常查看、质量反馈和成本监控','严重事故的关闭开关与响应负责人']:
    bullet(x)
h2('16.3 开发基线决策')
table(['事项','已确定基线','复审时点'],[
('首发地区与合规口径','中国大陆公开Beta','开发前'),('模型供应商','双供应商预留，首发单主路由','第2周'),('游客保存期限','24小时','开发前'),('登录用户保存期限','30天，可主动删除','开发前'),('免费额度','一次三方案任务','灰度前'),('首发定价','由实际成本和测试意愿确定','公开收费前'),('门店版启动','公开Beta指标达标后','第10—12周评审')],[1.5,3.3,1.8])
callout('立项决策','批准12周MVP；首发覆盖男女及长短发，但将质量控制在约70个标准模板内。公开Beta只验证个人价值与生成质量，门店商业价值另设P1试点门槛。')

page()
h1('17. 多轮评审记录与修订结论')
h2('17.1 第一轮：产品与商业闭环')
table(['发现','级别','修订结果'],[
('个人版与门店版容易被误做成两套产品','阻断','统一设计任务核心；门店仅增加租户、协作和经营层'),
('首发覆盖过宽，组合数量可能失控','阻断','锁定约70个标准模板，颜色独立参数化'),
('个人用户低复购可能被误判为失败','重要','个人版以有效方案、分享和门店线索衡量，不强求高留存'),
('B端价值没有真实证据','重要','门店版保持P1，必须经3—5家门店单独验证')],[3.15,.75,2.7])
h2('17.2 第二轮：AI、技术与安全')
table(['发现','级别','修订结果'],[
('模型供应商未定会阻塞接口实现','阻断','定义供应商无关适配器、固定请求/响应模式和Mock实现'),
('身份一致性只有目标，没有发布门禁','阻断','加入黄金集、分组评分、严重失败率与回归阻断'),
('多租户与媒体访问边界不够明确','阻断','明确资源授权矩阵、短期签名URL和服务端租户校验'),
('删除流程缺少可验证完成条件','重要','定义立即撤销访问、24小时内物理清理和审计事件')],[3.15,.75,2.7])
h2('17.3 第三轮：工程交付与验收')
table(['发现','级别','修订结果'],[
('技术栈仍是建议项','阻断','固定首发参考栈与模块边界'),
('验收条目不足以形成测试计划','阻断','新增覆盖矩阵、P0自动化门禁与人工AI评测'),
('缺少Sprint 0交付与开发就绪定义','阻断','新增两周开发启动包、DoR和DoD'),
('开放问题可能在编码时反复改范围','重要','将非阻断问题设为复审点，不进入P0实现')],[3.15,.75,2.7])
callout('评审结论','所有开发前阻断项已转化为明确基线、接口合同或可执行门禁。方案达到“可进入Sprint 0与核心MVP开发”的标准；商业有效性仍需通过上线实验验证。')

h1('18. 开发参考架构与接口合同')
h2('18.1 固定技术基线')
table(['层级','开发基线','约束'],[
('前端','Next.js + TypeScript，响应式H5','服务端渲染公开页；业务页客户端交互'),
('服务端','Next.js Server/API或独立TypeScript服务','AI密钥、签名和租户鉴权仅在服务端'),
('数据库','PostgreSQL','所有业务主键使用UUID；时间统一UTC'),
('任务队列','Redis兼容队列','至少一次投递；处理器必须幂等'),
('媒体','S3兼容私有对象存储','浏览器直传；短期签名访问'),
('认证','手机号或邮箱一次性验证码','游客使用匿名会话ID；门店员工必须登录'),
('观测','结构化日志、错误追踪、指标告警','不得记录原图、签名URL和完整个人信息'),
('部署','容器化或托管Node运行时','开发/测试/生产完全隔离')],[1.15,3.25,2.2])
h2('18.2 AI供应商适配器')
p('开发不依赖最终供应商。所有模型实现必须满足统一接口：validateImage、generateHairstyle、moderateImage、getCost。适配器输入为私有媒体引用、模板版本、结构化参数和幂等键；输出为任务状态、结果媒体引用、供应商请求ID、耗时、费用和标准错误码。')
h3('标准错误码')
p('INVALID_INPUT、POLICY_BLOCKED、RATE_LIMITED、PROVIDER_TIMEOUT、PROVIDER_ERROR、IDENTITY_RISK、OUTPUT_INVALID、CANCELLED。前端不得直接展示供应商原始错误。')
h3('幂等与重试')
bullet('design_task_id + variant_id + attempt作为唯一执行键，同一键不得重复计费。')
bullet('限流和超时采用指数退避，最多自动重试一次；安全阻断和输入错误不重试。')
bullet('服务重启后可恢复queued/generating任务，并通过供应商请求ID对账。')
h2('18.3 核心实体约束')
table(['实体','必须字段','关键约束'],[
('design_task','id、user_id、tenant_id?、status、consent_id','用户只能读本人；门店员工仅能读本租户且已授权记录'),
('design_variant','task_id、template_version、status、attempt','每任务最多3个首发方案；重试保留历史'),
('media_asset','owner、purpose、storage_key、expires_at','storage_key不可返回前端；删除状态不可逆'),
('consent_record','subject、purpose、policy_version、granted_at','生成前必须存在有效授权'),
('salon_session','tenant_id、customer_id、stylist_id、decision','仅P1启用，严禁跨租户引用'),
('usage_ledger','actor、task、units、cost、reason','额度与供应商费用分账且不可覆盖')],[1.3,3.35,1.95])
h2('18.4 状态机约束')
bullet('只有draft可进入validating；只有通过质检的任务可进入queued。')
bullet('completed、failed、deleted为终态；partially_completed只能重试失败variant。')
bullet('deleted任务的媒体访问立即失效，但审计记录仅保存去标识化ID和时间。')
bullet('任何非法状态跳转返回409，并写入安全日志。')

h1('19. 权限、信任边界与运行控制')
h2('19.1 角色权限矩阵')
table(['资源/动作','游客','登录个人','发型师','店长','平台运营'],[
('创建个人任务','允许','允许','允许','允许','禁止代建'),
('查看个人任务','当前匿名会话','本人','本人或授权门店会话','授权门店会话','仅脱敏排障'),
('删除个人媒体','当前匿名会话','本人','不可代删','不可代删','按用户请求执行'),
('确认门店方案','不允许','顾客选择','本租户允许','本租户允许','不允许'),
('管理员工/门店','不允许','不允许','不允许','本租户允许','平台级支持'),
('查看成本与异常','不允许','不允许','不允许','本租户汇总','平台全局脱敏')],[1.45,1.0,1.15,1.1,1.0,1.0])
h2('19.2 信任边界')
bullet('浏览器→业务API：验证会话、CSRF/来源、文件类型、大小和速率。')
bullet('业务API→对象存储：只签发限定路径、类型、大小和时效的上传/下载凭证。')
bullet('业务API→任务队列：消息仅含内部ID，不包含公开URL、密钥或完整个人数据。')
bullet('任务处理器→模型供应商：使用服务端密钥；请求与返回均经审计和模式校验。')
bullet('门店员工→顾客档案：同时验证角色、tenant_id、顾客授权和资源归属。')
h2('19.3 运行控制')
bullet('全局生成功能开关、供应商级熔断、模板级下架和人群分组限制。')
bullet('按IP、会话、用户和租户四层限流；异常批量生成触发告警。')
bullet('费用达到日预算80%预警，100%自动停止新任务，管理员手动恢复。')
bullet('隐私事件、跨租户访问或身份严重漂移集中出现时立即关闭对应路径。')

h1('20. 测试覆盖与发布门禁')
h2('20.1 P0自动化测试矩阵')
table(['区域','必须覆盖的正向场景','必须覆盖的拒绝/异常场景'],[
('授权与上传','授权后获得限定上传地址','无授权、超限文件、伪造类型、多文件'),
('任务状态','合法状态逐步完成','非法跳转、重复回调、重复消费'),
('权限','本人和授权租户读取','跨用户、跨租户、过期匿名会话'),
('媒体','签名访问、主动删除','过期URL、删除后访问、路径猜测'),
('生成','三方案成功、部分成功重试','超时、限流、安全阻断、格式错误'),
('额度','成功扣减、系统失败返还','重复扣费、并发透支、客户端篡改'),
('反馈','关联正确模型和模板版本','越权反馈、无效标签、重复提交'),
('运营后台','脱敏查询和模板下架','运营人员读取原图、越权修改任务')],[1.15,2.75,3.0])
h2('20.2 AI人工评测')
bullet('360个黄金样本逐项评分；任何严重身份替换、跨样本泄露或不当内容均单独复核。')
bullet('男女、短中长发各分组均达到发布门槛，不能用总体均值掩盖弱分组。')
bullet('模型、提示词、模板和后处理版本均写入结果，可复现并可回滚。')
h2('20.3 性能与可靠性')
bullet('API非生成请求P95≤800ms；上传签名接口P95≤500ms。')
bullet('100个并发任务下队列不丢失、不重复扣费，恢复后任务状态一致。')
bullet('P95完整三方案任务≤180秒；超过阈值时前端给出可恢复状态。')
h2('20.4 发布阻断条件')
bullet('任一P0自动化测试失败、存在未关闭的高危权限问题或删除不可验证。')
bullet('身份一致性<4.0/5、严重失败≥3%或任一覆盖分组明显不达标。')
bullet('没有成本上限、熔断开关、供应商失败降级或用户退款/返额路径。')
bullet('隐私政策、用户授权、供应商数据条款未完成审批。')

h1('21. Sprint 0与开发就绪标准')
h2('21.1 Sprint 0（第1—2周）交付')
table(['工作包','交付物','验收'],[
('产品与设计','可点击核心流程、页面状态清单、文案基线','覆盖正常、空、错、加载、删除状态'),
('AI可行性','2—3家供应商对比、30图/90结果小样','选出主候选并验证身份一致性趋势'),
('工程骨架','仓库、环境、数据库迁移、队列、对象存储','开发环境端到端Mock任务完成'),
('安全与隐私','授权记录、媒体生命周期、权限中间件','跨用户/跨租户拒绝测试通过'),
('质量体系','黄金集结构、评分表、版本记录','首批30张授权样本可运行'),
('运维基线','日志、错误、预算、开关和告警','模拟超时与预算耗尽可安全停止')],[1.2,3.35,1.95])
h2('21.2 Definition of Ready')
bullet('用户故事包含角色、价值、范围、异常状态与可测试验收标准。')
bullet('涉及AI的故事明确输入、输出、拒绝、重试、成本和人工评测方式。')
bullet('涉及数据的故事明确归属、权限、保存、删除和审计。')
bullet('依赖的设计、接口和数据结构已确定；未决项有负责人和截止时间。')
h2('21.3 Definition of Done')
bullet('代码评审通过，静态检查、单元、集成和端到端测试全部通过。')
bullet('权限拒绝路径、错误恢复、日志和指标与主流程同时完成。')
bullet('接口、迁移、环境变量和运行手册同步更新。')
bullet('AI变更通过黄金集回归；发布物可回滚且开关可验证。')
h2('21.4 开发准入结论')
callout('GO','方案可进入实际开发。准入范围为Sprint 0及P0公开体验MVP；P1门店版和正式收费不得提前并入P0。最终模型供应商与价格不是编码阻断项，但必须在Sprint 0结束前完成选择。')

# Keep headings together and add simple borders to tables
for t in doc.tables:
    tblPr=t._tbl.tblPr
    tblW=tblPr.find(qn('w:tblW'))
    if tblW is None: tblW=OxmlElement('w:tblW'); tblPr.append(tblW)
    tblW.set(qn('w:w'),'9560'); tblW.set(qn('w:type'),'dxa')
    borders=tblPr.find(qn('w:tblBorders'))
    if borders is None: borders=OxmlElement('w:tblBorders'); tblPr.append(borders)
    for edge in ('top','left','bottom','right','insideH','insideV'):
        el=OxmlElement('w:'+edge); el.set(qn('w:val'),'single'); el.set(qn('w:sz'),'3'); el.set(qn('w:color'),'D8E0E5'); borders.append(el)

doc.core_properties.title='AI发型设计平台完整项目方案'
doc.core_properties.subject='产品、AI、技术、商业化与实施方案'
doc.core_properties.author='臻一'
doc.save(OUT)
print(OUT)
