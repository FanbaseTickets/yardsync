'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { Input, Button } from '@/components/ui'
import toast from 'react-hot-toast'
import { Shield, Eye, EyeOff } from 'lucide-react'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '@/lib/firebase'

export default function AdminLoginPage() {
  const { user, loading, signIn, signInWithGoogle } = useAuth()
  const router = useRouter()

  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [busy,         setBusy]         = useState(false)
  const [googleBusy,   setGoogleBusy]   = useState(false)
  const [errors,       setErrors]       = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [mode,         setMode]         = useState('login') // 'login' | 'reset'

  useEffect(() => {
    if (!loading && user) {
      if (user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        router.replace('/admin/dashboard')
      } else {
        toast.error('Not authorized')
        router.replace('/login')
      }
    }
  }, [user, loading, router])

  function clearError(field) {
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }))
  }

  function validate() {
    const e = {}
    if (!email.trim()) e.email = 'Email is required'
    else if (!email.includes('@')) e.email = 'Enter a valid email'
    if (mode === 'login' && !password) e.password = 'Password is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setBusy(true)
    try {
      if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email)
        toast.success('Reset link sent to your email')
        setMode('login')
      } else {
        await signIn(email, password)
      }
    } catch {
      toast.error(mode === 'reset' ? 'Could not send reset email' : 'Invalid credentials')
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogle() {
    setGoogleBusy(true)
    try {
      await signInWithGoogle()
    } catch {
      toast.error('Google sign-in failed')
    } finally {
      setGoogleBusy(false)
    }
  }

  if (loading) return null

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-5">
      <div className="flex flex-col items-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center mb-3">
          <Shield size={26} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white">YardSync Admin</h1>
        <p className="text-gray-400 text-sm mt-1">
          {mode === 'reset' ? 'Reset your password' : 'JNew Technologies'}
        </p>
      </div>

      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6">

        {mode === 'login' && (
          <>
            <button
              onClick={handleGoogle}
              disabled={googleBusy}
              className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-2.5 px-4 text-[14px] font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 mb-2"
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
            <p className="text-[11px] text-gray-400 text-center mb-4">
              Admin access is restricted to authorized accounts.
            </p>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[12px] text-gray-400">or</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            placeholder="admin@jnewtechnologies.com"
            value={email}
            onChange={e => { setEmail(e.target.value); clearError('email') }}
            error={errors.email}
            autoCapitalize="none"
          />
          {mode === 'login' && (
            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => { setPassword(e.target.value); clearError('password') }}
                error={errors.password}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          )}
          <Button type="submit" loading={busy} fullWidth size="lg">
            {mode === 'reset' ? 'Send Reset Link' : 'Sign In'}
          </Button>
        </form>

        <div className="flex flex-col items-center gap-2 mt-4 pt-3 border-t border-gray-100">
          {mode === 'login' ? (
            <button
              onClick={() => { setMode('reset'); setErrors({}); setPassword('') }}
              className="text-[13px] text-gray-400 hover:text-brand-600 transition-colors"
            >
              Forgot password?
            </button>
          ) : (
            <button
              onClick={() => { setMode('login'); setErrors({}) }}
              className="text-[13px] text-brand-600 font-medium hover:underline"
            >
              Back to sign in
            </button>
          )}
        </div>
      </div>

      <p className="text-gray-600 text-xs mt-6">
        Admin access only · YardSync Platform
      </p>
    </div>
  )
}
