import { expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderApp } from './helpers/render-app.js';
import { within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccessPage } from '../src/features/access/AccessPage.tsx';
it('does not revoke an access after changing account while confirmation is pending',async()=>{
  const user = userEvent.setup();
  let account='owner',confirm;const revoke=vi.fn(async()=>true);
  const access={accountId:()=>account,subscribe:()=>()=>{},load:async()=>({owner:true,requests:[],grants:[{uid:'other',name:'Otra persona',email:'other@example.test',ts:1}]}),confirm:()=>new Promise(resolve=>{confirm=resolve;}),revoke,notify:vi.fn()};
  const { container } = renderApp(createElement(AccessPage), { services: { access } });
  await user.click(await within(container).findByRole('button', { name: 'Revocar' }));
  await vi.waitFor(() => expect(confirm).toBeTypeOf('function'));
  account='someone-else';confirm(true);await Promise.resolve();
  expect(revoke).not.toHaveBeenCalled();
});
it('does not apply an old confirmation after the screen has unmounted',async()=>{
  const user = userEvent.setup();
  let confirm;const revoke=vi.fn(async()=>true);
  const access={accountId:()=> 'owner',subscribe:()=>()=>{},load:async()=>({owner:true,requests:[],grants:[{uid:'other',email:'other@example.test'}]}),confirm:()=>new Promise(resolve=>{confirm=resolve;}),revoke,notify:vi.fn()};
  const view = renderApp(createElement(AccessPage), { services: { access } });
  await user.click(await within(view.container).findByRole('button', { name: 'Revocar' }));
  await vi.waitFor(() => expect(confirm).toBeTypeOf('function'));
  view.unmount();
  confirm(true);await Promise.resolve();expect(revoke).not.toHaveBeenCalled();
});
