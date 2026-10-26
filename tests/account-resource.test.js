import { afterEach, expect, it } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { useAccountResource } from '../src/shared/ui/use-account-resource.ts';
let root;
afterEach(async()=>{if(root)await act(()=>root.unmount());document.body.replaceChildren();});
it('hides the previous account immediately and rejects a late read after switching accounts',async()=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  let account='A',listener;const pending=[];
  const services={accountId:()=>account,subscribe:fn=>{listener=fn;return()=>{};},load:()=>new Promise(resolve=>pending.push(resolve))};
  function View(){const state=useAccountResource(services);return createElement('p',null,state.value||'loading');}
  const host=document.createElement('div');document.body.append(host);root=createRoot(host);
  await act(()=>root.render(createElement(View)));
  await act(async()=>pending.shift()('A secret'));expect(host.textContent).toBe('A secret');
  await act(()=>listener());const late=pending.shift();
  await act(()=>{account='B';listener();});
  expect(host.textContent).toBe('loading');
  await act(async()=>late('late A secret'));expect(host.textContent).toBe('loading');
  await act(async()=>pending.shift()('B data'));expect(host.textContent).toBe('B data');
});
