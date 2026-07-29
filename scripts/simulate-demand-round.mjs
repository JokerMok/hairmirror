import {writeFile} from "node:fs/promises";
const ROUND=Number(process.env.DEMAND_ROUND||1),BASE=process.env.BASE_URL||"http://localhost:3000";let seed=20260900+ROUND;
const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296),pick=a=>a[Math.floor(rand()*a.length)];
const groups=[...Array(30).fill("近期剪发"),...Array(22).fill("谨慎决策"),...Array(18).fill("低维护"),...Array(16).fill("尝鲜分享"),...Array(14).fill("隐私敏感")];
const jobs={"近期剪发":["剪前确认效果","找到适合自己的发型"],"谨慎决策":["降低剪坏风险","和发型师说清需求"],"低维护":["找到好打理的发型","确认日常维护成本"],"尝鲜分享":["尝试不同风格","保存分享效果"],"隐私敏感":["不泄露照片地预览","确认照片处理边界"]};
const needsByRound=[[],["更真实地保持本人","先看真实案例","明确照片保存与删除","支持重生成","展示打理难度"],["生成发型师沟通卡","标注剪烫染要求","保存选中方案","展示预计价格","预约附近门店"],["原图与结果滑动对比","不满意时局部调整","多角度预览","显示可信度","让发型师二次确认"]];
async function run(i){const segment=groups[i],privacy=segment==="隐私敏感"?.93:.45,intent=segment==="近期剪发"?.95:.76;
 const started=rand()<Math.min(.99,intent+.1+(ROUND>=1?.05:0)),uploaded=started&&rand()<(.96-privacy*.07),consented=uploaded&&rand()<(1-privacy*.09),finished=consented&&rand()<.97;let api=false,latency=0;
 if(finished){const t=performance.now();const res=await fetch(`${BASE}/api/design-tasks`,{method:"POST",headers:{"content-type":"application/json","cookie":`hair_session=demand-${ROUND}-${i}`},body:JSON.stringify({consent:true,preferences:{audience:pick(["masculine","feminine","neutral"]),currentLength:pick(["short","medium","long"]),targetLength:pick(["short","medium","long"]),goal:pick(["fresh","younger","volume","professional","fashion"]),chemical:rand()>.5,dailyMinutes:pick([0,5,10,15,20])}})});latency=Math.round(performance.now()-t);api=res.ok;}
 const identity=3.65+(rand()-.5)*.9,selected=api&&rand()<(.48+(ROUND>=2?.06:0)+(ROUND>=3?.04:0)),salon=selected&&rand()<(.63+(ROUND>=2?.1:0)),pay=selected&&identity>=4&&rand()<.3;
 let pain;if(!started)pain="没有立即看懂价值";else if(!uploaded)pain="没有合适照片或不想上传";else if(!consented)pain="担心人脸数据";else if(identity<3.7)pain="人物一致性不足";else pain=pick(["缺少现实可实现说明","不知道下一步怎么带到店","无法微调不满意的部分","结果仍像参考而非承诺"]);
 const desired=pick(needsByRound[ROUND]);return{id:`R${ROUND}-${i+1}`,segment,job:pick(jobs[segment]),started,uploaded,completed:api,selected,willingToSalon:salon,willingToPay:pay,identity:identity.toFixed(1),latency,pain,desired};}
const rows=[];for(let i=0;i<100;i+=10)rows.push(...await Promise.all(Array.from({length:10},(_,j)=>run(i+j))));
const h=Object.keys(rows[0]),esc=v=>`"${String(v).replaceAll('"','""')}"`;await writeFile(`simulation/demand-round-${ROUND}-users.csv`,[h.join(","),...rows.map(r=>h.map(k=>esc(r[k])).join(","))].join("\n"));
const yes=k=>rows.filter(r=>r[k]).length,count=k=>Object.fromEntries([...new Set(rows.map(r=>r[k]))].map(v=>[v,rows.filter(r=>r[k]===v).length]).sort((a,b)=>b[1]-a[1]));
const summary={round:ROUND,started:yes("started"),uploaded:yes("uploaded"),completed:yes("completed"),selected:yes("selected"),willingToSalon:yes("willingToSalon"),willingToPay:yes("willingToPay"),jobs:count("job"),pains:count("pain"),desired:count("desired")};await writeFile(`simulation/demand-round-${ROUND}-summary.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
