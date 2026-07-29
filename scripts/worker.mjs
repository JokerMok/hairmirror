const baseUrl=process.env.WORKER_BASE_URL||"http://127.0.0.1:3000";
const secret=process.env.INTERNAL_JOB_SECRET;
if(!secret){console.error("INTERNAL_JOB_SECRET is required");process.exit(1)}
const pollMs=Math.max(500,Number(process.env.WORKER_POLL_MS)||2000);
const maintenanceMs=Math.max(60_000,Number(process.env.MAINTENANCE_INTERVAL_MS)||15*60*1000);
let stopping=false;let lastMaintenance=0;
process.on("SIGINT",()=>{stopping=true});process.on("SIGTERM",()=>{stopping=true});

async function call(path,body={}){const response=await fetch(`${baseUrl}${path}`,{method:"POST",headers:{authorization:`Bearer ${secret}`,"content-type":"application/json"},body:JSON.stringify(body)});if(!response.ok)throw new Error(`${path} HTTP ${response.status}`);return response.json()}
while(!stopping){try{const result=await call("/api/internal/worker",{limit:3});const active=result.results?.some(item=>item.status!=="idle");if(Date.now()-lastMaintenance>=maintenanceMs){await call("/api/internal/maintenance");lastMaintenance=Date.now()}if(!active)await new Promise(resolve=>setTimeout(resolve,pollMs))}catch(error){console.error(new Date().toISOString(),error instanceof Error?error.message:"worker failed");await new Promise(resolve=>setTimeout(resolve,Math.min(30_000,pollMs*5)))}}
