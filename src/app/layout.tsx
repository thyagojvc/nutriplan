import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Fraunces, Poppins } from 'next/font/google'
import Script from 'next/script'
import { AuthListener } from './auth-listener'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  weight: ['700', '900'],
})

// Teste local: mesma fonte usada nas páginas de venda do Ricardo Maxxima
// (confirmado via DevTools). Escopado só na /preview via classe font-poppins.
const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'NutriPlan — Tu plan nutricional personalizado',
  description:
    'Plan nutricional de 7 días personalizado con IA. Disponible para México, Colombia, Chile y España.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'NutriPlan',
  },
  icons: {
    icon: '/Logo Clara NutriPlan.png',
    apple: '/Logo Clara NutriPlan.png',
  },
  other: {
    'facebook-domain-verification': 'xgjk9bxl61cb1p1ngmsq295whvaf8e',
  },
}

export const viewport: Viewport = {
  themeColor: '#226c45',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <head>
        {/* Abre conexão cedo com os domínios externos usados na página (fotos dos
            alimentos + pixel), reduzindo o tempo de handshake TLS na hora do fetch. */}
        <link rel="preconnect" href="https://spoonacular.com" />
        <link rel="preconnect" href="https://images.pexels.com" />
        <link rel="preconnect" href="https://connect.facebook.net" />
        <link rel="dns-prefetch" href="https://spoonacular.com" />
        <link rel="dns-prefetch" href="https://images.pexels.com" />
        <link rel="dns-prefetch" href="https://connect.facebook.net" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${poppins.variable} antialiased`}
      >
        <AuthListener />
        {children}
        {process.env.NODE_ENV === 'production' ? (
          <Script id="facebook-pixel" strategy="afterInteractive">{`
            !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
            n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
            document,'script','https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '931028066102655');
            fbq('track', 'PageView');
          `}</Script>
        ) : null}
      </body>
    </html>
  )
}
