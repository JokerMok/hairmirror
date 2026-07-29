import { createHash } from "node:crypto";
import { cpSync, existsSync, readFileSync, renameSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const args=process.argv.slice(2);const backupArg=args[args.indexOf("--backup")+1];const confirmed=args.includes("--confirm");
if(!backupArg||!confirmed){console.error("Usage: npm run rollback:data -- --backup <backup-directory> --confirm");process.exit(1)}
const backup=resolve(backupArg);const manifestPath=resolve(backup,"manifest.json");const backupDb=resolve(backup,"hairstyle.db");if(!existsSync(manifestPath)||!existsSync(backupDb)){console.error("Invalid backup directory");process.exit(1)}
const manifest=JSON.parse(readFileSync(manifestPath,"utf8"));const checksum=createHash("sha256").update(readFileSync(backupDb)).digest("hex");if(checksum!==manifest.databaseSha256){console.error("Backup checksum mismatch");process.exit(1)}
const targetDb=resolve(process.env.SQLITE_PATH||"data/hairstyle.db");const targetAssets=resolve(process.env.GENERATED_ASSETS_DIR||"data/generated");const timestamp=new Date().toISOString().replaceAll(":","-");
console.log("The web process and worker must be stopped before rollback.");
if(existsSync(targetDb))cpSync(targetDb,`${targetDb}.before-rollback-${timestamp}`);rmSync(`${targetDb}-wal`,{force:true});rmSync(`${targetDb}-shm`,{force:true});cpSync(backupDb,targetDb);
const backupAssets=resolve(backup,"generated");if(existsSync(targetAssets))renameSync(targetAssets,`${targetAssets}.before-rollback-${timestamp}`);if(existsSync(backupAssets))cpSync(backupAssets,targetAssets,{recursive:true});
console.log(`Restored backup ${manifest.id}`);
