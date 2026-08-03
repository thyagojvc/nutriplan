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
    title: 'Método CALIBRA',
  },
  icons: {
    icon: '/logo-calibra-transparent.png',
    apple: '/logo-calibra-transparent.png',
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
        {/* Captador de erro JS instalado ANTES do React: se a página crashar na
            hidratação, nenhum useEffect roda, então só um script inline pega.
            Existe pra responder UMA pergunta: o erro vem do NOSSO bundle (bug
            real, hidratação quebrada, ninguém consegue clicar) ou de script
            injetado pelo webview do Instagram (ruído, ignorável)?
            O `@arquivo:linha` vem PRIMEIRO de propósito: a rota trunca a chave,
            e na tentativa de 26/07 o nome do arquivo ficou fora do corte — que
            era justamente a informação que responderia a pergunta.
            Chave de sessão = a mesma de quiz-session-client.ts; a tentativa
            anterior lia 'nutriplan_sid_fallback', que não existe, então o
            header nunca ia e o evento se perdia justo em webview sem cookie. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var n=0;function send(d){try{var h={'Content-Type':'application/json'};try{var s=localStorage.getItem('nutriplan_session_id')||sessionStorage.getItem('nutriplan_session_id');if(s)h['x-quiz-session']=s}catch(e){}fetch('/api/quiz/track-event',{method:'POST',headers:h,body:JSON.stringify({event:'js_error',detail:d})}).catch(function(){})}catch(e){}}function rep(d){if(n>=3)return;n++;d=String(d).slice(0,180);send(d);setTimeout(function(){send(d)},5000)}window.addEventListener('error',function(e){var f=(e.filename||'').split('/').pop()||'inline';rep('@'+f+':'+(e.lineno||0)+' '+(e.message||'err'))});window.addEventListener('unhandledrejection',function(e){var r=e.reason;rep('@promise '+(r&&r.message?r.message:String(r)))})})();`,
          }}
        />
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
