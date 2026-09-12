import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {Store,projectRoot,readJSON,exists,safeDir} from './store.mjs';
import {assert,VERSION,validateGraph,diffGraphs} from './contract.mjs';
import {install,uninstall,mcpConfig,PACKAGE_ROOT} from './install.mjs';
import {startServer} from './server.mjs';
import {runMcp,callTool} from './mcp.mjs';
const HELP=`CodeAtlas ${VERSION} — instructions + shared visual context; no model API.
Node.js 22+ / no production dependencies / localhost only.

  codeatlas install --project /path/to/project --agents codex,claude,generic,grok
  codeatlas init --project /path/to/project [--name "프로젝트명"]
  codeatlas serve --project /path/to/project --session codex-main [--port 0]
  codeatlas context --project /path/to/project --session codex-main
  codeatlas status --project /path/to/project
  codeatlas validate --file graph.json
  codeatlas publish --file graph.json --expect 0 --project /path/to/project
  codeatlas patch --file delta.json --expect 1 --project /path/to/project
  codeatlas export --project /path/to/project [--out graph.json]
  codeatlas history --project /path/to/project
  codeatlas diff --from 0 --project /path/to/project
  codeatlas asset --file screenshot.png --name screen.png --project /path/to/project
  codeatlas mcp --project /path/to/project --session codex-main
  codeatlas mcp-config --agent codex --project /path/to/project --session codex-main
  codeatlas doctor --project /path/to/project
  codeatlas uninstall --project /path/to/project
  codeatlas demo [--session demo] [--port 0]

The same CLI is available as: node /path/to/codeatlas/bin/codeatlas.mjs
Serve stays in the foreground; your agent opens its URL in its existing browser.
Demo uses a new temporary directory, never overwrites your current project.
`;
function parse(argv) {
  const [command='help',...rest]=argv,options={};
  const allowed=new Set(['project','agents','name','session','port','file','expect','out','from','agent']);
  for(let i=0;i<rest.length;i++){const key=rest[i];assert(key.startsWith('--')&&allowed.has(key.slice(2)),`Unknown option ${key}`);assert(rest[i+1]!==undefined&&!rest[i+1].startsWith('--'),`Missing value for ${key}`);assert(options[key.slice(2)]===undefined,`Duplicate ${key}`);options[key.slice(2)]=rest[++i];}
  return {command,options};
}
export async function main(argv=process.argv.slice(2)) {
  const {command,options:o}=parse(argv);const print=x=>console.log(typeof x==='string'?x:JSON.stringify(x,null,2));
  if(['help','--help','-h'].includes(command)){print(HELP);return;}
  if(command==='version'){print(VERSION);return;}
  if(command==='validate'){assert(o.file,'--file required');validateGraph(await readJSON(path.resolve(o.file)));print({valid:true});return;}
  const root=await projectRoot(o.project??process.cwd()),store=new Store(root),session=o.session??'main';
  if(command==='install'){print(await install(store,(o.agents??'codex,claude,generic').split(',')));return;}
  if(command==='uninstall'){print(await uninstall(store));return;}
  if(command==='init'){print(await store.init(o.name));return;}
  if(command==='mcp-config'){print(mcpConfig(root,session,o.agent));return;}
  if(command==='doctor'){
    const results={node:process.version,project:root,initialized:await exists(path.join(store.dir,'project.json')),runtime:await exists(path.join(store.dir,'runtime/bin/codeatlas.mjs')),browser:'Open the serve URL in the host browser; embedded host support is not tested here.',agentExecution:'Owned by your current agent, not CodeAtlas'};
    if(results.initialized){const g=await store.read();results.graph={valid:true,revision:g.revision,nodes:g.nodes.length};results.session=await store.selection(session);}print(results);return;
  }
  if(command==='demo'){
    const dir=await fs.mkdtemp(path.join(os.tmpdir(),'codeatlas-demo-'));const ds=new Store(dir);const empty=await ds.init('아틀라스 스토어');const g=await readJSON(path.join(PACKAGE_ROOT,'examples/commerce.json'));g.project.id=empty.project.id;await ds.publish(g,0,{demo:true});
    await ds.select(session,{nodeIds:['web.products'],graphRevision:1,viewId:'purchase',intent:'question'});
    print({demo:true,directory:dir,notice:'모든 화면·성능·테스트 값은 예시 데이터입니다.'});await serve(ds,o,session,print);return;
  }
  if(command==='serve'){await store.init();await serve(store,o,session,print);return;}
  if(command==='mcp'){await store.init();await runMcp(store,session);return;}
  if(command==='context'){print(await store.context(session));return;}
  if(command==='status'){print(await callTool(store,session,'atlas_status'));return;}
  if(command==='publish'||command==='patch'){
    assert(o.file&&o.expect!==undefined,'--file and --expect are required');const candidate=await readJSON(path.resolve(o.file));print(await store[command](candidate,Number(o.expect)));return;
  }
  if(command==='export'){const g=await store.read();if(o.out)await fs.writeFile(path.resolve(o.out),JSON.stringify(g,null,2)+'\n');else print(g);return;}
  if(command==='history'){print(await store.history());return;}
  if(command==='diff'){assert(o.from!==undefined,'--from required');print(diffGraphs(await store.history(Number(o.from)),await store.read()));return;}
  if(command==='asset'){
    assert(o.file&&o.name&&/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(png|jpg|jpeg|webp)$/.test(o.name),'--file and raster --name required');
    await store.read();const bytes=await fs.readFile(path.resolve(o.file));assert(bytes.length<=20*1024*1024,'Asset exceeds 20 MiB');
    const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,webp=bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
    const extension=path.extname(o.name);assert((extension==='.png'&&png)||(['.jpg','.jpeg'].includes(extension)&&jpg)||(extension==='.webp'&&webp),'Image signature/extension mismatch');
    await safeDir(root,'.codeatlas/assets');await fs.writeFile(path.join(store.dir,'assets',o.name),bytes,{flag:'wx',mode:0o600});print({asset:o.name});return;
  }
  throw new Error(`Unknown command ${command}; use help`);
}
async function serve(store,o,session,print) {
  const running=await startServer(store,{port:Number(o.port??0),session});print({url:running.url,session,project:store.root,notice:'Local UI only. The existing agent performs all analysis and editing.'});
  const shutdown=async()=>{await running.close();process.exit(0);};process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
}
