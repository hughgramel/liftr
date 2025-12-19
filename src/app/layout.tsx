import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import PWAInstaller from '@/components/PWAInstaller'

const dmSans = localFont({
  variable: '--font-dm-sans',
  display: 'swap',
  src: [
    { path: '../assets/fonts/dm-sans/dm-sans-latin-100-normal.woff2', weight: '100', style: 'normal' },
    { path: '../assets/fonts/dm-sans/dm-sans-latin-100-italic.woff2', weight: '100', style: 'italic' },
    { path: '../assets/fonts/dm-sans/dm-sans-latin-200-normal.woff2', weight: '200', style: 'normal' },
    { path: '../assets/fonts/dm-sans/dm-sans-latin-200-italic.woff2', weight: '200', style: 'italic' },
    { path: '../assets/fonts/dm-sans/dm-sans-latin-300-normal.woff2', weight: '300', style: 'normal' },
    { path: '../assets/fonts/dm-sans/dm-sans-latin-300-italic.woff2', weight: '300', style: 'italic' },
    { path: '../assets/fonts/dm-sans/dm-sans-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../assets/fonts/dm-sans/dm-sans-latin-400-italic.woff2', weight: '400', style: 'italic' },
    { path: '../assets/fonts/dm-sans/dm-sans-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../assets/fonts/dm-sans/dm-sans-latin-500-italic.woff2', weight: '500', style: 'italic' },
    { path: '../assets/fonts/dm-sans/dm-sans-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: '../assets/fonts/dm-sans/dm-sans-latin-600-italic.woff2', weight: '600', style: 'italic' },
    { path: '../assets/fonts/dm-sans/dm-sans-latin-700-normal.woff2', weight: '700', style: 'normal' },
    { path: '../assets/fonts/dm-sans/dm-sans-latin-700-italic.woff2', weight: '700', style: 'italic' },
    { path: '../assets/fonts/dm-sans/dm-sans-latin-800-normal.woff2', weight: '800', style: 'normal' },
    { path: '../assets/fonts/dm-sans/dm-sans-latin-800-italic.woff2', weight: '800', style: 'italic' },
    { path: '../assets/fonts/dm-sans/dm-sans-latin-900-normal.woff2', weight: '900', style: 'normal' },
    { path: '../assets/fonts/dm-sans/dm-sans-latin-900-italic.woff2', weight: '900', style: 'italic' },
  ],
})

export const metadata: Metadata = {
  title: 'LiftR',
  description: 'Track your lifting workouts',
  keywords: ['workout', 'lifting', 'gym', 'fitness', 'tracker'],
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'LiftR',
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#ffffff" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className={`${dmSans.variable} antialiased`} suppressHydrationWarning>
        <PWAInstaller />
        {children}
      </body>
    </html>
  )
}
