'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSnackbar } from 'notistack';
import { Icon } from '@iconify/react';
import { alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { GridColDef } from '@mui/x-data-grid';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataTable, type FilterChip } from '@/components/data-table';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { StatusChip, USER_STATUS_TONE } from '@/components/status-chip';
import {
  MODULE_ACTIONS,
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  type PermissionModule,
} from '@/lib/permissions';
import { useAccess } from '@/modules/auth/hooks/use-access';
import { formatDateTime } from '@/utils/format';
import { setUserStatus, updateRolePermissions } from '../actions';
import { useUsers } from '../hooks/use-users';
import type { RoleListItem, UserListItem } from '../types';
import { UserFormDrawer } from './user-form-drawer';

/** Erros destas actions não vivem no namespace `Errors`, e sim em `Users`. */
const USER_ERROR_KEYS = new Set(['emailTaken', 'selfDeactivate', 'selfRoleChange']);

type PendingRoleChange = {
  user: UserListItem;
  from: RoleListItem;
  to: RoleListItem;
  /** Módulos que o usuário deixa de acessar com o novo papel. */
  lostModules: PermissionModule[];
};

export function UsersView() {
  const t = useTranslations('Users');
  const tRoles = useTranslations('Roles');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const locale = useLocale();
  const { can, access } = useAccess();
  const { enqueueSnackbar } = useSnackbar();

  const list = useUsers();

  const [tab, setTab] = useState<'users' | 'roles'>('users');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<UserListItem | null>(null);
  const [deactivating, setDeactivating] = useState<UserListItem | null>(null);
  const [isDeactivatingBusy, setIsDeactivatingBusy] = useState(false);
  const [roleChange, setRoleChange] = useState<PendingRoleChange | null>(null);

  // O drawer fica esperando a resposta do diálogo; o resolver guardado aqui é
  // o que religa a confirmação ao `await` que ficou pendurado lá.
  const roleChangeResolver = useRef<((confirmed: boolean) => void) | null>(null);

  const canCreate = can('users.create');
  const canEdit = can('users.edit');
  const canEditRoles = can('roles.edit');

  const showError = useCallback(
    (key: string) => {
      enqueueSnackbar(USER_ERROR_KEYS.has(key) ? t(`errors.${key}`) : tErrors(key), {
        variant: 'error',
      });
    },
    [enqueueSnackbar, t, tErrors]
  );

  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };

  const openEdit = (user: UserListItem) => {
    setEditing(user);
    setDrawerOpen(true);
  };

  /**
   * Rebaixar alguém é silencioso demais: quem salva não vê o que a pessoa
   * perde. O diálogo só aparece quando o papel novo tem menos permissões que
   * o atual — promover não precisa de confirmação.
   */
  const confirmRoleChange = useCallback(
    (user: UserListItem, nextRoleId: string): Promise<boolean> => {
      const from = list.roles.find((role) => role.id === user.roleId);
      const to = list.roles.find((role) => role.id === nextRoleId);

      if (!from || !to || from.id === to.id) {
        return Promise.resolve(true);
      }

      const next = new Set(to.permissionCodes);
      const lost = from.permissionCodes.filter((code) => !next.has(code));

      if (lost.length === 0) {
        return Promise.resolve(true);
      }

      const lostModules = PERMISSION_MODULES.filter((module) =>
        lost.some((code) => code.startsWith(`${module}.`))
      );

      setRoleChange({ user, from, to, lostModules });

      return new Promise<boolean>((resolve) => {
        roleChangeResolver.current = resolve;
      });
    },
    [list.roles]
  );

  const resolveRoleChange = (confirmed: boolean) => {
    roleChangeResolver.current?.(confirmed);
    roleChangeResolver.current = null;
    setRoleChange(null);
  };

  const handleActivate = async (user: UserListItem) => {
    const result = await setUserStatus(user.id, 'ACTIVE');

    if (!result.ok) {
      showError(result.error);
      return;
    }

    enqueueSnackbar(t('toast.activated'), { variant: 'success' });
    void list.refresh();
  };

  const handleDeactivate = async () => {
    if (!deactivating) {
      return;
    }

    setIsDeactivatingBusy(true);

    try {
      const result = await setUserStatus(deactivating.id, 'INACTIVE');

      if (!result.ok) {
        showError(result.error);
        return;
      }

      setDeactivating(null);
      enqueueSnackbar(t('toast.deactivated'), { variant: 'success' });
      void list.refresh();
    } finally {
      setIsDeactivatingBusy(false);
    }
  };

  const columns = useMemo<GridColDef<UserListItem>[]>(
    () => [
      {
        field: 'firstName',
        headerName: t('fields.name'),
        flex: 1.2,
        minWidth: 180,
        hideable: false,
        renderCell: (params) => (
          <Stack sx={{ justifyContent: 'center', height: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
              {`${params.row.firstName} ${params.row.lastName}`.trim()}
            </Typography>
          </Stack>
        ),
      },
      {
        field: 'email',
        headerName: t('fields.email'),
        flex: 1.3,
        minWidth: 200,
      },
      {
        field: 'roleName',
        headerName: t('fields.role'),
        flex: 0.8,
        minWidth: 140,
        sortable: false,
      },
      {
        field: 'status',
        headerName: t('fields.status'),
        width: 150,
        renderCell: (params) => (
          <StatusChip
            label={t(`status.${params.row.status}`)}
            tone={USER_STATUS_TONE[params.row.status] ?? 'default'}
          />
        ),
      },
      {
        field: 'lastLoginAt',
        headerName: t('fields.lastLogin'),
        width: 160,
        valueFormatter: (value: string | null) =>
          value ? formatDateTime(value, locale) : t('fields.never'),
      },
      {
        field: 'actions',
        headerName: '',
        width: 100,
        sortable: false,
        hideable: false,
        align: 'right',
        headerAlign: 'right',
        renderCell: (params) => {
          const isActive = params.row.status === 'ACTIVE';

          return (
            <Stack direction="row" spacing={0.5} sx={{ height: 1, alignItems: 'center' }}>
              <Tooltip title={canEdit ? tCommon('edit') : tCommon('noPermission')}>
                <span>
                  <IconButton
                    size="small"
                    disabled={!canEdit}
                    onClick={(event) => {
                      event.stopPropagation();
                      openEdit(params.row);
                    }}
                  >
                    <Icon icon="mdi:pencil-outline" width={18} height={18} />
                  </IconButton>
                </span>
              </Tooltip>

              <Tooltip
                title={
                  canEdit
                    ? isActive
                      ? tCommon('deactivate')
                      : tCommon('activate')
                    : tCommon('noPermission')
                }
              >
                <span>
                  <IconButton
                    size="small"
                    disabled={!canEdit}
                    onClick={(event) => {
                      event.stopPropagation();

                      if (isActive) {
                        setDeactivating(params.row);
                      } else {
                        void handleActivate(params.row);
                      }
                    }}
                  >
                    <Icon
                      icon={isActive ? 'mdi:account-off-outline' : 'mdi:account-check-outline'}
                      width={18}
                      height={18}
                    />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          );
        },
      },
    ],
    // `openEdit` e `handleActivate` são estáveis o bastante para o escopo
    // desta tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, tCommon, locale, canEdit]
  );

  const activeFilters = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];

    if (list.status !== 'ALL') {
      chips.push({
        key: 'status',
        label: `${t('filters.status')}: ${t(`status.${list.status}`)}`,
        onRemove: () => list.onStatusChange('ALL'),
      });
    }

    if (list.roleId !== 'ALL') {
      const role = list.roles.find((item) => item.id === list.roleId);

      chips.push({
        key: 'role',
        label: `${t('filters.role')}: ${role?.name ?? list.roleId}`,
        onRemove: () => list.onRoleChange('ALL'),
      });
    }

    return chips;
  }, [list, t]);

  return (
    <Stack spacing={3} sx={{ px: { xs: 2, md: 4 }, py: 4, maxWidth: 1400, mx: 'auto', width: 1 }}>
      <PageHeader
        title={t('title')}
        description={t('description')}
        breadcrumbs={[{ label: tCommon('overview'), href: '/dashboard' }, { label: t('title') }]}
        action={
          tab === 'users' ? (
            <Tooltip title={canCreate ? '' : tCommon('noPermission')}>
              <span>
                <Button
                  variant="contained"
                  disabled={!canCreate}
                  onClick={openCreate}
                  startIcon={<Icon icon="mdi:plus" width={20} height={20} />}
                >
                  {t('new')}
                </Button>
              </span>
            </Tooltip>
          ) : undefined
        }
      />

      <Tabs value={tab} onChange={(_event, value: 'users' | 'roles') => setTab(value)}>
        <Tab value="users" label={tRoles('tabs.users')} />
        <Tab value="roles" label={tRoles('tabs.roles')} />
      </Tabs>

      {tab === 'users' ? (
        <DataTable<UserListItem>
          rows={list.rows}
          columns={columns}
          rowCount={list.total}
          loading={list.isLoading}
          search={list.search}
          onSearchChange={list.onSearchChange}
          searchPlaceholder={t('searchPlaceholder')}
          paginationModel={list.paginationModel}
          onPaginationModelChange={list.setPaginationModel}
          sortModel={list.sortModel}
          onSortModelChange={list.setSortModel}
          activeFilters={activeFilters}
          onClearFilters={list.clearFilters}
          hasFiltersApplied={activeFilters.length > 0 || Boolean(list.search)}
          filters={
            <>
              <TextField
                select
                size="small"
                label={t('filters.status')}
                value={list.status}
                onChange={(event) =>
                  list.onStatusChange(event.target.value as UserListItem['status'] | 'ALL')
                }
                sx={{ minWidth: 170 }}
              >
                <MenuItem value="ALL">{tCommon('all')}</MenuItem>
                <MenuItem value="ACTIVE">{t('status.ACTIVE')}</MenuItem>
                <MenuItem value="INACTIVE">{t('status.INACTIVE')}</MenuItem>
                <MenuItem value="INVITED">{t('status.INVITED')}</MenuItem>
              </TextField>

              <TextField
                select
                size="small"
                label={t('filters.role')}
                value={list.roles.some((role) => role.id === list.roleId) ? list.roleId : 'ALL'}
                onChange={(event) => list.onRoleChange(event.target.value)}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="ALL">{tCommon('all')}</MenuItem>
                {list.roles.map((role) => (
                  <MenuItem key={role.id} value={role.id}>
                    {role.name}
                  </MenuItem>
                ))}
              </TextField>
            </>
          }
          emptyTitle={t('empty')}
          emptyDescription={t('emptyDescription')}
          emptyIcon="mdi:account-multiple-outline"
          emptyAction={
            canCreate ? (
              <Button variant="contained" onClick={openCreate}>
                {t('new')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <RolesPanel
          roles={list.roles}
          canEdit={canEditRoles}
          onSaved={list.refreshRoles}
          onError={showError}
        />
      )}

      <UserFormDrawer
        open={drawerOpen}
        user={editing}
        roles={list.roles}
        currentUserId={access?.userId ?? null}
        confirmRoleChange={confirmRoleChange}
        onClose={() => setDrawerOpen(false)}
        onSaved={list.refresh}
      />

      <ConfirmDialog
        open={Boolean(deactivating)}
        title={t('deactivate.title')}
        description={t.rich('deactivate.description', {
          name: `${deactivating?.firstName ?? ''} ${deactivating?.lastName ?? ''}`.trim(),
          strong: (chunks) => <strong>{chunks}</strong>,
        })}
        confirmLabel={t('deactivate.confirm')}
        loading={isDeactivatingBusy}
        onConfirm={handleDeactivate}
        onClose={() => setDeactivating(null)}
      />

      <ConfirmDialog
        open={Boolean(roleChange)}
        severity="warning"
        title={t('roleChange.title')}
        description={
          <Stack spacing={1}>
            <span>
              {t.rich('roleChange.description', {
                name: `${roleChange?.user.firstName ?? ''} ${roleChange?.user.lastName ?? ''}`.trim(),
                from: roleChange?.from.name ?? '',
                to: roleChange?.to.name ?? '',
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </span>
            {roleChange && roleChange.lostModules.length > 0 && (
              <span>
                {t('roleChange.losing', {
                  modules: roleChange.lostModules
                    .map((module) => tRoles(`modules.${module}`))
                    .join(', '),
                })}
              </span>
            )}
          </Stack>
        }
        onConfirm={() => resolveRoleChange(true)}
        onClose={() => resolveRoleChange(false)}
      />
    </Stack>
  );
}

type RolesPanelProps = {
  roles: RoleListItem[];
  canEdit: boolean;
  onSaved: () => void;
  onError: (key: string) => void;
};

/**
 * Lista de papéis + matriz módulo x ação. A matriz trabalha sobre um rascunho
 * local: marcar caixas não deve disparar uma escrita por clique.
 */
function RolesPanel({ roles, canEdit, onSaved, onError }: RolesPanelProps) {
  const tRoles = useTranslations('Roles');
  const tCommon = useTranslations('Common');
  const { enqueueSnackbar } = useSnackbar();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const selected = roles.find((role) => role.id === selectedId) ?? roles[0] ?? null;

  // O rascunho segue o papel selecionado; recarregar a lista depois de salvar
  // também traz o estado de volta para o que o banco confirmou.
  const draftKey = `${selected?.id ?? ''}:${selected?.permissionCodes.join(',') ?? ''}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  if (selected && loadedKey !== draftKey) {
    setLoadedKey(draftKey);
    setDraft(selected.permissionCodes);
  }

  const granted = useMemo(() => new Set(draft), [draft]);
  const readOnly = !selected || selected.isSystem || !canEdit;

  const toggle = (code: string) => {
    setDraft((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code]
    );
  };

  const handleSave = async () => {
    if (!selected) {
      return;
    }

    setIsSaving(true);

    try {
      const result = await updateRolePermissions(selected.id, draft);

      if (!result.ok) {
        onError(result.error);
        return;
      }

      enqueueSnackbar(tRoles('toast.updated'), { variant: 'success' });
      onSaved();
    } finally {
      setIsSaving(false);
    }
  };

  if (roles.length === 0) {
    return (
      <Paper variant="outlined" sx={{ borderRadius: 2, py: 6 }}>
        <EmptyState icon="mdi:shield-account-outline" title={tRoles('empty')} size="compact" />
      </Paper>
    );
  }

  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ alignItems: 'flex-start' }}>
      <Stack spacing={1.5} sx={{ width: { xs: 1, md: 320 }, flexShrink: 0 }}>
        {roles.map((role) => (
          <Paper
            key={role.id}
            variant="outlined"
            onClick={() => setSelectedId(role.id)}
            sx={{
              p: 2,
              borderRadius: 2,
              cursor: 'pointer',
              borderColor: role.id === selected?.id ? 'primary.main' : undefined,
              bgcolor: (theme) =>
                role.id === selected?.id ? alpha(theme.palette.primary.main, 0.06) : undefined,
            }}
          >
            <Stack spacing={0.75}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1, minWidth: 0 }} noWrap>
                  {role.name}
                </Typography>
                {role.isSystem && (
                  <Chip label={tRoles('system')} size="small" variant="outlined" />
                )}
              </Stack>

              <Typography variant="body2" color="text.secondary">
                {role.description ?? tCommon('none')}
              </Typography>

              <Typography variant="caption" color="text.secondary">
                {tRoles('users', { count: role.userCount })}
              </Typography>
            </Stack>
          </Paper>
        ))}
      </Stack>

      <Paper variant="outlined" sx={{ borderRadius: 2, flex: 1, width: 1, overflow: 'hidden' }}>
        <Stack
          direction="row"
          spacing={2}
          sx={{ alignItems: 'center', justifyContent: 'space-between', px: 2.5, py: 2 }}
        >
          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {tRoles('matrix')}
            </Typography>
            {selected?.isSystem && (
              <Typography variant="caption" color="text.secondary">
                {tRoles('systemHint')}
              </Typography>
            )}
          </Stack>

          <Tooltip title={canEdit ? '' : tCommon('noPermission')}>
            <span>
              <Button
                variant="contained"
                size="small"
                disabled={readOnly}
                loading={isSaving}
                onClick={handleSave}
              >
                {tCommon('save')}
              </Button>
            </span>
          </Tooltip>
        </Stack>

        <Divider />

        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>{tRoles('module')}</TableCell>
                {PERMISSION_ACTIONS.map((permissionAction) => (
                  <TableCell key={permissionAction} align="center" sx={{ fontWeight: 700 }}>
                    {tRoles(`actions.${permissionAction}`)}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {PERMISSION_MODULES.map((module) => (
                <TableRow key={module} hover>
                  <TableCell>{tRoles(`modules.${module}`)}</TableCell>

                  {PERMISSION_ACTIONS.map((permissionAction) => {
                    // Célula vazia onde a ação não existe no módulo — marcar
                    // "excluir estoque" não significaria nada no servidor.
                    if (!MODULE_ACTIONS[module].includes(permissionAction)) {
                      return <TableCell key={permissionAction} align="center" />;
                    }

                    const code = `${module}.${permissionAction}`;

                    return (
                      <TableCell key={permissionAction} align="center" sx={{ py: 0 }}>
                        <Checkbox
                          size="small"
                          checked={granted.has(code)}
                          disabled={readOnly}
                          onChange={() => toggle(code)}
                        />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Paper>
    </Stack>
  );
}
