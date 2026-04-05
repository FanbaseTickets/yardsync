'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Leaf, CheckCircle2, AlertCircle } from 'lucide-react'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)

function PayForm({ clientSecret, amount, description, clientName }) {
  const stripe = useStripe()
  const elements = useElements()
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  async function handlePay(e) {
    e.preventDefault()
    if (!stripe || !elements) return
    setPaying(true)
    setError(null)

    const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
      clientSecret,
      { payment_method: { card: elements.getElement(CardElement) } }
    )

    if (stripeError) {
      setError(stripeError.message)
      setPaying(false)
    } else if (paymentIntent.status === 'succeeded') {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 size={32} className="text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Payment received</h2>
        <p className="text-lg font-semibold text-gray-700">
          ${(amount / 100).toFixed(2)}
        </p>
        <p className="text-sm text-gray-500 text-center">
          Your lawn care provider has been notified.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handlePay}>
      {description && (
        <p className="text-sm text-gray-600 mb-4">{description}</p>
      )}

      <div className="mb-2">
        <p className="text-2xl font-bold text-gray-900 text-center mb-1">
          ${(amount / 100).toFixed(2)}
        </p>
        <p className="text-xs text-gray-400 text-center mb-4">
          Processing fee included
        </p>
      </div>

      <div className="border border-gray-200 rounded-xl px-4 py-3.5 mb-4 bg-white">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#1f2937',
                '::placeholder': { color: '#9ca3af' },
              },
            },
          }}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 mb-4 text-red-600">
          <AlertCircle size={14} />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || paying}
        className="w-full bg-[#0F6E56] text-white font-bold text-[15px] py-4 rounded-2xl shadow-lg hover:bg-[#0B5A46] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {paying ? (
          <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        ) : (
          `Pay $${(amount / 100).toFixed(2)}`
        )}
      </button>

      <p className="text-xs text-gray-400 text-center mt-3">
        Secured by Stripe · YardSync never sees your card details
      </p>
    </form>
  )
}

export default function PayContent() {
  const { paymentIntentId } = useParams()
  const [details, setDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!paymentIntentId) return
    ;(async () => {
      try {
        const res = await fetch(`/api/stripe/pay/details?id=${paymentIntentId}`)
        if (!res.ok) throw new Error('Could not load invoice')
        const data = await res.json()
        setDetails(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [paymentIntentId])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-[#0F6E56] px-5 pt-10 pb-5">
        <div className="flex items-center gap-3 justify-center">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
            <Leaf size={18} className="text-white" />
          </div>
          <span className="text-white text-lg font-semibold">YardSync</span>
        </div>
        {details?.metadata?.clientName && (
          <p className="text-white/70 text-sm text-center mt-2">
            Invoice for lawn care service
          </p>
        )}
      </div>

      <div className="flex-1 px-5 py-6" style={{ maxWidth: 480, margin: '0 auto', width: '100%' }}>
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <div className="w-8 h-8 rounded-full border-2 border-[#0F6E56] border-t-transparent animate-spin" />
            <p className="text-sm text-gray-400">Loading invoice...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <AlertCircle size={24} className="text-red-500" />
            <p className="text-sm text-gray-600">{error}</p>
          </div>
        )}

        {details && !loading && (
          <Elements stripe={stripePromise} options={{ clientSecret: details.clientSecret }}>
            <PayForm
              clientSecret={details.clientSecret}
              amount={details.amount}
              description={details.description}
              clientName={details.metadata?.clientName}
            />
          </Elements>
        )}
      </div>
    </div>
  )
}
