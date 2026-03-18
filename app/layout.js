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
  title: 'YardSync',
  description: 'Lawn care management for professionals',
  manifest: '/manifest.json',
  themeColor: '#0F6E56',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'YardSync',
  },
  formatDetection: { telephone: false },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmSerif.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
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