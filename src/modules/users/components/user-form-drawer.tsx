'use client';

import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useSnackbar } from 'notistack';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';

import { FormDrawer } from '@/components/form-drawer';
import { createUser, updateUser } from '../actions';
import type { RoleListItem, UserListItem } from '../types';

type FormValues = {
  firstName: string;
  lastName: string;
  email: string;
  roleId: string;
  password: string;
};

const EMPTY_VALUES: FormValues = {
  firstName: '',
  lastName: '',
  email: '',
  roleId: '',
  password: '',
};

type Props = {
  open: boolean;
  user?: UserListItem | null;
  /** Vem do `listRoles()` da tela — o mesmo que alimenta filtro e matriz. */
  roles: RoleListItem[];
  currentUserId: string | null;
  /** Resolve `false` quando a tela decide abortar o rebaixamento de papel. */
  confirmRoleChange: (user: UserListItem, nextRoleId: string) => Promise<boolean>;
  onClose: () => void;
  onSaved: () => void;
};

export function UserFormDrawer({
  open,
  user,
  roles,
  currentUserId,
  confirmRoleChange,
  onClose,
  onSaved,
}: Props) {
  const t = useTranslations('Users');
  const tErrors = useTranslations('Errors');
  const { enqueueSnackbar } = useSnackbar();

  const isEdit = Boolean(user);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: EMPTY_VALUES });

  useEffect(() => {
    if (!open) {
      return;
    }

    reset(
      user
        ? {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            roleId: user.roleId,
            password: '',
          }
        : EMPTY_VALUES
    );
  }, [open, user, reset]);

  const isSelf = Boolean(user && currentUserId && user.id === currentUserId);

  const onSubmit = handleSubmit(async (values) => {
    if (user && values.roleId !== user.roleId && !(await confirmRoleChange(user, values.roleId))) {
      return;
    }

    const result = user
      ? await updateUser(user.id, {
          firstName: values.firstName,
          lastName: values.lastName,
          roleId: values.roleId,
        })
      : await createUser(values);

    if (result.ok) {
      enqueueSnackbar(t(user ? 'toast.updated' : 'toast.created'), { variant: 'success' });
      onSaved();
      onClose();
      return;
    }

    // E-mail duplicado tem campo próprio na tela; vira erro inline em vez de
    // um toast que some sem dizer onde está o problema.
    if (result.error === 'emailTaken') {
      setError('email', { message: t('errors.emailTaken') });
      return;
    }

    if (result.error === 'selfRoleChange') {
      setError('roleId', { message: t('errors.selfRoleChange') });
      return;
    }

    enqueueSnackbar(tErrors(result.error), { variant: 'error' });
  });

  return (
    <FormDrawer
      open={open}
      title={isEdit ? t('edit') : t('new')}
      subtitle={isEdit ? t('editSubtitle') : t('newSubtitle')}
      submitting={isSubmitting}
      onClose={onClose}
      onSubmit={onSubmit}
      width={480}
    >
      <Stack spacing={2.5}>
        <Stack direction="row" spacing={2}>
          <Controller
            name="firstName"
            control={control}
            rules={{ required: t('errors.firstName') }}
            render={({ field }) => (
              <TextField
                {...field}
                label={t('fields.firstName')}
                error={!!errors.firstName}
                helperText={errors.firstName?.message}
                sx={{ flex: 1 }}
                autoFocus
              />
            )}
          />

          <Controller
            name="lastName"
            control={control}
            rules={{ required: t('errors.lastName') }}
            render={({ field }) => (
              <TextField
                {...field}
                label={t('fields.lastName')}
                error={!!errors.lastName}
                helperText={errors.lastName?.message}
                sx={{ flex: 1 }}
              />
            )}
          />
        </Stack>

        <Controller
          name="email"
          control={control}
          rules={{
            required: t('errors.email'),
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: t('errors.email') },
          }}
          render={({ field }) => (
            <TextField
              {...field}
              type="email"
              label={t('fields.email')}
              error={!!errors.email}
              helperText={errors.email?.message}
              // O e-mail é a identidade do login: mudá-lo seria trocar de
              // conta, não editar esta.
              disabled={isEdit}
              fullWidth
            />
          )}
        />

        <Controller
          name="roleId"
          control={control}
          rules={{ required: t('errors.role') }}
          render={({ field }) => (
            <TextField
              {...field}
              select
              label={t('fields.role')}
              error={!!errors.roleId}
              // O servidor recusa de qualquer forma; travar aqui evita o
              // usuário descobrir só depois de salvar.
              disabled={isSelf}
              helperText={errors.roleId?.message ?? (isSelf ? t('errors.selfRoleChange') : undefined)}
              fullWidth
            >
              {roles.map((role) => (
                <MenuItem key={role.id} value={role.id}>
                  {role.name}
                </MenuItem>
              ))}
            </TextField>
          )}
        />

        {!isEdit && (
          <Controller
            name="password"
            control={control}
            rules={{
              required: t('errors.password'),
              minLength: { value: 8, message: t('errors.password') },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                type="password"
                label={t('fields.password')}
                error={!!errors.password}
                helperText={errors.password?.message ?? t('passwordHint')}
                fullWidth
              />
            )}
          />
        )}
      </Stack>
    </FormDrawer>
  );
}
