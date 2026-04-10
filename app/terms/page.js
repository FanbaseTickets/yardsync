export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">Terms and Conditions</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: April 8, 2026</p>

      <section className="space-y-6 text-gray-700 text-sm leading-relaxed">

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Acceptance of Terms</h2>
          <p>By using YardSync, you agree to these Terms and Conditions. YardSync is operated by JNew Technologies. If you do not agree, please do not use the platform.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Description of Service</h2>
          <p>YardSync provides lawn care and field service management tools including client scheduling, invoicing via Stripe, materials tracking, volume-based subscription rewards, and SMS appointment reminders via Twilio. YardSync charges a monthly or annual subscription fee for access to the platform, plus a separate per-invoice application fee on payments processed through Stripe Connect. Both charges are described in Section 4.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">3. SMS Messaging Program</h2>
          <p>YardSync sends appointment reminder and invoice SMS messages to lawn care clients on behalf of service providers. By providing a phone number to a YardSync-powered service provider, clients consent to receive these messages.</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Message frequency varies based on scheduled appointments and invoices</li>
            <li>Message and data rates may apply</li>
            <li>To opt out, reply <strong>STOP</strong> to any message</li>
            <li>For help, reply <strong>HELP</strong> or contact support@yardsyncapp.com</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Payment Terms and Platform Fees</h2>
          <p>YardSync has two separate charges, both billed through Stripe:</p>
          <ul className="list-disc pl-5 mt-2 space-y-2">
            <li><strong>Subscription fee.</strong> $39 per month or $390 per year, billed in advance to the payment method on file. New accounts are charged a one-time $99 Pro Setup fee at signup. Subscriptions can be cancelled at any time and remain active through the end of the paid period. The $99 Pro Setup fee is non-refundable, including in the event of cancellation within the first 30 days.</li>
            <li><strong>Per-invoice application fee.</strong> A flat 5.5% application fee is taken on every invoice you send to your clients through YardSync, deducted automatically at the time the client pays. The remaining balance is transferred to your connected Stripe account. This fee is shown on every invoice preview before you send it.</li>
          </ul>
          <p className="mt-2"><strong>Volume rewards.</strong> Service providers who consistently process high invoice volume through YardSync earn automatic discounts on their subscription. Processing $1,500 or more in invoices in a month for two consecutive months reduces the subscription fee by 50%. Processing $3,000 or more in invoices in a month for two consecutive months waives the subscription fee entirely. Discounts persist as long as the qualifying volume is maintained and revert if volume drops below the threshold.</p>
          <p className="mt-2"><strong>Stripe&apos;s own processing fees are separate</strong> and are charged by Stripe directly against the payment, in addition to the YardSync application fee. YardSync does not control, collect, or rebate Stripe processing fees.</p>
          <p className="mt-2">YardSync may adjust either the subscription fee or the application fee for new accounts at any time, with at least 30 days&apos; notice posted to this page. Existing accounts may be subject to the Early Adopter Pricing Lock described in Section 5.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Early Adopter Pricing Lock</h2>
          <p>Service providers who create a YardSync account on or before <strong>April 15, 2028</strong> are eligible for the Early Adopter Pricing Lock, which guarantees the launch per-invoice application fee rate of <strong>5.5%</strong> for the lifetime of the account, even if the standard rate for new accounts is later increased.</p>
          <p className="mt-2">The Early Adopter Pricing Lock is contingent on continuous, uninterrupted membership in good standing. The Lock is permanently forfeited, and the account becomes subject to the then-current standard rate, if any of the following occur:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Cancellation of the YardSync account followed by reactivation more than <strong>60 days</strong> after the cancellation date</li>
            <li>Downgrade to a lower tier or plan, where applicable</li>
            <li>A lapse in payment that remains unresolved for more than <strong>30 days</strong> from the date of the first failed charge</li>
          </ul>
          <p className="mt-2"><strong>Grace windows.</strong> A failed payment that is resolved by updating the payment method within 30 days does not trigger forfeiture. A voluntary cancellation followed by reactivation within 60 days is treated as a brief pause and does not trigger forfeiture. These grace windows are intended to protect seasonal contractors and accounts affected by routine bank reissues; they are not intended as a tool for avoiding rate increases, and YardSync reserves the right to deny grace-window protection in cases of obvious gaming.</p>
          <p className="mt-2">Once forfeited, the Early Adopter Pricing Lock cannot be reinstated. YardSync may increase the standard per-invoice application fee for non-grandfathered new accounts by <strong>up to 1% per year</strong> following the initial two-year early adopter window, with at least 30 days&apos; notice posted to this page. The actual rate at any given time will be disclosed in your account settings and on every invoice preview before sending.</p>
          <p className="mt-2">YardSync reserves the right, at its sole discretion, to grant the Early Adopter Pricing Lock to specific accounts outside the standard eligibility window, including comped accounts, partner arrangements, and referral program participants.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">6. User Responsibilities</h2>
          <p>Service providers are responsible for obtaining appropriate consent from their clients before entering client contact information into YardSync. Users agree not to use the platform for spam, harassment, or any unlawful purpose.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Limitation of Liability</h2>
          <p>JNew Technologies is not liable for indirect, incidental, or consequential damages arising from use of YardSync. The platform is provided as-is without warranties of any kind.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Changes to Terms</h2>
          <p>We may update these terms at any time. Continued use of YardSync after changes constitutes acceptance of the new terms. Material changes to the platform application fee or subscription fee for new accounts will be posted here at least 30 days before taking effect.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Contact</h2>
          <p>For questions about these terms: <a href="mailto:support@yardsyncapp.com" className="text-green-700 underline">support@yardsyncapp.com</a></p>
        </div>

      </section>
    </div>
  )
}
