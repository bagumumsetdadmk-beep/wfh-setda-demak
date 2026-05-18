import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { Metadata } from 'next';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: 'E-WFH Setda Demak',
  description: 'Sistem Informasi Work From Home ASN Sekretariat Daerah Demak',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="bg-slate-50 text-slate-900 min-h-screen font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
