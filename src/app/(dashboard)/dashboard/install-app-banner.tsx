'use client'

import { useEffect, useState } from 'react'
import { Smartphone, Share, X } from 'lucide-react'

type Platform = 'ios' | 'android' | 'other'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function detectPlatform(): Platform {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'other'
}

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}

// Mostra como "guardar" o painel como app (Añadir a pantalla de inicio).
// Só aparece em celular e some sozinho se já estiver instalado.
export function InstallAppBanner() {
  const [platform, setPlatform] = useState<Platform>('other')
  const [ready, setReady] = useState(false)
  const [standalone, setStandalone] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    setPlatform(detectPlatform())
    setStandalone(isStandalone())
    setDismissed(sessionStorage.getItem('nutriplan_install_dismissed') === '1')
    setReady(true)

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    function onBeforeInstall(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    function onInstalled() {
      setInstalled(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!ready || standalone || installed || dismissed || platform === 'other') return null

  function dismiss() {
    sessionStorage.setItem('nutriplan_install_dismissed', '1')
    setDismissed(true)
  }

  async function handleInstallClick() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
  }

  return (
    <div className="relative rounded-2xl border border-[#D8E8D4] bg-white p-4 shadow-[0_4px_18px_rgba(15,110,86,0.07)]">
      <button
        onClick={dismiss}
        aria-label="Cerrar"
        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Smartphone className="h-5 w-5 text-primary" />
        </div>

        <div className="space-y-1.5">
          <p className="font-display text-[15px] font-bold text-foreground leading-tight">
            Guarda NutriPlan como tu app
          </p>

          {platform === 'ios' ? (
            <p className="text-[13px] leading-snug text-muted-foreground">
              Toca <Share className="inline h-3.5 w-3.5 -mt-0.5" strokeWidth={2.3} /> Compartir abajo y luego{' '}
              <strong className="text-foreground">"Añadir a pantalla de inicio"</strong>. Vas a tener tu plan
              como una app, sin ocupar espacio de la tienda.
            </p>
          ) : deferredPrompt ? (
            <>
              <p className="text-[13px] leading-snug text-muted-foreground">
                Instálala en un toque y tenla siempre a mano, como cualquier otra app.
              </p>
              <button
                onClick={handleInstallClick}
                className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-bold text-white active:scale-[0.98] transition-all"
              >
                Instalar app
              </button>
            </>
          ) : (
            <p className="text-[13px] leading-snug text-muted-foreground">
              Toca el menú <strong className="text-foreground">⋮</strong> de tu navegador y elige{' '}
              <strong className="text-foreground">"Instalar app"</strong> o{' '}
              <strong className="text-foreground">"Añadir a pantalla de inicio"</strong>.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
