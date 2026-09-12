import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {Store,readJSON} from '../src/store.mjs';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const example=()=>readJSON(path.join(root,'examples/commerce.json'));
export async function fixture(t,{populated=true}={}) {
  const dir=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'atlas test ')));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const store=new Store(dir);const empty=await store.init('테스트 프로젝트');
  if(populated){const graph=await example();graph.project={...graph.project,id:empty.project.id,demo:false};await store.publish(graph,0);}
  return {dir,store};
}
