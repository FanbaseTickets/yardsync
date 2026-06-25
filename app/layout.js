import { DM_Sans, DM_Serif_Display } from 'next/font/google'
import { AuthProvider } from '@/context/AuthContext'
import { LangProvider } from '@/context/LangContext'
import { Toaster } from 'react-hot-toast'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-display',
  display: 'swap',
})

export const metadata = {
  metadataBase: new URL('https://yardsyncapp.com'),
  title: 'YardSync',
  description: 'Field service management for professionals',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'YardSync',
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    siteName: 'YardSync',
    title: 'YardSync',
    description: 'Field service management for professionals',
    url: 'https://yardsyncapp.com',
    images: [{ url: '/og-social.png', width: 1200, height: 630, alt: 'YardSync' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'YardSync',
    description: 'Field service management for professionals',
    images: ['/og-social.png'],
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0F6E56',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmSerif.variable}`}>
      <head>
        {/* apple-touch-icon + favicon are emitted automatically from
            app/apple-icon.png and app/icon.png (Next.js file conventions). */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="font-sans bg-surface antialiased">
        <AuthProvider>
          <LangProvider>
            {children}
            <Toaster
              position="top-center"
              toastOptions={{
                duration: 3500,
                style: {
                  fontFamily: 'var(--font-sans)',
                  fontSize: '14px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                },
                success: { iconTheme: { primary: '#0F6E56', secondary: '#fff' } },
                error:   { iconTheme: { primary: '#dc2626', secondary: '#fff' } },
              }}
            />
          </LangProvider>
        </AuthProvider>
      </body>
    </html>
  )
}