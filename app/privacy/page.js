export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: March 20, 2026</p>

      <section className="space-y-6 text-gray-700 text-sm leading-relaxed">

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Who We Are</h2>
          <p>YardSync is a lawn care management platform operated by JNew Technologies. We provide scheduling, invoicing, and SMS reminder tools to lawn care service providers and their clients.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Information We Collect</h2>
          <p>We collect information you provide directly, including:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Name, email address, and phone number</li>
            <li>Business name and address</li>
            <li>Client contact information entered by service providers</li>
            <li>Scheduling and invoice data</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">3. How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To provide scheduling, invoicing, and SMS reminder services</li>
            <li>To send appointment reminder text messages to clients on behalf of their service provider</li>
            <li>To process payments via Stripe and Square</li>
            <li>To improve and maintain the platform</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">4. SMS Messaging</h2>
          <p>YardSync sends appointment reminder SMS messages to lawn care clients on behalf of service providers. Message frequency varies based on scheduled appointments. Message and data rates may apply. To opt out, reply STOP to any message. For help, reply HELP.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Data Sharing</h2>
          <p>We do not sell your personal information. Mobile opt-in data and phone numbers collected for SMS communications will never be shared with third parties or affiliates for marketing or promotional purposes. We share data only with trusted service providers necessary to operate the platform (Firebase, Stripe, Square, Twilio). We do not share data with third parties for marketing purposes.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Data Security</h2>
          <p>We use industry-standard security measures to protect your data. All data is stored securely in Google Firebase and transmitted over encrypted connections.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Contact Us</h2>
          <p>For privacy questions, contact us at: <a href="mailto:support@yardsyncapp.com" className="text-green-700 underline">support@yardsyncapp.com</a></p>
        </div>

      </section>
    </div>
  )
}
