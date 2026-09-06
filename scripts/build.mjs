import {readdir,stat,truncate} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {join,resolve} from 'node:path';
// Reclaim only disposable bytes in this checkout. Preserve paths because the
// deployment host measures directory size concurrently with the build.
let reclaimed=0;
async function clearFiles(dir,predicate=()=>true){let entries;try{entries=await readdir(dir,{withFileTypes:true})}catch(e){if(e.code==='ENOENT')return;throw e}for(const entry of entries){const path=join(dir,entry.name);if(entry.isDirectory())await clearFiles(path,predicate);else if(entry.isFile()&&predicate(path)){reclaimed+=(await stat(path)).size;await truncate(path,0)}}}
await clearFiles(resolve('.npm-cache'));
const glibc=process.report.getReport().header.glibcVersionRuntime;
if(process.platform==='linux'&&process.arch==='x64')await clearFiles(resolve('node_modules/@next',glibc?'swc-linux-x64-musl':'swc-linux-x64-gnu'),p=>p.endsWith('.node'));
await clearFiles(resolve('node_modules'),p=>p.endsWith('.map'));
console.log(`Build preparation reclaimed ${Math.round(reclaimed/1024/1024)} MB of disposable dependency/cache content.`);
const build=spawn(process.execPath,['node_modules/next/dist/bin/next','build'],{stdio:'inherit'});
build.once('exit',code=>process.exit(code??1));
