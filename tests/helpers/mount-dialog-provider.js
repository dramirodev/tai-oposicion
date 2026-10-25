import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';

export async function mountDialogProvider() {
  const { DialogProvider } = await import('../../src/shared/ui/dialogs.js');
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  flushSync(() => root.render(React.createElement(DialogProvider)));
  return () => {
    root.unmount();
    host.remove();
  };
}
