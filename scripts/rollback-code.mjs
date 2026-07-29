import { execFileSync } from "node:child_process";
const tag=process.argv[2];const confirmed=process.argv.includes("--confirm");if(!tag||!/^release\/[0-9]+\.[0-9]+\.[0-9]+/.test(tag)||!confirmed){console.error("Usage: npm run rollback:code -- release/<version> --confirm");process.exit(1)}
if(execFileSync("git",["status","--porcelain"],{encoding:"utf8"}).trim()){console.error("Working tree must be clean before rollback");process.exit(1)}
execFileSync("git",["rev-parse","--verify",tag],{stdio:"ignore"});execFileSync("git",["switch","--detach",tag],{stdio:"inherit"});console.log(`Checked out ${tag}. Run npm ci && npm run build before restarting services.`);
