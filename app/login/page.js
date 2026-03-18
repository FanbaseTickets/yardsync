'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { Input, Button } from '@/components/ui'
import toast from 'react-hot-toast'
import { Leaf } from 'lucide-react'

export default function LoginPage() {
  const { user, loading, signIn, signUp, signInWithGoogle, resetPassword } = useAuth()
  const router = useRouter()

  const [mode,     setMode]     = useState('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [bizName,  setBizName]  = useState('')
  const [busy,     setBusy]     = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [errors,   setErrors]   = useState({})

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard')
  }, [user, loading, router])

  function validate() {
    const e = {}
    if (!email)                               e.email    = 'Email is required'
    if (!email.includes('@'))                 e.email    = 'Enter a valid email'
    if (mode !== 'reset' && !password)        e.password = 'Password is required'
    if (mode !== 'reset' && password.length < 6) e.password = 'Min 6 characters'
    if (mode === 'signup' && !name)           e.name     = 'Your name is required'
    if (mode === 'signup' && !bizName)        e.bizName  = 'Business name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setBusy(true)
    try {
      if (mode === 'login') {
        await signIn(email, password)
        router.replace('/dashboard')
      } else if (mode === 'signup') {
        await signUp(email, password, name, bizName)
        router.replace('/dashboard')
      } else {
        await resetPassword(email)
        toast.success('Reset link sent to your email')
        setMode('login')
      }
    } catch (err) {
      const msg =
        err.code === 'auth/user-not-found'       ? 'No account with that email' :
        err.code === 'auth/wrong-password'        ? 'Incorrect password' :
        err.code === 'auth/email-already-in-use'  ? 'Email already registered' :
        'Something went wrong — try again'
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogle() {
    setGoogleBusy(true)
    try {
      await signInWithGoogle()
      router.replace('/dashboard')
    } catch (err) {
      toast.error('Google sign-in failed — try again')
    } finally {
      setGoogleBusy(false)
    }
  }

  if (loading) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 flex flex-col items-center justify-center px-5 py-10">
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center mb-3">
          <Leaf size={30} className="text-white" />
        </div>
        <h1 className="text-3xl font-display text-white tracking-tight">YardSync</h1>
        <p className="text-brand-200 text-sm mt-1">
          {mode === 'login'  ? 'Sign in to your account' :
           mode === 'signup' ? 'Create your account' :
                               'Reset your password'}
        </p>
      </div>

      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6">

        {/* Google sign-in — only show on login and signup */}
        {mode !== 'reset' && (
          <>
            <button
              onClick={handleGoogle}
              disabled={googleBusy}
              className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-2.5 px-4 text-[14px] font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {googleBusy ? (
                <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                  <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
                  <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
                  <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
                </svg>
              )}
              Continue with Google
            </button>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[12px] text-gray-400">or</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'signup' && (
            <>
              <Input
                label="Your name"
                type="text"
                placeholder="Jay Johnson"
                value={name}
                onChange={e => setName(e.target.value)}
                error={errors.name}
              />
              <Input
                label="Business name"
                type="text"
                placeholder="JNew Technologies"
                value={bizName}
                onChange={e => setBizName(e.target.value)}
                error={errors.bizName}
              />
            </>
          )}
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            error={errors.email}
            autoCapitalize="none"
          />
          {mode !== 'reset' && (
            <Input
              label="Password"
              type="password"
              placeholder={mode === 'signup' ? 'Min 6 characters' : '••••••••'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              error={errors.password}
            />
          )}
          <Button type="submit" loading={busy} fullWidth size="lg" className="mt-1">
            {mode === 'login'  ? 'Sign In' :
             mode === 'signup' ? 'Create Account' :
                                 'Send Reset Link'}
          </Button>
        </form>

        <div className="flex flex-col items-center gap-2 mt-5 pt-4 border-t border-gray-100">
          {mode === 'login' && (
            <>
              <button
                onClick={() => { setMode('reset'); setErrors({}) }}
                className="text-[13px] text-gray-400 hover:text-brand-600 transition-colors"
              >
                Forgot password?
              </button>
              <button
                onClick={() => { setMode('signup'); setErrors({}) }}
                className="text-[13px] text-brand-600 font-medium hover:underline"
              >
                Create an account
              </button>
            </>
          )}
          {mode !== 'login' && (
            <button
              onClick={() => { setMode('login'); setErrors({}) }}
              className="text-[13px] text-brand-600 font-medium hover:underline"
            >
              Back to sign in
            </button>
          )}
        </div>
      </div>

      <p className="text-brand-300 text-xs mt-6 text-center">
        Powered by YardSync · A JNew Technologies platform
      </p>
    </div>
  )
}