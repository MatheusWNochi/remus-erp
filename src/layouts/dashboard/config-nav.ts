export type NavItem = {
  key: string;
  path: string;
  icon: string;
  comingSoon?: boolean;
};

export const navItems: NavItem[] = [
  { key: 'dashboard', path: '/dashboard', icon: 'mdi:view-dashboard-outline' },
  { key: 'customers', path: '/dashboard/customers', icon: 'mdi:account-group-outline', comingSoon: true },
  { key: 'products', path: '/dashboard/products', icon: 'mdi:package-variant-closed', comingSoon: true },
  { key: 'inventory', path: '/dashboard/inventory', icon: 'mdi:warehouse', comingSoon: true },
  { key: 'users', path: '/dashboard/users', icon: 'mdi:account-cog-outline', comingSoon: true },
];
