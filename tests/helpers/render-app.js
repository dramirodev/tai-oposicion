import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AppServicesProvider } from '../../src/shared/ui/study-services.tsx';

export function renderApp(ui, { services = {}, initialEntries = ['/'] } = {}) {
  return render(React.createElement(
    MemoryRouter,
    { initialEntries },
    React.createElement(AppServicesProvider, { value: services }, ui),
  ));
}
