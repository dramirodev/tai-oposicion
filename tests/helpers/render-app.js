import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AppServicesProvider } from '../../src/shared/ui/study-services.tsx';

export function renderApp(ui, { services = {}, initialEntries = ['/'] } = {}) {
  const defaults = {
    academyStudyProgress: {
      accountId:() => null,
      subscribe:() => () => {},
      loadTopicProgress:async () => ({ selection:null, events:[] }),
      loadProgressOverview:async () => ({ selections:[], events:[] }),
      selectMaterials:() => false,
      record:() => false,
    },
  };
  return render(React.createElement(
    MemoryRouter,
    { initialEntries },
    React.createElement(AppServicesProvider, { value: { ...defaults, ...services } }, ui),
  ));
}
