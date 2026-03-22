'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { t } from '@/lib/i18n'

const LangContext = createContext(null)

export function LangProvider({ children }) {
  const { profile } = useAuth()
  const [lang, setLang] = useState('en')

  // Only read language from the gardener's profile — never from client records
  useEffect(() => {
    if (profile?.language && (profile.language === 'en' || profile.language === 'es')) {
      setLang(profile.language)
    }
  }, [profile?.language])

  function translate(section, key) {
    return t(lang, section, key)
  }

  return (
    <LangContext.Provider value={{ lang, translate }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used inside LangProvider')
  return ctx
}