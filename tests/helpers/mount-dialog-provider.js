import React from 'react';
import { render } from '@testing-library/react';

export async function mountDialogProvider() {
  const { DialogProvider } = await import('../../src/shared/ui/dialogs.js');
  const result = render(React.createElement(DialogProvider));
  return result.unmount;
}
