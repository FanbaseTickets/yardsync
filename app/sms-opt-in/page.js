export const metadata = {
  title: 'SMS Opt-In Disclosure — YardSync',
  description: 'How YardSync handles appointment reminder SMS messages: consent, opt-out, and contact information.',
}

export default function SmsOptInPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header bar */}
      <header className="bg-brand-700 text-white">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-6 sm:py-8">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">YardSync</h1>
          <p className="text-sm sm:text-base text-white/85 mt-1">SMS Appointment Reminders</p>
        </div>
      </header>

      {/* Body */}
      <main className="px-4 py-8 sm:py-12">
        <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-card border border-gray-100 p-6 sm:p-8 space-y-6">

          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">How SMS Consent Works</h2>
            <p className="text-[14px] text-gray-700 leading-relaxed">
              Your lawn care provider uses YardSync to send you appointment reminder text messages on their behalf.
              When you provide your phone number to your service provider, you agree to receive recurring
              appointment reminder SMS messages sent through YardSync.
            </p>
            <p className="text-[14px] text-gray-700 leading-relaxed">
              Message frequency varies based on your scheduled appointments. Message and data rates may apply.
            </p>
          </section>

          <hr className="border-gray-200" />

          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Your Options</h2>
            <p className="text-[14px] text-gray-700 leading-relaxed">
              To opt out at any time, reply <strong>STOP</strong> to any message. You will receive a confirmation
              and no further messages will be sent.
            </p>
            <p className="text-[14px] text-gray-700 leading-relaxed">
              To get help, reply <strong>HELP</strong> to any message.
            </p>
          </section>

          <hr className="border-gray-200" />

          <section className="space-y-2">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Legal</h2>
            <p className="text-[14px] leading-relaxed">
              <a
                href="https://yardsyncapp.com/terms"
                className="text-brand-700 hover:text-brand-800 underline"
              >
                Terms and Conditions — yardsyncapp.com/terms
              </a>
            </p>
            <p className="text-[14px] leading-relaxed">
              <a
                href="https://yardsyncapp.com/privacy"
                className="text-brand-700 hover:text-brand-800 underline"
              >
                Privacy Policy — yardsyncapp.com/privacy
              </a>
            </p>
          </section>

          <p className="text-[12px] text-gray-400 leading-relaxed pt-4 border-t border-gray-100">
            YardSync is operated by JNew Technologies, LLC. San Antonio, TX.
            Contact: <a href="mailto:support@yardsyncapp.com" className="text-gray-500 hover:underline">support@yardsyncapp.com</a>
          </p>

        </div>
      </main>
    </div>
  )
}
