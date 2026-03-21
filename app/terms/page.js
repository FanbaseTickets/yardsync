export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">Terms and Conditions</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: March 20, 2026</p>

      <section className="space-y-6 text-gray-700 text-sm leading-relaxed">

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Acceptance of Terms</h2>
          <p>By using YardSync, you agree to these Terms and Conditions. YardSync is operated by JNew Technologies. If you do not agree, please do not use the platform.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Description of Service</h2>
          <p>YardSync provides lawn care management tools including client scheduling, invoicing via Square, and SMS appointment reminders via Twilio. The platform charges a monthly subscription fee of $39/month or $390/year.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">3. SMS Messaging Program</h2>
          <p>YardSync sends appointment reminder SMS messages to lawn care clients on behalf of service providers. By providing a phone number to a YardSync-powered service provider, clients consent to receive appointment reminder messages.</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Message frequency varies based on scheduled appointments</li>
            <li>Message and data rates may apply</li>
            <li>To opt out, reply <strong>STOP</strong> to any message</li>
            <li>For help, reply <strong>HELP</strong> or contact admin@fanbasetickets.net</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Payment Terms</h2>
          <p>Subscription fees are billed monthly or annually via Stripe. Platform fees are embedded in Square invoices sent to lawn care clients. All fees are disclosed to service providers at signup. Subscriptions can be cancelled at any time.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">5. User Responsibilities</h2>
          <p>Service providers are responsible for obtaining appropriate consent from their clients before entering client contact information into YardSync. Users agree not to use the platform for spam, harassment, or any unlawful purpose.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Limitation of Liability</h2>
          <p>JNew Technologies is not liable for indirect, incidental, or consequential damages arising from use of YardSync. The platform is provided as-is without warranties of any kind.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Changes to Terms</h2>
          <p>We may update these terms at any time. Continued use of YardSync after changes constitutes acceptance of the new terms.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Contact</h2>
          <p>For questions about these terms: <a href="mailto:admin@fanbasetickets.net" className="text-green-700 underline">admin@fanbasetickets.net</a></p>
        </div>

      </section>
    </div>
  )
}
