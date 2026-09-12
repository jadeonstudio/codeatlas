import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {validateGraph} from '../src/contract.mjs';
const dirs=['src','bin','web'];let checks=0;
for(const d of dirs)for(const f of await fs.readdir(d)){if(!/\.(mjs|js)$/.test(f))continue;const r=spawnSync(process.execPath,['--check',`${d}/${f}`],{encoding:'utf8'});if(r.status)throw new Error(r.stderr);checks++;}
for(const file of ['examples/commerce.json','examples/process.json']){validateGraph(JSON.parse(await fs.readFile(file,'utf8')));checks++;}
const schema=JSON.parse(await fs.readFile('schemas/graph.schema.json','utf8'));if(schema.properties.schemaVersion.const!==1)throw new Error('Schema version mismatch');checks++;
for(const f of ['README.md','AGENTS.md','SECURITY.md','docs/PRD.md','docs/INSTALL.md','docs/UI_SPEC.md','docs/AGENT_PROTOCOL.md','docs/VALIDATION.md','skills/codeatlas/SKILL.md']){if((await fs.readFile(f,'utf8')).length<80)throw new Error(`Missing/empty ${f}`);checks++;}
console.log(JSON.stringify({checks,status:'passed',runtimeDependencies:0},null,2));
