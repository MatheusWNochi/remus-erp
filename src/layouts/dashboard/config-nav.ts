import type { Permission } from '@/lib/permissions';

export type NavItem = {
  key: string;
  path: string;
  icon: string;
  /** Item some do menu quando o usuário não tem esta permissão. */
  permission: Permission;
  comingSoon?: boolean;
};

export const navItems: NavItem[] = [
  {
    key: 'dashboard',
    path: '/dashboard',
    icon: 'mdi:view-dashboard-outline',
    permission: 'dashboard.view',
  },
  {
    key: 'customers',
    path: '/dashboard/customers',
    icon: 'mdi:account-group-outline',
    permission: 'customers.view',
  },
  {
    key: 'products',
    path: '/dashboard/products',
    icon: 'mdi:package-variant-closed',
    permission: 'products.view',
  },
  {
    key: 'inventory',
    path: '/dashboard/inventory',
    icon: 'mdi:warehouse',
    permission: 'inventory.view',
  },
  {
    key: 'users',
    path: '/dashboard/users',
    icon: 'mdi:account-cog-outline',
    permission: 'users.view',
  },
];
