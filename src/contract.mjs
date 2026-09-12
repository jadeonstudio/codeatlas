/** Data integrity only. This module never interprets source code or predicts impact. */
export const VERSION = '0.1.0';
export const KINDS = ['surface','feature','action','interface','service','data','state','process','external','resource','test','module'];
export const RELATIONS = ['navigates','contains','triggers','calls','reads','writes','depends','invalidates','authorizes','publishes','consumes','tests','uses'];
export class AtlasError extends Error {
  constructor(message, status = 400) { super(message); this.name = 'AtlasError'; this.status = status; }
}
export const assert = (ok, message, status = 400) => { if (!ok) throw new AtlasError(message, status); };
export const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
export const validId = v => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/.test(v);
const text = (v, name, max = 20000) => assert(typeof v === 'string' && v.trim().length > 0 && v.length <= max, `${name}: nonempty string, max ${max}`);
const arr = (v, name, max = 50000) => assert(Array.isArray(v) && v.length <= max, `${name}: array, max ${max}`);
const integer = (v, name) => assert(Number.isSafeInteger(v) && v >= 0, `${name}: nonnegative integer`);
const choice = (v, choices, name) => assert(choices.includes(v), `${name}: expected ${choices.join('|')}`);
const unique = (items, name) => {
  const seen = new Set();
  for (const item of items) { assert(isObject(item) && validId(item.id), `${name}: invalid id`); assert(!seen.has(item.id), `${name}: duplicate ${item.id}`); seen.add(item.id); }
  return seen;
};
const noUnsafeKeys = value => {
  if (!value || typeof value !== 'object') return;
  for (const [k,v] of Object.entries(value)) { assert(!['__proto__','prototype','constructor'].includes(k), `Unsafe key: ${k}`); noUnsafeKeys(v); }
};
export function validateGraph(g) {
  assert(isObject(g), 'Graph must be an object');
  assert(Buffer.byteLength(JSON.stringify(g)) <= 10 * 1024 * 1024, 'Graph exceeds 10 MiB');
  noUnsafeKeys(g);
  assert(g.schemaVersion === 1, 'Unsupported schemaVersion; expected 1');
  integer(g.revision, 'revision');
  assert(isObject(g.project) && validId(g.project.id), 'project.id required');
  text(g.project.name, 'project.name', 160);
  assert(typeof g.project.demo === 'boolean', 'project.demo must be explicit');
  assert(isObject(g.analysis), 'analysis required');
  choice(g.analysis.status, ['not-started','in-progress','partial','ready','blocked'], 'analysis.status');
  text(g.analysis.summary, 'analysis.summary');
  text(g.analysis.agent, 'analysis.agent', 160);
  if (g.analysis.updatedAt !== null) assert(typeof g.analysis.updatedAt === 'string' && Number.isFinite(Date.parse(g.analysis.updatedAt)), 'analysis.updatedAt must be ISO date or null');
  if (g.analysis.coverage) {
    arr(g.analysis.coverage.examined, 'coverage.examined'); arr(g.analysis.coverage.excluded, 'coverage.excluded'); arr(g.analysis.coverage.unknown, 'coverage.unknown');
    for (const v of Object.values(g.analysis.coverage)) for (const x of v) text(x, 'coverage entry');
  }
  for (const key of ['nodes','edges','evidence','views','reports']) arr(g[key], key);
  const ns = unique(g.nodes, 'nodes'), es = unique(g.edges, 'edges'), ev = unique(g.evidence, 'evidence');
  unique(g.views, 'views'); unique(g.reports, 'reports');
  const refs = (ids, set, where) => { arr(ids, where); assert(new Set(ids).size === ids.length, `${where}: duplicate reference`); for (const id of ids) assert(set.has(id), `${where}: missing ${id}`); };
  for (const e of g.evidence) {
    choice(e.kind, ['source','runtime','test','measurement','inference','document'], 'evidence.kind');
    text(e.summary, 'evidence.summary');
    if (e.locator !== undefined) text(e.locator, 'evidence.locator', 4000);
    if (e.kind !== 'inference') text(e.locator, 'Non-inference evidence requires locator', 4000);
  }
  for (const n of g.nodes) {
    choice(n.kind, KINDS, 'node.kind'); text(n.label, 'node.label', 160);
    if (n.description !== undefined) text(n.description, 'node.description');
    refs(n.evidenceIds, ev, `node ${n.id}.evidenceIds`);
    choice(n.confidence, ['observed','inferred','unconfirmed'], 'node.confidence');
    if (n.confidence === 'observed') assert(n.evidenceIds.some(id => g.evidence.find(e=>e.id===id).kind !== 'inference'), `Observed node ${n.id} needs concrete evidence`);
    if (n.parentId !== undefined) assert(ns.has(n.parentId) && n.parentId !== n.id, `Invalid parent ${n.id}`);
    if (n.platforms !== undefined) { arr(n.platforms, 'platforms', 30); n.platforms.forEach(p=>text(p,'platform',80)); }
    if (n.conditions !== undefined) { arr(n.conditions,'conditions',100); n.conditions.forEach(c=>text(c,'condition',2000)); }
    if (n.preview !== undefined) assert(/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(png|jpg|jpeg|webp)$/.test(n.preview), 'preview must be a local raster asset filename');
  }
  const parents = new Map(g.nodes.map(n=>[n.id,n.parentId]));
  for (const n of g.nodes) { let p=n.id; const seen=new Set(); while(p) { assert(!seen.has(p), 'Parent cycle'); seen.add(p); p=parents.get(p); } }
  for (const e of g.edges) {
    assert(ns.has(e.source) && ns.has(e.target), `Dangling edge ${e.id}`);
    choice(e.relation, RELATIONS, 'edge.relation'); refs(e.evidenceIds,ev,`edge ${e.id}.evidenceIds`);
    choice(e.confidence,['observed','inferred','unconfirmed'],'edge.confidence');
    if(e.confidence==='observed') assert(e.evidenceIds.some(id=>g.evidence.find(x=>x.id===id).kind!=='inference'), `Observed edge ${e.id} needs concrete evidence`);
  }
  for (const v of g.views) {
    text(v.label,'view.label',160); choice(v.mode,['flow','system','data','process'],'view.mode');
    refs(v.nodeIds,ns,'view.nodeIds');
    assert(v.nodeIds.length <= 150, 'A view may show at most 150 nodes; create focused views instead');
    if(v.edgeIds) { refs(v.edgeIds,es,'view.edgeIds'); const ids=new Set(v.nodeIds); for(const id of v.edgeIds){const edge=g.edges.find(e=>e.id===id);assert(ids.has(edge.source)&&ids.has(edge.target),'View edge outside view');} }
    if(v.positions) { assert(isObject(v.positions),'view.positions must be object'); for(const [id,p] of Object.entries(v.positions)) { assert(v.nodeIds.includes(id),'Position outside view'); assert(isObject(p)&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<100000&&Math.abs(p.y)<100000,'Invalid position'); } }
  }
  for (const r of g.reports) {
    choice(r.kind,['impact','performance','change'],'report.kind'); text(r.title,'report.title',240); text(r.summary,'report.summary');
    integer(r.baseRevision,'report.baseRevision');
    choice(r.status,['proposed','applied','verified','partial'],'report.status');
    refs(r.targetIds,ns,'report.targetIds');
    arr(r.affected,'report.affected');
    for (const a of r.affected) {
      assert(ns.has(a.nodeId),'Unknown affected node'); choice(a.level,['direct','indirect','possible'],'affected.level'); text(a.reason,'affected.reason'); refs(a.evidenceIds,ev,'affected.evidenceIds');
      if(a.pathEdgeIds) { refs(a.pathEdgeIds,es,'affected.pathEdgeIds'); let last; for(const id of a.pathEdgeIds){const e=g.edges.find(e=>e.id===id);if(last)assert(e.source===last,'Impact path must be directed and contiguous');last=e.target;} if(last)assert(last===a.nodeId,'Impact path must end at affected node'); }
    }
    if(r.tests) { arr(r.tests,'report.tests'); for(const t of r.tests){text(t.name,'test.name'); choice(t.status,['passed','failed','not-run'],'test.status');refs(t.evidenceIds,ev,'test.evidenceIds');if(t.status!=='not-run')assert(t.evidenceIds.some(id=>g.evidence.find(e=>e.id===id).kind==='test'),'Executed test needs test evidence');} }
    if(r.metrics) { arr(r.metrics,'report.metrics'); for(const m of r.metrics){text(m.label,'metric.label');text(m.unit,'metric.unit');text(m.conditions,'metric.conditions'); choice(m.kind,['measured','estimated'],'metric.kind'); for(const key of ['before','after'])assert(m[key]===null||Number.isFinite(m[key]),`metric.${key} finite number or null`);refs(m.evidenceIds,ev,'metric.evidenceIds');if(m.kind==='measured')assert(m.evidenceIds.some(id=>g.evidence.find(e=>e.id===id).kind==='measurement'),'Measured metric requires measurement evidence');} }
    if(r.status==='verified') assert(r.tests?.length && r.tests.every(t=>t.status==='passed'), 'Verified report requires explicit passed tests; use partial otherwise');
  }
  return g;
}
export function diffGraphs(a,b) {
  const delta = key => { const old=new Map(a[key].map(x=>[x.id,x])), now=new Map(b[key].map(x=>[x.id,x])); return {added:[...now.keys()].filter(k=>!old.has(k)),removed:[...old.keys()].filter(k=>!now.has(k)),updated:[...now.keys()].filter(k=>old.has(k)&&JSON.stringify(old.get(k))!==JSON.stringify(now.get(k)))}; };
  return {from:a.revision,to:b.revision,nodes:delta('nodes'),edges:delta('edges'),reports:delta('reports')};
}
