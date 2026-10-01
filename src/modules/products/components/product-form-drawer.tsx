'use client';

import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useLocale, useTranslations } from 'next-intl';
import { useSnackbar } from 'notistack';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { FormDrawer } from '@/components/form-drawer';
import { formatPercent } from '@/utils/format';
import { createCategory, createProduct, listCategories, updateProduct } from '../actions';
import type { ProductCategoryOption, ProductDetail } from '../types';

type FormValues = {
  name: string;
  sku: string;
  categoryId: string;
  unit: string;
  costPrice: string;
  salePrice: string;
  minStock: string;
  maxStock: string;
  description: string;
  status: 'ACTIVE' | 'INACTIVE';
};

const EMPTY_VALUES: FormValues = {
  name: '',
  sku: '',
  categoryId: '',
  unit: 'UN',
  costPrice: '0',
  salePrice: '0',
  minStock: '0',
  maxStock: '',
  description: '',
  status: 'ACTIVE',
};

/** Opção "criar categoria" injetada na lista; `inputValue` a distingue. */
type CategoryOption = ProductCategoryOption & { inputValue?: string };

const filterCategories = createFilterOptions<CategoryOption>();

function toNumberValue(value: string): number {
  const parsed = Number(value.replace(',', '.').trim());

  return Number.isFinite(parsed) ? parsed : 0;
}

