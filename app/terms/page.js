export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">Terms and Conditions</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: June 22, 2026</p>

      <section className="space-y-6 text-gray-700 text-sm leading-relaxed">

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Acceptance of Terms</h2>
          <p>By using YardSync, you agree to these Terms and Conditions. YardSync is operated by JNew Technologies. If you do not agree, please do not use the platform.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Description of Service</h2>
          <p>YardSync provides field service management tools including client scheduling, invoicing via Stripe Connect, materials tracking, AI-assisted SMS drafting, logo and headshot image storage, a public digital business card with QR code and prospect-intake (lead capture) form, volume-based subscription rewards, and SMS appointment reminders via Twilio.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">3. SMS Messaging Program</h2>
          <p>YardSync sends appointment reminder and invoice SMS messages to clients on behalf of service providers. By providing a phone number to a YardSync-powered service provider, clients consent to receive these messages.</p>
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
            <li><strong>Per-invoice application fee.</strong> A flat 5.5% application fee is taken on every invoice you send to your clients through YardSync, deducted automatically at the time the client pays. The remaining balance settles directly to your connected Stripe account. This fee is shown on every invoice preview before you send it.</li>
          </ul>
          <p className="mt-2"><strong>Volume rewards.</strong> Service providers who consistently process high invoice volume through YardSync earn automatic discounts on their subscription. Processing $1,500 or more in invoices in a month for two consecutive months reduces the subscription fee by 50%. Processing $3,000 or more in invoices in a month for two consecutive months waives the subscription fee entirely. Discounts persist as long as the qualifying volume is maintained and revert if volume drops below the threshold.</p>
          <p className="mt-2"><strong>Stripe&apos;s own processing fees are separate</strong> and are charged by Stripe directly against the payment, in addition to the YardSync application fee. YardSync does not control, collect, or rebate Stripe processing fees.</p>
          <p className="mt-2">YardSync may adjust either the subscription fee or the application fee for new accounts at any time, with at least 30 days&apos; notice posted to this page. Existing accounts may be subject to the Early Adopter Pricing Lock described in Section 6.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Stripe Payment Processing</h2>
          <p>Payment processing services for service providers on YardSync are provided by Stripe and are subject to the Stripe Connected Account Agreement, which includes the Stripe Terms of Service (collectively, the &quot;Stripe Services Agreement&quot;). By connecting a bank account and accepting payments through YardSync, you agree to be bound by the Stripe Services Agreement, as the same may be modified by Stripe from time to time. As a condition of YardSync enabling payment processing services through Stripe, you agree to provide YardSync accurate and complete information about you and your business, and you authorize YardSync to share it and transaction information related to your use of the payment processing services provided by Stripe.</p>
          <p className="mt-2">YardSync facilitates payments between service providers and their clients using Stripe Connect direct charges. <strong>The service provider (the connected Stripe account) is the merchant of record for each client payment.</strong> JNew Technologies acts solely as a technology platform and payment facilitator and is not the merchant of record, the seller, or the provider of the underlying field-service work, and is not a party to any agreement between a service provider and its client.</p>
          <p className="mt-2"><strong>Refunds, chargebacks, and disputes.</strong> Because the service provider is the merchant of record, the service provider is solely responsible for all refunds, chargebacks, disputed charges, and any related fees arising from payments collected through YardSync Pay. Refunds are issued from the service provider&apos;s connected account, and the service provider authorizes Stripe and JNew Technologies to debit the connected account for the amount of any refund, chargeback, dispute, or associated fee. The service provider is responsible for maintaining a sufficient connected-account balance to cover these amounts and for any resulting negative balance. The 5.5% application fee is non-refundable and is retained by JNew Technologies even if a client payment is later refunded or disputed. JNew Technologies does not guarantee any client payment and is not liable for, or a party to, any dispute between a service provider and its client.</p>
          <p className="mt-2">Stripe&apos;s own processing fees are charged by Stripe directly against each payment and are borne by the service provider&apos;s connected account, separate from and in addition to the 5.5% application fee.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Early Adopter Pricing Lock</h2>
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
          <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Intellectual Property and Your Data</h2>
          <p>You retain ownership of all data you enter into YardSync, including client information, schedules, and invoice records. By using YardSync, you grant JNew Technologies a limited license to store, process, and display your data solely for the purpose of providing the service. YardSync&apos;s platform, branding, and software are the exclusive property of JNew Technologies and may not be copied or reproduced without written permission.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">8. User Content and Public Business Card</h2>
          <p>Service providers may upload logos, business-card photos (headshots), and other content to YardSync, and may publish a public digital business card at a YardSync link. You represent that you have the rights to any content you upload or display and that it does not infringe any third-party intellectual property rights, and you are solely responsible for the accuracy and content of your public business card. JNew Technologies reserves the right to remove content or disable a public card that violates these Terms.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Prohibited Uses</h2>
          <p>You agree not to use YardSync to:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Send spam, unsolicited messages, or harassing communications</li>
            <li>Violate any applicable law or regulation</li>
            <li>Impersonate another person or business</li>
            <li>Attempt to gain unauthorized access to any part of the platform</li>
            <li>Use the platform for any purpose other than legitimate business management</li>
          </ul>
          <p className="mt-2">Violations may result in immediate account termination without refund.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">10. User Responsibilities</h2>
          <p>Service providers are responsible for obtaining appropriate consent from their clients before entering client contact information into YardSync. Service providers are likewise responsible for handling information submitted by prospective clients through their public intake form — including name, phone, email, and address — in accordance with applicable law, and for contacting those prospects only as permitted by law. Users agree not to use the platform for spam, harassment, or any unlawful purpose.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">11. Account Termination</h2>
          <p>JNew Technologies reserves the right to suspend or terminate any account that violates these Terms, with or without notice. Terminated accounts for cause are not eligible for refunds. Service providers may cancel their own subscription at any time per Section 4.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">12. Limitation of Liability</h2>
          <p>JNew Technologies is not liable for indirect, incidental, or consequential damages arising from use of YardSync. The platform is provided as-is without warranties of any kind.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">13. Indemnification</h2>
          <p>You agree to indemnify and hold harmless JNew Technologies, its officers, directors, and employees from any claims, damages, or expenses arising from your use of YardSync, your violation of these Terms, or your violation of any third-party rights.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">14. Force Majeure</h2>
          <p>JNew Technologies is not liable for any failure or delay in providing the platform due to causes beyond its reasonable control, including but not limited to outages of third-party services (Stripe, Twilio, Firebase, Anthropic), internet disruptions, or natural disasters.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">15. Dispute Resolution and Governing Law</h2>
          <p>These Terms are governed by the laws of the State of Texas, without regard to conflict of law principles. Any dispute arising from these Terms shall be resolved by binding arbitration in Bexar County, Texas, under the rules of the American Arbitration Association. You waive any right to participate in a class action lawsuit or class-wide arbitration against JNew Technologies.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">16. Changes to Terms</h2>
          <p>We may update these terms at any time. Continued use of YardSync after changes constitutes acceptance of the new terms. Material changes to the platform application fee or subscription fee for new accounts will be posted here at least 30 days before taking effect.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">17. General</h2>
          <p>If any provision of these Terms is found unenforceable, the remaining provisions remain in full effect (severability). YardSync&apos;s failure to enforce any right is not a waiver of that right. These Terms constitute the entire agreement between you and JNew Technologies regarding your use of YardSync.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">18. Contact</h2>
          <p>For questions about these terms: <a href="mailto:support@yardsyncapp.com" className="text-green-700 underline">support@yardsyncapp.com</a></p>
        </div>

      </section>
    </div>
  )
}
