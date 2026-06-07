'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
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

  // True from the moment a signup/Google sign-in begins until the auth
  // hydration window has comfortably passed. AppShell reads this to suppress
  // its redirect-to-login guard during the cold-lambda mount window where
  // Firebase Auth hasn't propagated yet. Cleared by a 5s timeout in
  // signUp()/signInWithGoogle() — generous enough to cover slow cold starts
  // without leaving the guard disabled long enough for a real logged-out
  // visit to /dashboard to slip through.
  const signingUpRef = useRef(false)

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

  async function signUp(email, password, name, businessName, language) {
    signingUpRef.current = true
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    const profileData = {
      name,
      businessName,
      email,
      language: language || 'en',
      subscriptionStatus: 'none',
      basePackages: {
        monthly:   { label: 'Monthly',   visits: 2,  basePriceCents: 6500  },
        quarterly: { label: 'Quarterly', visits: 6,  basePriceCents: 18500 },
        annual:    { label: 'Annual',    visits: 24, basePriceCents: 72000 },
      },
      smsTemplate:   'Hi {name}! Your yard service is scheduled for {date} at {time}. See you then! Reply STOP to opt out. – YardSync',
      smsTemplateEs: 'Hola {name}! Su servicio de jardín está programado para {date} a las {time}. ¡Hasta pronto! Responda STOP para cancelar. – YardSync',
    }
    await saveGardenerProfile(cred.user.uid, profileData)

    // Eagerly populate AuthContext state. Without this, the login page's
    // `router.replace('/dashboard')` can fire BEFORE onAuthStateChanged
    // propagates the new user — AppShell mounts on /dashboard with user=null,
    // hits its redirect-to-login guard, bounces to /login, and the login
    // page's own redirect-when-user-present bounces back to /dashboard.
    // On a cold Vercel lambda this ping-pong produces an 11+ second hang
    // (root cause of the 2026-06-03 post-signup regression).
    //
    // onAuthStateChanged will still fire shortly after and re-set these to
    // the same values — idempotent, no flicker. Same pattern applied to
    // signInWithGoogle() below.
    setUser(cred.user)
    setProfile(profileData)
    setLoading(false)

    // Persist language to localStorage so pre-auth pages (subscribe) can read it
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('yardsync_lang', profileData.language || 'en')
    }

    // Clear the signup-in-progress flag after the navigation + auth-hydration
    // window has comfortably passed. AppShell's login-redirect guard reads
    // this ref to avoid bouncing to /login while Firebase Auth is still
    // hydrating on a cold Vercel lambda.
    setTimeout(() => { signingUpRef.current = false }, 5000)

    return cred
  }

  async function signInWithGoogle() {
    signingUpRef.current = true
    const provider = new GoogleAuthProvider()
    const cred     = await signInWithPopup(auth, provider)

    // Check if profile already exists — if not, create one from Google data
    const existing = await getGardenerProfile(cred.user.uid)
    if (!existing) {
      const profileData = {
        name:         cred.user.displayName || '',
        businessName: '',
        email:        cred.user.email || '',
        subscriptionStatus: 'none',
        smsTemplate:   'Hi {name}! Your yard service is scheduled for {date} at {time}. See you then! Reply STOP to opt out. – YardSync',
        smsTemplateEs: 'Hola {name}! Su servicio de jardín está programado para {date} a las {time}. ¡Hasta pronto! Responda STOP para cancelar. – YardSync',
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

    // Eagerly populate user + loading state (see signUp() comment above for rationale)
    setUser(cred.user)
    setLoading(false)

    // Clear the signup-in-progress flag after the auth-hydration window
    setTimeout(() => { signingUpRef.current = false }, 5000)

    return cred
  }

  async function signOut() {
    // Navigate away before Firebase clears auth state to prevent
    // components from accessing user.uid during teardown
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
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
      signOut, resetPassword, refreshProfile,
      signingUp: signingUpRef,
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