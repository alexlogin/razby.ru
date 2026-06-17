import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { Header } from '@/components/header';

export const metadata: Metadata = {
  title: 'Razby.ru — разберём стройку на части',
  description:
    'Платформа Razby.ru разбивает строительный проект на этапы, считает материалы по формулам, ' +
    'собирает предложения подрядчиков и поставщиков и помогает сэкономить.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Razby.ru',
};

export const viewport: Viewport = {
  themeColor: '#ea580c',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <AuthProvider>
          <Header />
          <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
