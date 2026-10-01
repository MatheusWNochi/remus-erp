'use client';

import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useSnackbar } from 'notistack';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { FormDrawer } from '@/components/form-drawer';
import { isValidDocument, maskDocument, maskPhone, maskZipCode } from '@/utils/document';
import { createCustomer, updateCustomer } from '../actions';
import type { CustomerDetail } from '../types';

type FormValues = {
  name: string;
  personType: 'INDIVIDUAL' | 'COMPANY';
  document: string;
  email: string;
  phone: string;
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  notes: string;
  status: 'ACTIVE' | 'INACTIVE';
};

const EMPTY_VALUES: FormValues = {
  name: '',
  personType: 'COMPANY',
  document: '',
  email: '',
  phone: '',
  zipCode: '',
  street: '',
  number: '',
  complement: '',
  district: '',
  city: '',
  state: '',
  notes: '',
  status: 'ACTIVE',
};

type Props = {
  open: boolean;
  customer?: CustomerDetail | null;
  onClose: () => void;
  onSaved: () => void;
};

export function CustomerFormDrawer({ open, customer, onClose, onSaved }: Props) {
  const t = useTranslations('Customers');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const { enqueueSnackbar } = useSnackbar();

  const isEdit = Boolean(customer);

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
      customer
        ? {
            name: customer.name,
            personType: customer.personType,
            document: customer.document ?? '',
            email: customer.email ?? '',
            phone: customer.phone ?? '',
            zipCode: customer.zipCode ?? '',
            street: customer.street ?? '',
            number: customer.number ?? '',
            complement: customer.complement ?? '',
            district: customer.district ?? '',
            city: customer.city ?? '',
            state: customer.state ?? '',
            notes: customer.notes ?? '',
            status: customer.status,
          }
        : EMPTY_VALUES
    );
  }, [open, customer, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const result = customer
      ? await updateCustomer(customer.id, values)
      : await createCustomer(values);

    if (result.ok) {
      enqueueSnackbar(t(customer ? 'toast.updated' : 'toast.created'), { variant: 'success' });
      onSaved();
      onClose();
      return;
    }

    // `duplicate` só pode vir do índice único de documento por empresa, então
    // aponta direto para o campo em vez de virar um toast genérico.
    if (result.error === 'duplicate') {
      setError('document', { message: t('errors.document') });
      return;
    }

    // Validação do servidor: marca cada campo recusado com a mensagem do
    // próprio módulo.
    if (result.fieldErrors) {
      for (const [field, key] of Object.entries(result.fieldErrors)) {
        setError(field as keyof FormValues, { message: t(`errors.${key}` as never) });
      }
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
      width={520}
    >
      <Stack spacing={3}>
        <Stack spacing={2}>
          <Typography variant="overline" color="text.secondary">
            {t('sections.identification')}
          </Typography>

          <Controller
            name="name"
            control={control}
            rules={{ required: t('errors.name') }}
            render={({ field }) => (
              <TextField
                {...field}
                label={t('fields.name')}
                error={!!errors.name}
                helperText={errors.name?.message}
                fullWidth
                autoFocus
              />
            )}
          />

          <Stack direction="row" spacing={2}>
            <Controller
              name="personType"
              control={control}
              render={({ field }) => (
                <TextField {...field} select label={t('fields.personType')} sx={{ flex: 1 }}>
                  <MenuItem value="COMPANY">{t('personType.COMPANY')}</MenuItem>
                  <MenuItem value="INDIVIDUAL">{t('personType.INDIVIDUAL')}</MenuItem>
                </TextField>
              )}
            />

            <Controller
              name="document"
              control={control}
              rules={{
                // Mesma regra do schema no servidor, só que sem a ida e volta:
                // o usuário vê o erro assim que sai do campo.
                validate: (value) => !value || isValidDocument(value) || t('errors.document'),
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  onChange={(event) => field.onChange(maskDocument(event.target.value))}
                  label={t('fields.document')}
                  error={!!errors.document}
                  helperText={errors.document?.message}
                  sx={{ flex: 1 }}
                />
              )}
            />
          </Stack>

          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <TextField {...field} select label={t('fields.status')} fullWidth>
                <MenuItem value="ACTIVE">{t('status.ACTIVE')}</MenuItem>
                <MenuItem value="INACTIVE">{t('status.INACTIVE')}</MenuItem>
              </TextField>
            )}
          />
        </Stack>

        <Stack spacing={2}>
          <Typography variant="overline" color="text.secondary">
            {t('sections.contact')}
          </Typography>

          <Controller
            name="email"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                type="email"
                label={t('fields.email')}
                error={!!errors.email}
                helperText={errors.email?.message}
                fullWidth
              />
            )}
          />

          <Controller
            name="phone"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                onChange={(event) => field.onChange(maskPhone(event.target.value))}
                label={t('fields.phone')}
                fullWidth
              />
            )}
          />
        </Stack>

        <Stack spacing={2}>
          <Typography variant="overline" color="text.secondary">
            {t('sections.address')}
          </Typography>

          <Stack direction="row" spacing={2}>
            <Controller
              name="zipCode"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  onChange={(event) => field.onChange(maskZipCode(event.target.value))}
                  label={t('fields.zipCode')}
                  sx={{ width: 160 }}
                />
              )}
            />

            <Controller
              name="street"
              control={control}
              render={({ field }) => (
                <TextField {...field} label={t('fields.street')} sx={{ flex: 1 }} />
              )}
            />
          </Stack>

          <Stack direction="row" spacing={2}>
            <Controller
              name="number"
              control={control}
              render={({ field }) => (
                <TextField {...field} label={t('fields.number')} sx={{ width: 140 }} />
              )}
            />

            <Controller
              name="complement"
              control={control}
              render={({ field }) => (
                <TextField {...field} label={t('fields.complement')} sx={{ flex: 1 }} />
              )}
            />
          </Stack>

          <Controller
            name="district"
            control={control}
            render={({ field }) => (
              <TextField {...field} label={t('fields.district')} fullWidth />
            )}
          />

          <Stack direction="row" spacing={2}>
            <Controller
              name="city"
              control={control}
              render={({ field }) => (
                <TextField {...field} label={t('fields.city')} sx={{ flex: 1 }} />
              )}
            />

            <Controller
              name="state"
              control={control}
              rules={{
                validate: (value) => !value || value.trim().length === 2 || t('errors.state'),
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  onChange={(event) =>
                    field.onChange(event.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))
                  }
                  label={t('fields.state')}
                  error={!!errors.state}
                  helperText={errors.state?.message}
                  sx={{ width: 100 }}
                />
              )}
            />
          </Stack>
        </Stack>

        <Stack spacing={2}>
          <Typography variant="overline" color="text.secondary">
            {t('sections.extra')}
          </Typography>

          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label={t('fields.notes')}
                multiline
                minRows={3}
                fullWidth
                placeholder={tCommon('none')}
              />
            )}
          />
        </Stack>
      </Stack>
    </FormDrawer>
  );
}
