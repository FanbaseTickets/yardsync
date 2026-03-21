'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { getGardenerProfile, saveGardenerProfile } from '@/lib/db'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        const p = await getGardenerProfile(firebaseUser.uid)
        setProfile(p)
      } else {
        setUser(null)
        setProfile(null)
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  async function signIn(email, password) {
    return await signInWithEmailAndPassword(auth, email, password)
  }

  async function signUp(email, password, name, businessName) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    const profileData = {
      name,
      businessName,
      email,
      basePackages: {
        monthly:   { label: 'Monthly',   visits: 2,  basePriceCents: 6500  },
        quarterly: { label: 'Quarterly', visits: 6,  basePriceCents: 18500 },
        annual:    { label: 'Annual',    visits: 24, basePriceCents: 72000 },
      },
      smsTemplate:   'Hi {name}! Your yard service is scheduled for {date} at {time}. See you then! — {business}',
      smsTemplateEs: 'Hola {name}! Su servicio de jardín está programado para {date} a las {time}. ¡Hasta pronto! — {business}',
    }
    await saveGardenerProfile(cred.user.uid, profileData)
    setProfile(profileData)
    return cred
  }

  async function signInWithGoogle() {
    const provider = new GoogleAuthProvider()
    const cred     = await signInWithPopup(auth, provider)

    // Check if profile already exists — if not, create one from Google data
    const existing = await getGardenerProfile(cred.user.uid)
    if (!existing) {
      const profileData = {
        name:         cred.user.displayName || '',
        businessName: '',
        email:        cred.user.email || '',
        smsTemplate:   'Hi {name}! Your yard service is scheduled for {date} at {time}. See you then! — {business}',
        smsTemplateEs: 'Hola {name}! Su servicio de jardín está programado para {date} a las {time}. ¡Hasta pronto! — {business}',
      }
      await saveGardenerProfile(cred.user.uid, profileData)
      setProfile(profileData)
    } else {
      // If existing profile has no name, pull it from Google
      if (!existing.name && cred.user.displayName) {
        await saveGardenerProfile(cred.user.uid, { name: cred.user.displayName })
        existing.name = cred.user.displayName
      }
      setProfile(existing)
    }

    return cred
  }

  async function signOut() {
    await firebaseSignOut(auth)
  }

  async function resetPassword(email) {
    await sendPasswordResetEmail(auth, email)
  }

  async function refreshProfile() {
    if (user) {
      const p = await getGardenerProfile(user.uid)
      setProfile(p)
    }
  }

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      signIn, signUp, signInWithGoogle,
      signOut, resetPassword, refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}