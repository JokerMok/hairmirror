import { execFileSync } from "node:child_process";
const version=process.argv[2];if(!version||!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?$/.test(version)){console.error("Usage: npm run release:create -- <version>");process.exit(1)}
if(execFileSync("git",["status","--porcelain"],{encoding:"utf8"}).trim()){console.error("Working tree must be clean before creating a release");process.exit(1)}
execFileSync("npm",["run","check"],{stdio:"inherit"});const tag=`release/${version}`;execFileSync("git",["tag","-a",tag,"-m",`发型镜 ${version}`],{stdio:"inherit"});console.log(`Created ${tag}`);
