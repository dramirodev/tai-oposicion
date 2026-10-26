// @vitest-environment node
import {it,expect} from 'vitest';
import {execFileSync} from 'node:child_process';
it('cuenta el vencimiento al final del día de 25 horas en hoy',()=>{
 const result=execFileSync(process.execPath,['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON','--experimental-strip-types','--input-type=module','-e',`
 import {countReviewsByDay} from './src/core/domain/spaced-repetition.ts';
 console.log(JSON.stringify(countReviewsByDay([{intervalStep:0,dueAt:Date.parse('2026-10-25T23:30:00+01:00')}],Date.parse('2026-10-25T00:10:00+02:00'),3)));
 `],{env:{...process.env,TZ:'Europe/Madrid'},encoding:'utf8'});
 expect(JSON.parse(result)).toEqual([1,0,0]);
});
