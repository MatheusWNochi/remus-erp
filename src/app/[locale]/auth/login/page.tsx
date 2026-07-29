import { Suspense } from 'react';

import { LoginView } from '@/modules/auth/components/login-view';

export default function LoginPage() {
  return (
    <Suspense>
      <LoginView />
    </Suspense>
  );
}
