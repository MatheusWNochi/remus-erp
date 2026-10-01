import { AuthGuard } from '@/modules/auth/guard/auth-guard';
import { AccessProvider } from '@/modules/auth/context/access-provider';
import { DashboardLayout } from '@/layouts/dashboard/dashboard-layout';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AccessProvider>
        <DashboardLayout>
          {children}
        </DashboardLayout>
      </AccessProvider>
    </AuthGuard>
  );
}
