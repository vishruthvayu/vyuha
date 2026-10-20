import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,copyFile,readFile,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";
test("Production offline packaging distributes full font notices and caches their local copies",async()=>{
 const root=await mkdtemp(join(tmpdir(),"vyuha-font-deployment-"));
 try{
  await mkdir(join(root,"dist"),{recursive:true});await writeFile(join(root,"dist/index.html"),"<html>fixture</html>");
  await mkdir(join(root,"src/premium/fonts"),{recursive:true});
  const names=["OFL-Geist-and-Geist-Mono.txt","OFL-Instrument-Serif.txt"];
  for(const name of names)await copyFile(new URL("./premium/fonts/"+name,import.meta.url),join(root,"src/premium/fonts",name));
  execFileSync(process.execPath,[fileURLToPath(new URL("../scripts/offline.mjs",import.meta.url))],{cwd:root});
  const sw=await readFile(join(root,"dist/sw.js"),"utf8");
  for(const name of names){assert.equal(await readFile(join(root,"dist/licenses",name),"utf8"),await readFile(new URL("./premium/fonts/"+name,import.meta.url),"utf8"));assert.ok(sw.includes("/licenses/"+name));}
 }finally{await rm(root,{recursive:true,force:true});}
});
