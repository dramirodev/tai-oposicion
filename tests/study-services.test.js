import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { AppServicesProvider, useOptionalStudyService, useStudyService } from '../src/shared/ui/study-services.tsx';

describe('feature-scoped service access', () => {
  it('returns only the requested service from the app composition', () => {
    const stats = { load: async () => ({}) };
    const wrapper = ({ children }) => React.createElement(AppServicesProvider, { value: { stats } }, children);

    const { result } = renderHook(() => useStudyService('stats'), { wrapper });

    expect(result.current).toBe(stats);
  });

  it('keeps optional service access safe outside the app provider', () => {
    const { result } = renderHook(() => useOptionalStudyService('markReady'));

    expect(result.current).toBeNull();
  });

  it('fails clearly when a required feature service is missing', () => {
    expect(() => renderHook(() => useStudyService('stats'))).toThrow('Falta AppServicesProvider');
  });
});
