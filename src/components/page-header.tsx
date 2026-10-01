'use client';

import { Icon } from '@iconify/react';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { Link } from '@/i18n/navigation';

export type Crumb = {
  label: string;
  href?: string;
};

type Props = {
  title: string;
  description?: string;
  breadcrumbs?: Crumb[];
  /** Ação primária da tela, alinhada à direita (ex: "Novo cliente"). */
  action?: React.ReactNode;
};

export function PageHeader({ title, description, breadcrumbs, action }: Props) {
  return (
    <Stack spacing={1.5}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs
          separator={<Icon icon="mdi:chevron-right" width={16} height={16} />}
          sx={{ '& .MuiBreadcrumbs-li': { display: 'flex' } }}
        >
          {breadcrumbs.map((crumb) =>
            crumb.href ? (
              <Typography
                key={crumb.label}
                component={Link}
                href={crumb.href}
                variant="body2"
                color="text.secondary"
                sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
              >
                {crumb.label}
              </Typography>
            ) : (
              <Typography key={crumb.label} variant="body2" color="text.primary">
                {crumb.label}
              </Typography>
            )
          )}
        </Breadcrumbs>
      )}

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          {description && (
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          )}
        </Stack>

        {action && <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>{action}</Stack>}
      </Stack>
    </Stack>
  );
}