/** SKU sugerido a partir do nome: sem acento, maiúsculo e com hífen. */
function slugifySku(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

type Props = {
  open: boolean;
  product?: ProductDetail | null;
  onClose: () => void;
  onSaved: () => void;
};

export function ProductFormDrawer({ open, product, onClose, onSaved }: Props) {
  const t = useTranslations('Products');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const locale = useLocale();
  const { enqueueSnackbar } = useSnackbar();

  const isEdit = Boolean(product);

  const [categories, setCategories] = useState<ProductCategoryOption[]>([]);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: EMPTY_VALUES });

  const costPrice = useWatch({ control, name: 'costPrice' });
  const salePrice = useWatch({ control, name: 'salePrice' });
  const categoryId = useWatch({ control, name: 'categoryId' });

  const sale = toNumberValue(salePrice);
  const margin = sale > 0 ? (sale - toNumberValue(costPrice)) / sale : 0;

  // Recarrega a cada abertura: uma categoria criada em outra aba do ERP
  // precisa aparecer aqui sem exigir refresh da página.
  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;

    void (async () => {
      const result = await listCategories();

      if (active && result.ok) {
        setCategories(result.data);
      }
    })();

    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    reset(
      product
        ? {
            name: product.name,
            sku: product.sku,
            categoryId: product.categoryId ?? '',
            unit: product.unit,
            costPrice: String(product.costPrice),
            salePrice: String(product.salePrice),
            minStock: String(product.minStock),
            maxStock: product.maxStock === null ? '' : String(product.maxStock),
            description: product.description ?? '',
            status: product.status,
          }
        : EMPTY_VALUES
    );
  }, [open, product, reset]);

  const handleGenerateSku = () => {
    setValue('sku', slugifySku(getValues('name')), { shouldValidate: true });
  };

  const handleCreateCategory = async (name: string) => {
    const result = await createCategory({ name });

    if (!result.ok) {
      enqueueSnackbar(tErrors(result.error), { variant: 'error' });
      return;
    }

    setCategories((current) =>
      current.some((item) => item.id === result.data.id) ? current : [...current, result.data]
    );
    setValue('categoryId', result.data.id, { shouldDirty: true });
    enqueueSnackbar(t('categoryCreated'), { variant: 'success' });
  };

  const onSubmit = handleSubmit(async (values) => {
    const result = product ? await updateProduct(product.id, values) : await createProduct(values);

    if (result.ok) {
      enqueueSnackbar(t(product ? 'toast.updated' : 'toast.created'), { variant: 'success' });
      onSaved();
      onClose();
      return;
    }

    // `duplicate` só pode vir do índice único de SKU por empresa, então aponta
    // direto para o campo em vez de virar um toast genérico.
    if (result.error === 'duplicate') {
      setError('sku', { message: t('errors.skuDuplicate') });
      return;
    }

    enqueueSnackbar(tErrors(result.error), { variant: 'error' });
  });

  const selectedCategory = categories.find((item) => item.id === categoryId) ?? null;

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

          <Controller
            name="sku"
            control={control}
            rules={{ required: t('errors.sku') }}
            render={({ field }) => (
              <TextField
                {...field}
                onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                label={t('fields.sku')}
                error={!!errors.sku}
                helperText={errors.sku?.message}
                fullWidth
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <Button size="small" onClick={handleGenerateSku}>
                          {t('generateSku')}
                        </Button>
                      </InputAdornment>
                    ),
                  },
                }}
              />
            )}
          />

          <Stack direction="row" spacing={2}>
            <Autocomplete<CategoryOption, false, false, false>
              options={categories}
              value={selectedCategory}
              onChange={(_event, option) => {
                if (option?.inputValue) {
                  void handleCreateCategory(option.inputValue);
                  return;
                }

                setValue('categoryId', option?.id ?? '', { shouldDirty: true });
              }}
              filterOptions={(options, state) => {
                const filtered = filterCategories(options, state);
                const typed = state.inputValue.trim();

                // A categoria nasce aqui mesmo: obrigar o usuário a sair para
                // outra tela só para cadastrar "Bebidas" quebraria o fluxo.
                if (
                  typed &&
                  !options.some((option) => option.name.toLowerCase() === typed.toLowerCase())
                ) {
                  filtered.push({ id: '', name: typed, inputValue: typed });
                }

                return filtered;
              }}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderOption={(props, option) => {
                const { key, ...rest } = props;

                return (
                  <li key={key} {...rest}>
                    {option.inputValue ? t('newCategory', { name: option.inputValue }) : option.name}
                  </li>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('fields.category')}
                  placeholder={t('noCategory')}
                />
              )}
              sx={{ flex: 1 }}
            />

            <Controller
              name="unit"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                  label={t('fields.unit')}
                  sx={{ width: 120 }}
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
            {t('sections.pricing')}
          </Typography>

          <Stack direction="row" spacing={2}>
            <Controller
              name="costPrice"
              control={control}
              rules={{ validate: (value) => toNumberValue(value) >= 0 || t('errors.price') }}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="number"
                  label={t('fields.costPrice')}
                  error={!!errors.costPrice}
                  helperText={errors.costPrice?.message}
                  sx={{ flex: 1 }}
                />
              )}
            />

            <Controller
              name="salePrice"
              control={control}
              rules={{ validate: (value) => toNumberValue(value) >= 0 || t('errors.price') }}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="number"
                  label={t('fields.salePrice')}
                  error={!!errors.salePrice}
                  helperText={errors.salePrice?.message}
                  sx={{ flex: 1 }}
                />
              )}
            />
          </Stack>

          <Typography variant="caption" color={margin < 0 ? 'error.main' : 'text.secondary'}>
            {t('marginHint', { value: formatPercent(margin, locale) })}
          </Typography>
        </Stack>

        <Stack spacing={2}>
          <Typography variant="overline" color="text.secondary">
            {t('sections.stock')}
          </Typography>

          <Stack direction="row" spacing={2}>
            <Controller
              name="minStock"
              control={control}
              rules={{ validate: (value) => toNumberValue(value) >= 0 || t('errors.price') }}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="number"
                  label={t('fields.minStock')}
                  error={!!errors.minStock}
                  helperText={errors.minStock?.message}
                  sx={{ flex: 1 }}
                />
              )}
            />

            <Controller
              name="maxStock"
              control={control}
              rules={{
                validate: (value) => {
                  if (value.trim() === '') {
                    return true;
                  }

                  if (toNumberValue(value) < 0) {
                    return t('errors.price');
                  }

                  return (
                    toNumberValue(value) > toNumberValue(getValues('minStock')) ||
                    t('errors.maxStock')
                  );
                },
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="number"
                  label={t('fields.maxStock')}
                  error={!!errors.maxStock}
                  helperText={errors.maxStock?.message}
                  placeholder={tCommon('none')}
                  sx={{ flex: 1 }}
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
            name="description"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label={t('fields.description')}
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
