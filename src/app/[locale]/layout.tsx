import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import ThemeRegistry from "@/lib/ThemeRegistry";
import { SnackbarProvider } from "@/lib/notistack/snackbar-provider";
import { AuthProvider, SessionProvider } from "@/modules/auth/context/provider";
import { SettingsProvider } from "@/modules/settings/context/provider";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/auth/config/next-auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Remus ERP",
  description: "ERP SaaS multi-tenant",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({ children, params }: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const session = await getServerSession(authOptions);

  return (
    <html
      lang={locale}
      // O InitColorSchemeScript do MUI altera a classe do <html> antes da
      // hidratação para aplicar o tema sem piscar, então servidor e cliente
      // divergem de propósito neste nó.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeRegistry>
          <NextIntlClientProvider>
            <SessionProvider refetchInterval={5 * 60} session={session}>
              <AuthProvider>
                <SettingsProvider>
                  <SnackbarProvider>
                    {children}
                  </SnackbarProvider>
                </SettingsProvider>
              </AuthProvider>
            </SessionProvider>
          </NextIntlClientProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
