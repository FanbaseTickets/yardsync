'use client'

import { useEffect, useState } from 'react'
import { canPromptInstall, promptInstall, onInstallChange, isStandalone, isIOS } from '@/lib/pwaInstall'
import { useLang } from '@/context/LangContext'
import { Download, Share, PlusSquare, X } from 'lucide-react'
import toast from 'react-hot-toast'

/**
 * "Install app" affordance for non-tech contractors who won't know to "Add to
 * Home Screen." Android/Chrome → native install prompt. iOS Safari → step-by-step
 * (tap Share → Add to Home Screen). Renders nothing if already installed, or on
 * a desktop/browser that can't install. `dismissible` shows an X (dashboard
 * banner); the welcome-modal usage leaves it non-dismissible.
 */
export default function InstallApp({ dismissible = false }) {
  const { lang } = useLang()
  const es = lang === 'es'
  const [, force]       = useState(0)
  const [showIos, setShowIos] = useState(false)
  const [hidden, setHidden]   = useState(false)

  useEffect(() => onInstallChange(() => force(n => n + 1)), [])
  useEffect(() => {
    if (dismissible) {
      try { if (localStorage.getItem('yardsync_install_dismissed') === '1') setHidden(true) } catch {}
    }
  }, [dismissible])

  if (hidden) return null
  if (isStandalone()) return null            // already installed — nothing to do
  const ios       = isIOS()
  const canPrompt = canPromptInstall()
  if (!ios && !canPrompt) return null        // desktop / unsupported

  async function handleInstall() {
    if (canPrompt) {
      const ok = await promptInstall()
      if (!ok) toast(es ? 'Puedes instalarla luego desde el menú del navegador.' : 'You can install it later from your browser menu.')
    } else if (ios) {
      setShowIos(v => !v)
    }
  }

  function dismiss() {
    setHidden(true)
    try { localStorage.setItem('yardsync_install_dismissed', '1') } catch {}
  }

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 relative">
      {dismissible && (
        <button onClick={dismiss} aria-label="Dismiss" className="absolute top-2 right-2 text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      )}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0">
          <Download size={18} className="text-brand-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-gray-900">
            {es ? 'Instala YardSync en tu teléfono' : 'Install YardSync on your phone'}
          </p>
          <p className="text-[12px] text-gray-600 mt-0.5 leading-relaxed">
            {es
              ? 'Ábrela como una app normal y recibe avisos en tu pantalla — sin abrir el navegador cada vez.'
              : 'Open it like a normal app and get alerts on your screen — no opening the browser each time.'}
          </p>

          <button
            onClick={handleInstall}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-[13px] font-semibold"
          >
            <Download size={15} />
            {canPrompt
              ? (es ? 'Instalar app' : 'Install app')
              : (es ? 'Cómo instalar' : 'How to install')}
          </button>

          {/* iOS has no install prompt — show the manual steps. */}
          {ios && showIos && (
            <div className="mt-3 text-[12px] text-gray-700 bg-white rounded-lg border border-gray-200 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Share size={15} className="text-brand-600 flex-shrink-0" />
                <span>{es ? <>1. Toca el botón <strong>Compartir</strong> abajo en Safari</> : <>1. Tap the <strong>Share</strong> button at the bottom of Safari</>}</span>
              </div>
              <div className="flex items-center gap-2">
                <PlusSquare size={15} className="text-brand-600 flex-shrink-0" />
                <span>{es ? <>2. Elige <strong>Agregar a inicio</strong></> : <>2. Choose <strong>Add to Home Screen</strong></>}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
