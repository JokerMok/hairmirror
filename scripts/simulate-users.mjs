import { writeFile } from "node:fs/promises";

const BASE=process.env.BASE_URL||"http://localhost:3000";
const ROUND=Number(process.env.SIM_ROUND||1);
let seed=Number(process.env.SIM_SEED||20260712);
function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
function pick(items){return items[Math.floor(random()*items.length)]}
const segments=[
  {name:"明确换发需求者",weight:32,intent:.96,privacy:.35,patience:.78,tech:.72},
  {name:"谨慎决策者",weight:24,intent:.82,privacy:.72,patience:.68,tech:.58},
  {name:"社交尝鲜者",weight:20,intent:.68,privacy:.38,patience:.42,tech:.9},
  {name:"低维护务实者",weight:16,intent:.88,privacy:.48,patience:.74,tech:.5},
  {name:"隐私高敏用户",weight:8,intent:.72,privacy:.94,patience:.55,tech:.62},
];
const audience=["masculine","feminine","neutral"], lengths=["short","medium","long"], goals=["fresh","younger","volume","professional","fashion"];
function segmentFor(index){let n=index;for(const s of segments){if(n<s.weight)return s;n-=s.weight}return segments[0]}
function feedbackFor(user){
  if(user.stage==="landing")return "首屏信息较多，我还没确定是否值得上传照片。";
  if(user.stage==="upload")return user.privacy>.8?"需要更明确地说明照片是否上传服务器、多久删除。":"手头没有合适的正脸照片，准备成本比预想高。";
  if(user.stage==="questionnaire")return "问题不难，但我希望先浏览发型示例再填写条件。";
  if(user.stage==="generation")return "生成失败或等待状态缺少更明确的恢复提示。";
  if(user.selected)return pick(["三种方向便于比较，但需要真实AI效果图才能判断是否可信。","推荐理由和实现条件很实用，愿意拿给发型师讨论。","流程顺畅，最有价值的是把模糊想法变成三个明确方向。"]);
  return pick(["Mock叠加效果不像真实发型，无法据此做决定。","三个方案有区别，但缺少正面/侧面和细节对比。","我理解这是演示，但当前预览质量不足以让我选择。"]);
}

const users=Array.from({length:100},(_,i)=>{
  const s=segmentFor(i); const current=pick(lengths); const target=random()<.65?current:pick(lengths);
  return {id:`U${String(i+1).padStart(3,"0")}`,segment:s.name,intent:s.intent,privacy:s.privacy,patience:s.patience,tech:s.tech,audience:pick(audience),currentLength:current,targetLength:target,goal:pick(goals),chemical:random()>.55,dailyMinutes:pick([0,5,10,15,20,30])};
});

async function experience(user){
  const started=random()<Math.min(.99,user.intent*.97+(ROUND>=2?.06:0));
  if(!started)return {...user,stage:"landing",started:false,uploaded:false,consented:false,completed:false,selected:false,latencyMs:0,status:0,variants:"",feedback:""};
  const uploaded=random()<Math.min(.99,0.96-user.privacy*.18+user.tech*.06+(ROUND>=3?.06:0));
  if(!uploaded)return {...user,stage:"upload",started:true,uploaded:false,consented:false,completed:false,selected:false,latencyMs:0,status:0,variants:"",feedback:""};
  const consented=random()<Math.min(.99,1-user.privacy*.22+(ROUND>=2?.07:0));
  if(!consented)return {...user,stage:"upload",started:true,uploaded:true,consented:false,completed:false,selected:false,latencyMs:0,status:0,variants:"",feedback:""};
  const questionnaire=random()<Math.min(.99,0.94+user.tech*.04+(ROUND>=3?.02:0));
  if(!questionnaire)return {...user,stage:"questionnaire",started:true,uploaded:true,consented:true,completed:false,selected:false,latencyMs:0,status:0,variants:"",feedback:""};
  const startedAt=performance.now();
  try{
    const response=await fetch(`${BASE}/api/design-tasks`,{method:"POST",headers:{"content-type":"application/json","cookie":`hair_session=sim-${user.id}`},body:JSON.stringify({consent:true,preferences:{audience:user.audience,currentLength:user.currentLength,targetLength:user.targetLength,goal:user.goal,chemical:user.chemical,dailyMinutes:user.dailyMinutes}})});
    const body=await response.json(); const latencyMs=Math.round(performance.now()-startedAt);
    const completed=response.ok&&body.task?.variants?.length===3;
    const selected=completed&&random()<(0.42+user.intent*.18-user.privacy*.03+(ROUND>=4?.05:0));
    const result={...user,stage:completed?"result":"generation",started:true,uploaded:true,consented:true,completed,selected,latencyMs,status:response.status,variants:completed?body.task.variants.map(v=>v.template.name).join("|"):"",feedback:""};
    return {...result,feedback:feedbackFor(result)};
  }catch{const result={...user,stage:"generation",started:true,uploaded:true,consented:true,completed:false,selected:false,latencyMs:Math.round(performance.now()-startedAt),status:0,variants:"",feedback:""};return {...result,feedback:feedbackFor(result)}}
}

const results=[];
for(let i=0;i<users.length;i+=10) results.push(...await Promise.all(users.slice(i,i+10).map(experience)));
for(const result of results) if(!result.feedback) result.feedback=feedbackFor(result);
const headers=["id","segment","audience","currentLength","targetLength","goal","chemical","dailyMinutes","stage","started","uploaded","consented","completed","selected","latencyMs","status","variants","feedback"];
const esc=(v)=>`"${String(v??"").replaceAll('"','""')}"`;
await writeFile(`simulation/round-${ROUND}-users.csv`,[headers.join(","),...results.map(r=>headers.map(h=>esc(r[h])).join(","))].join("\n"));
const count=(key)=>results.filter(r=>r[key]).length;
const completed=results.filter(r=>r.completed);
const summary={total:100,started:count("started"),uploaded:count("uploaded"),consented:count("consented"),completed:count("completed"),selected:count("selected"),avgLatencyMs:Math.round(completed.reduce((s,r)=>s+r.latencyMs,0)/(completed.length||1)),p95LatencyMs:completed.map(r=>r.latencyMs).sort((a,b)=>a-b)[Math.max(0,Math.ceil(completed.length*.95)-1)]||0,segments:Object.fromEntries(segments.map(s=>{const rows=results.filter(r=>r.segment===s.name);return [s.name,{n:rows.length,completed:rows.filter(r=>r.completed).length,selected:rows.filter(r=>r.selected).length}]}))};
summary.round=ROUND;
await writeFile(`simulation/round-${ROUND}-summary.json`,JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
