/** Offline build-only source guards; generated output always stays in our temp fixture. */
import { afterEach, beforeEach, expect, it } from 'vitest';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, symlinkSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
let root;
const read = p => JSON.parse(readFileSync(join(root,p),'utf8'));
const save = (p,v) => writeFileSync(join(root,p),JSON.stringify(v));
const output='src/core/domain/approved-question-hashes.ts';
const ledger='scripts/bank-editorial/reviewed-languages17.json';
const run=()=>spawnSync(process.execPath,['scripts/bank-editorial/generate-content-hashes.mjs'],{cwd:root,encoding:'utf8'});
beforeEach(()=>{
 root=mkdtempSync(join(tmpdir(),'tai-build-source-'));
 cpSync('scripts/bank-editorial',join(root,'scripts/bank-editorial'),{recursive:true});
 cpSync('public/data',join(root,'public/data'),{recursive:true});
 mkdirSync(join(root,'src/core/domain'),{recursive:true});
 writeFileSync(join(root,output),'unchanged-output');
});
afterEach(()=>rmSync(root,{recursive:true,force:true}));
function rejected(){const result=run();expect(result.status,result.stderr).not.toBe(0);expect(readFileSync(join(root,output),'utf8')).toBe('unchanged-output');}
it('reproduces all 415 approved hashes from complete source records including empty context',()=>{
 const result=run();expect(result.status,result.stderr).toBe(0);
 expect(readFileSync(join(root,output),'utf8')).toBe(readFileSync(output,'utf8'));
 const nested=read(ledger).questions.filter(q=>q.scenarioId);
 expect(nested).toHaveLength(2);
 for(const q of nested){
  const sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
  const raw=read('public/data/supuestos.json')[q.scenarioId].q.find(r=>r.i===q.id);
  expect(sha(raw)).toBe(q.afterSha256);
  expect(sha({scenarioId:q.scenarioId,supTexto:'',question:raw})).toBe(q.context.afterContextualSha256);
 }
});
for(const [name,mutate] of [
 ['extra field on approved normal row',d=>{const rows=read('public/data/T3.06.json');rows.find(q=>q.i===d.questions.find(q=>!q.scenarioId).id).unexpected='drift';save('public/data/T3.06.json',rows);} ],
 ['wrong live context',d=>{const rows=read('public/data/supuestos.json');rows[d.questions.find(q=>q.scenarioId).scenarioId].texto='changed';save('public/data/supuestos.json',rows);} ],
 ['unapproved raw context field',d=>{const rows=read('public/data/supuestos.json');const entry=d.questions.find(q=>q.scenarioId);rows[entry.scenarioId].q.find(q=>q.i===entry.id).supTexto='';save('public/data/supuestos.json',rows);} ],
 ['missing ledger context',d=>{delete d.questions.find(q=>q.scenarioId).context;save(ledger,d);} ],
 ['duplicate nested ID',d=>{const rows=read('public/data/supuestos.json');const q=d.questions.find(q=>q.scenarioId);rows[q.scenarioId].q.push(q.after);save('public/data/supuestos.json',rows);} ],
 ['wrong storage path',d=>{d.questions[0].storageFile='../outside.json';save(ledger,d);} ],
 ['raw after tampering',d=>{d.questions.find(q=>q.scenarioId).after.n+=' changed';save(ledger,d);} ],
 ['wrong transport hash',d=>{d.questions[0].afterSha256='0'.repeat(64);save(ledger,d);} ],
 ['wrong contextual envelope',d=>{d.questions.find(q=>q.scenarioId).context.afterContextualSha256='0'.repeat(64);save(ledger,d);} ],
 ['symlink source file',()=>{const p=join(root,'public/data/T3.06.json');const target=join(root,'ordinary.json');cpSync(p,target);unlinkSync(p);symlinkSync(target,p);} ],
 ['symlink source directory',()=>{const p=join(root,'public/data');const target=join(root,'ordinary-data');cpSync(p,target,{recursive:true});rmSync(p,{recursive:true});symlinkSync(target,p);} ],
]) it(`rejects ${name} before replacing output`,()=>{mutate(read(ledger));rejected();});
