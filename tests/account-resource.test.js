import { expect, it } from 'vitest';
import { createElement } from 'react';
import { render, screen, act } from '@testing-library/react';
import { useAccountResource } from '../src/shared/ui/use-account-resource.ts';
it('hides the previous account immediately and rejects a late read after switching accounts',async()=>{
  let account='A',listener;const pending=[];
  const services={accountId:()=>account,subscribe:fn=>{listener=fn;return()=>{};},load:()=>new Promise(resolve=>pending.push(resolve))};
  function View(){const state=useAccountResource(services);return createElement('p',null,state.value||'loading');}
  render(createElement(View));
  await act(async()=>pending.shift()('A secret'));expect(screen.getByText('A secret')).toBeInTheDocument();
  await act(()=>listener());const late=pending.shift();
  await act(()=>{account='B';listener();});
  expect(screen.getByText('loading')).toBeInTheDocument();
  await act(async()=>late('late A secret'));expect(screen.getByText('loading')).toBeInTheDocument();
  await act(async()=>pending.shift()('B data'));expect(screen.getByText('B data')).toBeInTheDocument();
});
