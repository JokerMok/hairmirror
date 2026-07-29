import { createHash } from "node:crypto";
import { cpSync,existsSync,mkdirSync,readFileSync,readdirSync,rmSync,statSync,writeFileSync } from "node:fs";
import { join,resolve } from "node:path";
import { backup,DatabaseSync } from "node:sqlite";

const createdAt=process.argv[2];const appVersion=process.argv[3];
if(!createdAt||!appVersion)throw new Error("BACKUP_ARGUMENTS_REQUIRED");
const root=resolve(process.env.BACKUP_DIR??join(process.cwd(),"backups"));const databasePath=resolve(process.env.SQLITE_PATH??join(process.cwd(),"data","hairstyle.db"));const assetsSource=resolve(process.env.GENERATED_ASSETS_DIR??join(process.cwd(),"data","generated"));
const id=`${createdAt.replaceAll(":","-").replace(".","-")}_${appVersion.replaceAll("/","-")}`;const target=join(root,id);const databaseFile=join(target,"hairstyle.db");
function directorySize(path){return readdirSync(path,{withFileTypes:true}).reduce((sum,item)=>sum+(item.isDirectory()?directorySize(join(path,item.name)):statSync(join(path,item.name)).size),0)}
mkdirSync(root,{recursive:true,mode:0o700});mkdirSync(target,{mode:0o700});
try{
  const source=new DatabaseSync(databasePath);await backup(source,databaseFile);source.close();
  const check=new DatabaseSync(databaseFile,{readOnly:true});const integrity=check.prepare("PRAGMA integrity_check").get();check.close();if(integrity.integrity_check!=="ok")throw new Error("BACKUP_INTEGRITY_FAILED");
  if(existsSync(assetsSource))cpSync(assetsSource,join(target,"generated"),{recursive:true});
  const databaseSha256=createHash("sha256").update(readFileSync(databaseFile)).digest("hex");const sizeBytes=directorySize(target);const manifest={id,createdAt,appVersion,databaseFile:"hairstyle.db",databaseSha256,assetsDirectory:"generated",sizeBytes,target};writeFileSync(join(target,"manifest.json"),JSON.stringify(manifest,null,2),{mode:0o600});
  const keep=Math.max(2,Number(process.env.BACKUP_RETENTION_COUNT)||7);const directories=readdirSync(root,{withFileTypes:true}).filter(item=>item.isDirectory()).map(item=>({path:join(root,item.name),mtime:statSync(join(root,item.name)).mtimeMs})).sort((a,b)=>b.mtime-a.mtime);for(const item of directories.slice(keep))rmSync(item.path,{recursive:true,force:true});process.stdout.write(JSON.stringify(manifest));
}catch(error){rmSync(target,{recursive:true,force:true});throw error}
