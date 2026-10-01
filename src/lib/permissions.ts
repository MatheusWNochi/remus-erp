/**
 * Catálogo de permissões — espelha `auth_permission` (ver
 * `prisma/sql/02_v1_seed_rbac.sql`). Mantenha os dois lados em sincronia.
 */

export const PERMISSION_MODULES = [
  'dashboard',
  'customers',
  'products',
  'inventory',
  'users',
  'roles',
] as const;

export const PERMISSION_ACTIONS = ['view', 'create', 'edit', 'delete', 'export'] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const PERMISSIONS = [
  'dashboard.view',

  'customers.view',
  'customers.create',
  'customers.edit',
  'customers.delete',
  'customers.export',

  'products.view',
  'products.create',
  'products.edit',
  'products.delete',
  'products.export',

  'inventory.view',
  'inventory.create',
  'inventory.export',

  'users.view',
  'users.create',
  'users.edit',
  'users.delete',

  'roles.view',
  'roles.edit',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Ações válidas por módulo — usado para montar a matriz da tela de Papéis. */
export const MODULE_ACTIONS: Record<PermissionModule, PermissionAction[]> = {
  dashboard: ['view'],
  customers: ['view', 'create', 'edit', 'delete', 'export'],
  products: ['view', 'create', 'edit', 'delete', 'export'],
  inventory: ['view', 'create', 'export'],
  users: ['view', 'create', 'edit', 'delete'],
  roles: ['view', 'edit'],
};

export function hasPermission(granted: readonly string[], permission: Permission): boolean {
  return granted.includes(permission);
}
