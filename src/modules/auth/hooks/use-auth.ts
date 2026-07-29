import { useContext } from 'react';

import { AuthContext } from '../context';

export const useAuth = () => {
  const authContextValue = useContext(AuthContext);

  if (!authContextValue) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return authContextValue;
};