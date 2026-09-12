import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {assert,AtlasError,VERSION} from './contract.mjs';
import {atomicJSON,exists} from './store.mjs';
const WEB=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../web');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};
const equal=(a,b)=>{const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb);};
async function body(req) {
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;assert(size<=32768,'Request too large',413);chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new AtlasError('Invalid JSON');}
}
export async function startServer(store,{port=0,session='main',host='127.0.0.1'}={}) {
  assert(host==='127.0.0.1','Only loopback binding is supported');
  assert(Number.isInteger(port)&&port>=0&&port<65536,'Invalid port');
  store.sessionFile(session);await store.read();
  const token=randomBytes(32).toString('hex');let origin;
  const server=http.createServer(async(req,res)=>{
    const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
    try{
      assert(req.headers.host===new URL(origin).host,'Untrusted Host',403);
      if(req.headers.origin)assert(req.headers.origin===origin,'Cross-origin request rejected',403);
      const url=new URL(req.url,origin);
      if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/assets/')) {
        assert(equal(req.headers.authorization??'',`Bearer ${token}`),'Authorization required',401);
        if(req.method==='POST')assert((req.headers['content-type']??'').startsWith('application/json'),'JSON required',415);
        if(url.pathname==='/api/graph'&&req.method==='GET'){
          const g=await store.read();const tag=`"${g.project.id}:${g.revision}"`;res.setHeader('ETag',tag);
          if(req.headers['if-none-match']===tag){res.writeHead(304);res.end();return;}return send(200,g);
        }
        if(url.pathname==='/api/selection'&&req.method==='GET')return send(200,await store.selection(url.searchParams.get('session')??session));
        if(url.pathname==='/api/selection'&&req.method==='POST'){const b=await body(req);return send(200,await store.select(b.session??session,b));}
        if(url.pathname==='/api/history'&&req.method==='GET'){const rev=url.searchParams.get('revision');return send(200,await store.history(rev===null?undefined:Number(rev)));}
        if(url.pathname==='/api/info'&&req.method==='GET')return send(200,{version:VERSION,session,mode:'local',agentExecution:false});
        if(url.pathname.startsWith('/assets/')&&req.method==='GET'){
          const name=decodeURIComponent(url.pathname.slice(8));assert(/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(png|jpg|jpeg|webp)$/.test(name),'Invalid asset name');
          const dir=path.join(store.dir,'assets');assert(await exists(dir),'Asset not found',404);
          assert(!(await fs.lstat(dir)).isSymbolicLink(),'Symlink assets rejected');const file=path.join(dir,name);
          assert(await exists(file),'Asset not found',404);const stat=await fs.lstat(file);assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.size<=20*1024*1024,'Unsafe asset');
          res.setHeader('Content-Type',MIME[path.extname(name)]);return res.end(await fs.readFile(file));
        }
        return send(404,{error:'Not found'});
      }
      assert(req.method==='GET'||req.method==='HEAD','Method not allowed',405);
      const routes={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/style.css':'style.css','/icons.js':'icons.js','/logo.svg':'logo.svg'};
      const file=routes[url.pathname];assert(file,'Not found',404);
      res.setHeader('Content-Type',MIME[path.extname(file)]);res.end(req.method==='HEAD'?undefined:await fs.readFile(path.join(WEB,file)));
    }catch(e){if(!res.headersSent)send(e.status??500,{error:e.status?e.message:'Local operation failed; inspect project data or terminal logs.'});else res.end();if(!e.status)console.error(e.message);}
  });
  server.requestTimeout=10000;server.headersTimeout=10000;server.maxHeadersCount=40;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
  origin=`http://${host}:${server.address().port}`;
  const url=`${origin}/?session=${encodeURIComponent(session)}#token=${token}`;
  const metadata={pid:process.pid,origin,url,session,startedAt:new Date().toISOString()};
  await atomicJSON(path.join(store.dir,'server.json'),metadata);
  return {server,url,origin,token,close:async()=>{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});const file=path.join(store.dir,'server.json');try{const saved=JSON.parse(await fs.readFile(file,'utf8'));if(saved.pid===metadata.pid&&saved.url===url)await fs.rm(file);}catch{}}};
}
