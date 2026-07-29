'use client';

import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Icon } from '@iconify/react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { GuestGuard } from '../guard/guest-guard';
import { useAuth } from '../hooks/use-auth';
import { loginSchema } from '../actions/schema';

type FieldErrors = {
  email?: string;
  password?: string;
};

function LoginForm() {
  const t = useTranslations('Auth.Login');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useAuth();
  const returnTo = searchParams.get('returnTo') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (key === 'email' || key === 'password') {
          nextErrors[key] = t(`errors.${key}`);
        }
      }
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);

    try {
      const response = await signIn(email, password, returnTo);

      if (!response || response.error) {
        setFormError(t('errors.invalidCredentials'));
        return;
      }

      router.push(returnTo);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack
      component="form"
      onSubmit={handleSubmit}
      spacing={3}
      sx={{ width: 1, maxWidth: 400 }}
    >
      <Stack spacing={1}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          {t('title')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('subtitle')}
        </Typography>
      </Stack>

      {formError && <Alert severity="error">{formError}</Alert>}

      <TextField
        label={t('emailLabel')}
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={!!fieldErrors.email}
        helperText={fieldErrors.email}
        autoComplete="email"
        fullWidth
      />

      <TextField
        label={t('passwordLabel')}
        type={showPassword ? 'text' : 'password'}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={!!fieldErrors.password}
        helperText={fieldErrors.password}
        autoComplete="current-password"
        fullWidth
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPassword((value) => !value)}
                  edge="end"
                  aria-label="toggle password visibility"
                >
                  <Icon
                    icon={showPassword ? 'mdi:eye-off-outline' : 'mdi:eye-outline'}
                    width={20}
                    height={20}
                  />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />

      <Button type="submit" variant="contained" size="large" fullWidth loading={submitting}>
        {t('submit')}
      </Button>
    </Stack>
  );
}

function LoginIllustration() {
  const t = useTranslations('Auth.Login');

  return (
    <Box
      sx={{
        display: { xs: 'none', md: 'flex' },
        position: 'relative',
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        p: 8,
        color: 'primary.contrastText',
        background: (theme) =>
          `linear-gradient(160deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: -96,
          right: -96,
          width: 320,
          height: 320,
          borderRadius: '50%',
          bgcolor: 'rgba(255,255,255,0.08)',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: -72,
          left: -72,
          width: 240,
          height: 240,
          borderRadius: '50%',
          bgcolor: 'rgba(255,255,255,0.08)',
        }}
      />

      <Stack spacing={3} sx={{ maxWidth: 420, zIndex: 1 }}>
        <Icon icon="mdi:cog-outline" width={48} height={48} />
        <Typography variant="h3" sx={{ fontWeight: 700 }}>
          {t('welcomeTitle')}
        </Typography>
        <Typography variant="body1" sx={{ opacity: 0.85 }}>
          {t('welcomeDescription')}
        </Typography>
      </Stack>
    </Box>
  );
}

export function LoginView() {
  return (
    <GuestGuard>
      <Stack direction="row" sx={{ minHeight: '100vh', width: 1 }}>
        <LoginIllustration />

        <Stack
          sx={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            px: { xs: 3, sm: 6 },
            py: 8,
          }}
        >
          <LoginForm />
        </Stack>
      </Stack>
    </GuestGuard>
  );
}
