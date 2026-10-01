'use client';

import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useLocale, useTranslations } from 'next-intl';
import { useSnackbar } from 'notistack';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import { FormDrawer } from '@/components/form-drawer';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { formatNumber } from '@/utils/format';
import { createMovement, getProductBalance, searchProducts } from '../actions';
import type { MovementType, ProductOption } from '../types';

type FormValues = {
  product: ProductOption | null;
  type: MovementType;
  /** Texto cru do campo: vírgula decimal é o normal em pt-BR. */
  quantity: string;
  reason: string;
  reference: string;
};

const EMPTY_VALUES: FormValues = {
  product: null,
  type: 'IN',
  quantity: '',
  reason: '',
  reference: '',
};

const MOVEMENT_TYPES: MovementType[] = ['IN', 'OUT', 'ADJUSTMENT'];

function parseQuantity(value: string): number {
  return Number(value.trim().replace(',', '.'));
}

type Props = {
  open: boolean;
  /** Pré-seleção vinda do alerta de estoque baixo ou do painel do produto. */
  product?: ProductOption | null;
  defaultType?: MovementType;
  onClose: () => void;
  onSaved: () => void;
};

export function MovementFormDrawer({
  open,
  product,
  defaultType = 'IN',
  onClose,
  onSaved,
}: Props) {
  const t = useTranslations('Inventory');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const locale = useLocale();
  const { enqueueSnackbar } = useSnackbar();

  const [term, setTerm] = useState('');
  /**
   * O resultado da busca guarda junto o termo que o produziu, então
   * `isSearching` é derivado em vez de ligado/desligado dentro do efeito.
   * `options` nulo significa "ainda não buscou nesta sessão".
   */
  const [searched, setSearched] = useState<{
    term: string;
    options: ProductOption[] | null;
  } | null>(null);
  const [loadedBalance, setLoadedBalance] = useState<number | null>(null);

  const debouncedTerm = useDebouncedValue(term);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: EMPTY_VALUES });

  const selectedProduct = useWatch({ control, name: 'product' });
  const type = useWatch({ control, name: 'type' });
  const quantity = useWatch({ control, name: 'quantity' });

  /**
   * Abrir a gaveta (ou abrir com outra pré-seleção) começa uma sessão nova.
   * Zerar a busca e o saldo é derivar estado de props, não sincronizar com um
   * sistema externo, então o ajuste acontece em tempo de render — padrão do
   * próprio React — e não dentro de um efeito.
   */
  const session = open ? `${product?.id ?? ''}|${defaultType}` : null;
  const [currentSession, setCurrentSession] = useState(session);

  if (session !== currentSession) {
    setCurrentSession(session);

    if (session !== null) {
      setTerm('');
      setSearched(null);
      setLoadedBalance(null);
    }
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    reset({ ...EMPTY_VALUES, product: product ?? null, type: defaultType });
  }, [open, product, defaultType, reset]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;

    void (async () => {
      const result = await searchProducts(debouncedTerm);

      if (!active) {
        return;
      }

      // Busca que falha mantém a lista anterior na tela, igual ao que já
      // acontecia — só o indicador de carregando precisa sair.
      setSearched((current) => ({
        term: debouncedTerm,
        options: result.ok ? result.data : (current?.options ?? null),
      }));
    })();

    return () => {
      active = false;
    };
  }, [open, debouncedTerm]);

  // O saldo vem do servidor a cada troca de produto: é a mesma conta que a
  // action refaz na gravação, então o usuário vê de antemão o que vai barrar.
  useEffect(() => {
    if (!open || !selectedProduct) {
      return;
    }

    let active = true;

    void (async () => {
      const result = await getProductBalance(selectedProduct.id);

      if (active) {
        setLoadedBalance(result.ok ? result.data.quantity : null);
      }
    })();

    return () => {
      active = false;
    };
  }, [open, selectedProduct]);

  // Antes da primeira busca da sessão a lista traz só a pré-seleção, para o
  // Autocomplete conseguir rotular o produto que já veio escolhido.
  const fallbackOptions = useMemo(() => (product ? [product] : []), [product]);
  const options = searched?.options ?? fallbackOptions;
  const isSearching = open && searched?.term !== debouncedTerm;
  const balance = open && selectedProduct ? loadedBalance : null;

  const resultingBalance = useMemo(() => {
    if (balance === null) {
      return null;
    }

    const parsed = parseQuantity(quantity);

    if (!Number.isFinite(parsed) || quantity.trim() === '') {
      return balance;
    }

    return balance + (type === 'OUT' ? -parsed : parsed);
  }, [balance, quantity, type]);

  const onSubmit = handleSubmit(async (values) => {
    if (!values.product) {
      setError('product', { message: t('errors.product') });
      return;
    }

    const result = await createMovement({
      productId: values.product.id,
      type: values.type,
      quantity: parseQuantity(values.quantity),
      reason: values.reason,
      reference: values.reference,
    });

    if (result.ok) {
      enqueueSnackbar(t('toast.created'), { variant: 'success' });
      onSaved();
      onClose();
      return;
    }

    // O saldo disponível só faz sentido junto do campo que o estourou, então
    // o erro vira mensagem da quantidade em vez de um toast genérico.
    if (result.error === 'negativeBalance') {
      setError('quantity', {
        message: t('errors.negativeBalance', { balance: formatNumber(balance ?? 0, locale) }),
      });
      return;
    }

    enqueueSnackbar(tErrors(result.error), { variant: 'error' });
  });

  const unit = selectedProduct?.unit ?? '';

  return (
    <FormDrawer
      open={open}
      title={t('movement.title')}
      subtitle={t('movement.subtitle')}
      submitLabel={t('movement.submit')}
      submitting={isSubmitting}
      onClose={onClose}
      onSubmit={onSubmit}
      width={520}
    >
      <Stack spacing={3}>
        <Controller
          name="product"
          control={control}
          rules={{ required: t('errors.product') }}
          render={({ field }) => (
            <Autocomplete<ProductOption, false, false, false>
              options={options}
              value={field.value}
              onChange={(_event, value) => field.onChange(value)}
              onInputChange={(_event, value, reason) => {
                if (reason === 'input') {
                  setTerm(value);
                }
              }}
              getOptionLabel={(option) => `${option.name} · ${option.sku}`}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              // A busca já acontece no servidor; filtrar de novo no client
              // esconderia resultados que o backend acabou de devolver.
              filterOptions={(items) => items}
              loading={isSearching}
              noOptionsText={tCommon('noResults')}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('fields.product')}
                  error={!!errors.product}
                  helperText={errors.product?.message}
                  autoFocus
                  slotProps={{
                    ...params.slotProps,
                    input: {
                      ...params.slotProps.input,
                      endAdornment: (
                        <>
                          {isSearching ? <CircularProgress size={18} /> : null}
                          {params.slotProps.input.endAdornment}
                        </>
                      ),
                    },
                  }}
                />
              )}
            />
          )}
        />

        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <Stack spacing={1}>
              <Typography variant="overline" color="text.secondary">
                {t('fields.type')}
              </Typography>
              <ToggleButtonGroup
                exclusive
                fullWidth
                color="primary"
                value={field.value}
                onChange={(_event, value: MovementType | null) => {
                  if (value) {
                    field.onChange(value);
                  }
                }}
              >
                {MOVEMENT_TYPES.map((option) => (
                  <ToggleButton key={option} value={option}>
                    {t(`type.${option}`)}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Stack>
          )}
        />

        {type === 'ADJUSTMENT' && <Alert severity="info">{t('movement.adjustmentHint')}</Alert>}

        <Controller
          name="quantity"
          control={control}
          rules={{
            required: type === 'ADJUSTMENT' ? t('errors.quantity') : t('errors.quantityPositive'),
            validate: (value) => {
              const parsed = parseQuantity(value);

              if (!Number.isFinite(parsed)) {
                return t('errors.quantity');
              }

              if (type === 'ADJUSTMENT') {
                return parsed !== 0 || t('errors.quantity');
              }

              return parsed > 0 || t('errors.quantityPositive');
            },
          }}
          render={({ field }) => (
            <TextField
              {...field}
              label={t('fields.quantity')}
              error={!!errors.quantity}
              helperText={errors.quantity?.message ?? unit}
              fullWidth
            />
          )}
        />

        {balance !== null && (
          <>
            <Divider />
            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary">
                {t('movement.currentBalance', {
                  value: `${formatNumber(balance, locale)} ${unit}`.trim(),
                })}
              </Typography>
              <Typography
                variant="body2"
                sx={{ fontWeight: 600 }}
                color={
                  resultingBalance !== null && resultingBalance < 0 ? 'error.main' : 'text.primary'
                }
              >
                {t('movement.resultingBalance', {
                  value: `${formatNumber(resultingBalance ?? balance, locale)} ${unit}`.trim(),
                })}
              </Typography>
            </Stack>
            <Divider />
          </>
        )}

        <Controller
          name="reason"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label={t('fields.reason')}
              placeholder={t('movement.reasonPlaceholder')}
              multiline
              minRows={2}
              fullWidth
            />
          )}
        />

        <Controller
          name="reference"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label={t('fields.reference')}
              placeholder={t('movement.referencePlaceholder')}
              fullWidth
            />
          )}
        />
      </Stack>
    </FormDrawer>
  );
}
