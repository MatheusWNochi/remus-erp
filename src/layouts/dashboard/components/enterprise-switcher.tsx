'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSnackbar } from 'notistack';
import { Icon } from '@iconify/react';
import Button from '@mui/material/Button';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';

import { selectEnterprise } from '@/modules/auth/actions/access';
import { useAccess } from '@/modules/auth/hooks/use-access';

/**
 * Seletor de tenant — visível só para contas `isDeveloper`, que não pertencem
 * a nenhuma empresa. Usuário comum fica preso à própria empresa e nem vê isto.
 */
export function EnterpriseSwitcher() {
  const t = useTranslations('Nav');
  const tErrors = useTranslations('Errors');
  const router = useRouter();
  const { access, refresh } = useAccess();
  const { enqueueSnackbar } = useSnackbar();

  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);

  if (!access?.isDeveloper) {
    return null;
  }

  const handleSelect = async (id: string) => {
    setAnchor(null);

    if (id === access.enterpriseId) {
      return;
    }

    setIsSwitching(true);

    try {
      const result = await selectEnterprise(id);

      if (!result.ok) {
        enqueueSnackbar(tErrors(result.error), { variant: 'error' });
        return;
      }

      await refresh();
      // As telas já carregadas trazem dados do tenant anterior; recarregar
      // evita mostrar a empresa nova com a lista antiga.
      router.refresh();
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <>
      <Button
        onClick={(event) => setAnchor(event.currentTarget)}
        color="inherit"
        size="small"
        loading={isSwitching}
        startIcon={<Icon icon="mdi:domain" width={18} height={18} />}
        endIcon={<Icon icon="mdi:chevron-down" width={18} height={18} />}
        sx={{ textTransform: 'none', fontWeight: 600, maxWidth: 220 }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {access.enterpriseName || t('enterprise')}
        </span>
      </Button>

      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {access.enterprises.length === 0 && (
          <MenuItem disabled>
            <ListItemText>{t('noEnterprises')}</ListItemText>
          </MenuItem>
        )}

        {access.enterprises.map((enterprise) => (
          <MenuItem
            key={enterprise.id}
            selected={enterprise.id === access.enterpriseId}
            onClick={() => handleSelect(enterprise.id)}
          >
            <ListItemIcon>
              <Icon
                icon={enterprise.id === access.enterpriseId ? 'mdi:check' : 'mdi:domain'}
                width={20}
                height={20}
              />
            </ListItemIcon>
            <ListItemText>{enterprise.name}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
