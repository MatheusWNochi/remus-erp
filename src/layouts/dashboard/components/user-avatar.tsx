import Avatar from '@mui/material/Avatar';
import type { AvatarProps } from '@mui/material/Avatar';

type Props = AvatarProps & {
  firstName?: string | null;
  lastName?: string | null;
};

export function UserAvatar({ firstName, lastName, sx, ...other }: Props) {
  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <Avatar
      sx={{
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        fontSize: 14,
        fontWeight: 600,
        ...sx,
      }}
      {...other}
    >
      {initials || '?'}
    </Avatar>
  );
}
