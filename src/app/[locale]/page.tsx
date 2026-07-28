import { useTranslations } from "next-intl";
import { Icon } from "@iconify/react";
import { Stack, Typography } from "@mui/material";

export default function Home() {
  const t = useTranslations("HomePage");

  return (
    <Stack
      spacing={2}
      sx={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        py: 16,
        px: 4,
      }}
    >
      <Icon icon="mdi:cog-outline" width={48} height={48} color="#1a56db" />
      <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
        {t("title")}
      </Typography>
      <Typography variant="body1" color="text.secondary">
        {t("description")}
      </Typography>
    </Stack>
  );
}
