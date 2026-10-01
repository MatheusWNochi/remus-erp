import type { userStatus } from '@/generated/prisma/enums';

export type UserStatus = userStatus;

/** DTO serializável devolvido pelas server actions (sem Date cru nem senha). */
export type UserListItem = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roleId: string;
  roleName: string;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
};

export type UserListParams = {
  search?: string;
  roleId?: string | 'ALL';
  status?: UserStatus | 'ALL';
  page: number;
  pageSize: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
};

export type UserListResult = {
  rows: UserListItem[];
  total: number;
};

/**
 * Papel com o que a tela precisa para desenhar a matriz e avisar sobre perda
 * de acesso ao trocar o papel de alguém — por isso vem com as permissões.
 */
export type RoleListItem = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissionCodes: string[];
};
