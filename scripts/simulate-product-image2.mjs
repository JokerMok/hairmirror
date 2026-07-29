import { writeFile } from "node:fs/promises";
const BASE=process.env.BASE_URL||"http://localhost:3000";
let seed=20260801; const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296); const pick=a=>a[Math.floor(rand()*a.length)];
const segments=[...Array(30).fill("近期准备剪发"),...Array(22).fill("谨慎决策"),...Array(18).fill("社交尝鲜"),...Array(18).fill("低维护务实"),...Array(12).fill("隐私敏感")];
const lengths=["short","medium","long"],goals=["fresh","younger","volume","professional","fashion"],audiences=["masculine","feminine","neutral"];
const rows=[];
for(let i=0;i<100;i++){
 const segment=segments[i], privacy=segment==="隐私敏感"?.92:segment==="谨慎决策"?.7:.4, intent=segment==="近期准备剪发"?.95:segment==="低维护务实"?.85:.7;
 const started=rand()<Math.min(.98,intent+.08), uploaded=started&&rand()<(.96-privacy*.08), consented=uploaded&&rand()<(1-privacy*.1), questionnaire=consented&&rand()<.97;
 let status=0,latency=0,completed=false,selected=false;
 if(questionnaire){const t=performance.now();const response=await fetch(`${BASE}/api/design-tasks`,{method:"POST",headers:{"content-type":"application/json","cookie":`hair_session=image2-u${i}`},body:JSON.stringify({consent:true,preferences:{audience:pick(audiences),currentLength:pick(lengths),targetLength:pick(lengths),goal:pick(goals),chemical:rand()>.5,dailyMinutes:pick([0,5,10,15,20])}})});latency=Math.round(performance.now()-t);status=response.status;completed=response.ok;}
 const identity=Math.max(1,Math.min(5,3.75+(rand()-.5)*1.0-(segment==="谨慎决策"?.25:0)));
 const realism=Math.max(1,Math.min(5,4.15+(rand()-.5)*.8));
 const distinction=Math.max(1,Math.min(5,4.55+(rand()-.5)*.6));
 const usefulness=Math.max(1,Math.min(5,4.1+(rand()-.5)*1.0+(intent-.7)*.5));
 const privacyTrust=Math.max(1,Math.min(5,4.35-privacy*.45+(rand()-.5)*.6));
 selected=completed&&rand()<(identity/5*.38+usefulness/5*.38+realism/5*.18);
 const willingToSalon=selected&&rand()<(.55+usefulness/10);
 const willingToPay=selected&&identity>=4&&rand()<.34;
 let feedback;
 if(!started)feedback="首屏仍不足以让我立即上传照片"; else if(!uploaded)feedback="当时没有合适的正脸照片"; else if(!consented)feedback="仍担心人脸照片的处理边界"; else if(identity<3.7)feedback="发型有区别，但脸看起来不像完全同一个人"; else if(segment==="谨慎决策"&&realism<4)feedback="需要发型师说明这个效果现实中能否实现"; else if(selected)feedback=pick(["三种真实效果放在一起很容易做决定","愿意把选中的结果带给发型师沟通","比明星参考图更有用，因为能看到自己的大概效果"]); else feedback="结果有参考价值，但还不足以让我确定最终方案";
 rows.push({id:`U${String(i+1).padStart(3,"0")}`,segment,started,uploaded,consented,completed,selected,willingToSalon,willingToPay,status,latency,identity:identity.toFixed(1),realism:realism.toFixed(1),distinction:distinction.toFixed(1),usefulness:usefulness.toFixed(1),privacyTrust:privacyTrust.toFixed(1),feedback});
}
const h=Object.keys(rows[0]),esc=v=>`"${String(v).replaceAll('"','""')}"`;
await writeFile("simulation/image2-product-100-users.csv",[h.join(","),...rows.map(r=>h.map(k=>esc(r[k])).join(","))].join("\n"));
const yes=k=>rows.filter(r=>r[k]).length,avg=k=>(rows.reduce((s,r)=>s+Number(r[k]),0)/rows.length).toFixed(2);
const summary={users:100,started:yes("started"),uploaded:yes("uploaded"),completed:yes("completed"),selected:yes("selected"),willingToSalon:yes("willingToSalon"),willingToPay:yes("willingToPay"),identity:avg("identity"),realism:avg("realism"),distinction:avg("distinction"),usefulness:avg("usefulness"),privacyTrust:avg("privacyTrust"),avgLatencyMs:Math.round(rows.filter(r=>r.completed).reduce((s,r)=>s+r.latency,0)/(yes("completed")||1))};
await writeFile("simulation/image2-product-summary.json",JSON.stringify(summary,null,2)); console.log(JSON.stringify(summary,null,2));
