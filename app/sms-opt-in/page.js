import { CheckCircle2 } from 'lucide-react'

export const metadata = {
  title: 'SMS Opt-In — YardSync',
  description: 'Opt in to appointment reminder SMS messages from YardSync on behalf of your lawn care service provider.',
}

export default async function SmsOptInPage({ searchParams }) {
  const params = (await searchParams) || {}
  const confirmed = params.confirmed === 'true'

  return (
    <div className="min-h-screen bg-white">
      {/* Green header bar */}
      <header className="bg-brand-700 text-white">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-6 sm:py-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">YardSync</h1>
          <p className="text-sm sm:text-base text-white/90 mt-1">SMS Appointment Reminders</p>
        </div>
      </header>

      {/* Card */}
      <main className="px-4 py-6 sm:py-10">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-card border border-gray-100 p-6 sm:p-8 mt-2 sm:mt-4">
          {confirmed ? <SuccessState /> : <ConsentForm />}
          <Footer />
        </div>
      </main>
    </div>
  )
}

function SuccessState() {
  return (
    <div className="text-center space-y-3 py-2">
      <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
        <CheckCircle2 size={32} className="text-emerald-600" aria-hidden="true" />
      </div>
      <h2 className="text-xl font-semibold text-gray-900">You&apos;re opted in!</h2>
      <p className="text-[14px] text-gray-700 leading-relaxed">
        Your lawn care provider will be in touch with appointment reminders via YardSync.
      </p>
    </div>
  )
}

function ConsentForm() {
  return (
    <>
      <div className="space-y-2 mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Opt In to Appointment Reminders</h2>
        <p className="text-[13px] text-gray-500 leading-relaxed">
          Your lawn care provider uses YardSync to send appointment reminders. Complete this form to confirm you&apos;d like to receive them.
        </p>
      </div>

      <form method="get" action="/sms-opt-in" className="space-y-5">
        <input type="hidden" name="confirmed" value="true" />

        {/* Name — display only, no `name` attribute so it is not transmitted */}
        <div>
          <label htmlFor="opt-in-name" className="block text-[13px] font-medium text-gray-700 mb-1">
            Your Name (optional)
          </label>
          <input
            id="opt-in-name"
            type="text"
            autoComplete="name"
            placeholder="First and last name"
            className="w-full rounded-xl border border-gray-200 bg-white text-gray-900 text-[14px] px-3 py-2.5 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>

        {/* Phone — display only, no `name` attribute so it is not transmitted */}
        <div>
          <label htmlFor="opt-in-phone" className="block text-[13px] font-medium text-gray-700 mb-1">
            Your Phone Number (optional)
          </label>
          <input
            id="opt-in-phone"
            type="tel"
            autoComplete="tel"
            placeholder="(210) 555-0000"
            className="w-full rounded-xl border border-gray-200 bg-white text-gray-900 text-[14px] px-3 py-2.5 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>

        <p className="text-[12px] text-gray-400 leading-relaxed">
          Your phone number is provided directly to your lawn care provider — not stored by this form.
        </p>

        {/* Consent checkbox — unchecked by default, not required */}
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
          <label htmlFor="opt-in-consent" className="flex items-start gap-3 cursor-pointer">
            <input
              id="opt-in-consent"
              type="checkbox"
              name="consent"
              value="agree"
              className="mt-1 w-4 h-4 rounded accent-brand-600 flex-shrink-0"
            />
            <span className="text-[13px] text-gray-700 leading-relaxed">
              I agree to receive recurring appointment reminder SMS messages from YardSync on behalf of my lawn care service provider. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe at any time. Reply HELP for help.
            </span>
          </label>
        </div>

        {/* Legal links — outside the checkbox label */}
        <div className="space-y-1">
          <p className="text-[12px] text-gray-500">
            <a href="https://yardsyncapp.com/terms" className="text-brand-700 hover:text-brand-800 underline">
              Terms and Conditions: yardsyncapp.com/terms
            </a>
          </p>
          <p className="text-[12px] text-gray-500">
            <a href="https://yardsyncapp.com/privacy" className="text-brand-700 hover:text-brand-800 underline">
              Privacy Policy: yardsyncapp.com/privacy
            </a>
          </p>
        </div>

        <button
          type="submit"
          className="w-full bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl py-3 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500"
        >
          Confirm Opt-In
        </button>
      </form>
    </>
  )
}

function Footer() {
  return (
    <div className="mt-6 pt-6 border-t border-gray-100 space-y-2">
      <p className="text-[12px] text-gray-400 leading-relaxed">
        YardSync is operated by JNew Technologies, LLC · San Antonio, TX · <a href="mailto:support@yardsyncapp.com" className="text-gray-500 hover:underline">support@yardsyncapp.com</a>
      </p>
      <p className="text-[12px] text-gray-400 leading-relaxed">
        No mobile opt-in data will be shared with third parties or affiliates for marketing or promotional purposes.
      </p>
    </div>
  )
}
