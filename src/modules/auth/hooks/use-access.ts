'use client';

import { useContext } from 'react';

import { AccessContext } from '../context/access-provider';

export function useAccess() {
  const context = useContext(AccessContext);

  if (!context) {
    throw new Error('useAccess precisa estar dentro de <AccessProvider>');
  }

  return context;
}
