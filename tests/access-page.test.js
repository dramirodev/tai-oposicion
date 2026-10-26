import { afterEach, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { AppServicesProvider } from '../src/shared/ui/study-services.tsx';
import { AccessPage } from '../src/features/access/AccessPage.tsx';
let root;
afterEach(async()=>{if(root)await act(()=>root.unmount());document.body.replaceChildren();});
it('does not revoke an access after changing account while confirmation is pending',async()=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  let account='owner',confirm;const revoke=vi.fn(async()=>true);
  const access={accountId:()=>account,subscribe:()=>()=>{},load:async()=>({owner:true,requests:[],grants:[{uid:'other',name:'Otra persona',email:'other@example.test',ts:1}]}),confirm:()=>new Promise(resolve=>{confirm=resolve;}),revoke,notify:vi.fn()};
  const host=document.createElement('div');document.body.append(host);root=createRoot(host);
  await act(async()=>root.render(createElement(MemoryRouter,null,createElement(AppServicesProvider,{value:{access}},createElement(AccessPage)))));
  await act(()=>host.querySelector('[data-rv]').click());
  account='someone-else';await act(async()=>confirm(true));
  expect(revoke).not.toHaveBeenCalled();
});
it('does not apply an old confirmation after the screen has unmounted',async()=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  let confirm;const revoke=vi.fn(async()=>true);
  const access={accountId:()=> 'owner',subscribe:()=>()=>{},load:async()=>({owner:true,requests:[],grants:[{uid:'other',email:'other@example.test'}]}),confirm:()=>new Promise(resolve=>{confirm=resolve;}),revoke,notify:vi.fn()};
  const host=document.createElement('div');document.body.append(host);root=createRoot(host);
  await act(async()=>root.render(createElement(MemoryRouter,null,createElement(AppServicesProvider,{value:{access}},createElement(AccessPage)))));
  await act(()=>host.querySelector('[data-rv]').click());
  await act(()=>root.unmount());root=undefined;
  await act(async()=>confirm(true));expect(revoke).not.toHaveBeenCalled();
});
