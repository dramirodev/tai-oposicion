import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

it('solo omite reglas si no cambiaron desde el último despliegue correcto, incluso tras un fallo previo', () => {
  const workflow = readFileSync('.github/workflows/deploy.yml','utf8');
  const block = workflow.split('        id: deploy_scope\n')[1].split('\n      - name: Desplegar reglas')[0];
  const script = block.split('        run: |\n')[1].split('\n').map(line => line.replace(/^          /,'')).join('\n');
  const directory = mkdtempSync(join(tmpdir(),'tai-deploy-scope-'));
  const git = (...args) => execFileSync('git',['-c','user.name=TAI fixture','-c','user.email=fixture@example.test','-c','commit.gpgsign=false','-c','core.hooksPath=/dev/null',...args],{ cwd:directory,encoding:'utf8',stdio:['ignore','pipe','pipe'] }).trim();
  const output = join(directory,'scope-output');
  const scope = () => {
    writeFileSync(output,'');
    execFileSync('bash',['-c',script],{ cwd:directory,env:{ ...process.env,GITHUB_SHA:git('rev-parse','HEAD'),GITHUB_OUTPUT:output } });
    return readFileSync(output,'utf8').trim();
  };
  const publishTag = () => git('tag',`v1.0.0+${git('rev-parse','--short=7','HEAD')}`);
  try {
    git('init','-q');
    writeFileSync(join(directory,'firestore.rules'),'old-rules');
    writeFileSync(join(directory,'firebase.json'),'{}');
    writeFileSync(join(directory,'.firebaserc'),'{}');
    git('add','--','firestore.rules','firebase.json','.firebaserc');git('commit','-qm','initial');
    publishTag();
    expect(scope()).toBe('rules_changed=false');
    writeFileSync(join(directory,'firestore.rules'),'new-rules');
    git('add','--','firestore.rules');git('commit','-qm','rules change; deployment fails');
    expect(scope()).toBe('rules_changed=true');
    writeFileSync(join(directory,'app.txt'),'UI change');
    git('add','--','app.txt');git('commit','-qm','UI after failed deployment');
    expect(scope()).toBe('rules_changed=true');
    publishTag();
    expect(scope()).toBe('rules_changed=false');
    writeFileSync(join(directory,'firebase.json'),'{"changed":true}');
    git('add','--','firebase.json');git('commit','-qm','hosting configuration changes');
    expect(scope()).toBe('rules_changed=true');
  } finally { rmSync(directory,{ recursive:true,force:true }); }
});
