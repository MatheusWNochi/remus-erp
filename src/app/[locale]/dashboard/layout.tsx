import { AuthGuard } from '@/modules/auth/guard/auth-guard';
import { DashboardLayout } from '@/layouts/dashboard/dashboard-layout';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <DashboardLayout>
        {children}
      </DashboardLayout>
    </AuthGuard>
  );
}
