export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: June 20, 2026</p>

      <section className="space-y-6 text-gray-700 text-sm leading-relaxed">

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Who We Are</h2>
          <p>YardSync is a field service management platform operated by JNew Technologies. We provide scheduling, invoicing, and SMS reminder tools to service providers and their clients.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Information We Collect</h2>
          <p>We collect information you provide directly, including:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Name, email address, and phone number</li>
            <li>Business name and address</li>
            <li>Client contact information entered by service providers</li>
            <li>Scheduling and invoice data</li>
            <li>Logo, business-card photo (headshot), and other image files uploaded by service providers</li>
            <li>Public business-card profile content set by service providers (business name, tagline, bio, service area, brand color, and the contact details they choose to display)</li>
            <li>Information submitted by prospective clients through a service provider&apos;s public intake form, including name, phone number, email address, service address, service interest, notes, and SMS consent</li>
            <li>Usage data including IP address, browser type, device type, and pages visited</li>
            <li>Communications sent through the platform</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">3. How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To provide scheduling, invoicing, and SMS reminder services</li>
            <li>To send appointment reminder text messages to clients on behalf of their service provider</li>
            <li>To process payments via Stripe</li>
            <li>To improve and maintain the platform</li>
            <li>To power AI-assisted message drafting features using Anthropic&apos;s Claude API</li>
            <li>To store and display contractor logos, headshots, and business-card profiles on client-facing payment pages and public digital business cards</li>
            <li>To host each service provider&apos;s public digital business card and to capture service requests from prospective clients as leads for that provider</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Cookies and Tracking</h2>
          <p>YardSync uses cookies and similar technologies to maintain your login session and remember your preferences. We do not use cookies for advertising or tracking across third-party websites. You may disable cookies in your browser settings, but doing so may prevent some features from working correctly.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">5. SMS Messaging</h2>
          <p>YardSync sends appointment reminder SMS messages to clients on behalf of service providers. Message frequency varies based on scheduled appointments. Message and data rates may apply. To opt out, reply STOP to any message. For help, reply HELP.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Data Sharing</h2>
          <p>We do not sell your personal information. Mobile opt-in data and phone numbers collected for SMS communications will never be shared with third parties or affiliates for marketing or promotional purposes. We share data only with trusted service providers necessary to operate the platform (Firebase, Stripe, Twilio, Anthropic). We do not share data with third parties for marketing purposes.</p>
          <p className="mt-2">We retain your data for as long as your account is active. If you cancel your account, your data is preserved in read-only format to allow reactivation. You may request permanent deletion of your data by contacting <a href="mailto:support@yardsyncapp.com" className="text-green-700 underline">support@yardsyncapp.com</a>.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Your Rights</h2>
          <p>Depending on your location, you may have the right to:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Access the personal information we hold about you</li>
            <li>Request correction of inaccurate information</li>
            <li>Request deletion of your personal information</li>
            <li>Opt out of certain data processing activities</li>
          </ul>
          <p className="mt-2">Texas residents may exercise rights under the Texas Data Privacy and Security Act (TDPSA) by contacting us at <a href="mailto:support@yardsyncapp.com" className="text-green-700 underline">support@yardsyncapp.com</a>. We will respond to verified requests within 45 days.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Children&apos;s Privacy</h2>
          <p>YardSync is not intended for users under the age of 13. We do not knowingly collect personal information from children under 13. If you believe we have inadvertently collected such information, please contact us immediately.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Image and File Storage</h2>
          <p>Service providers may upload business logo images and a personal business-card photo (headshot) to YardSync. These files are stored in Google Firebase Storage and served over secure HTTPS connections. Because they are shown on client-facing payment pages and on the provider&apos;s public digital business card, these images are publicly accessible to anyone who has the link or scans the card&apos;s QR code. Service providers control which images they upload and may remove them at any time through Settings.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">10. Public Business Card and Lead Intake</h2>
          <p>Each service provider may publish a public digital business card at a YardSync link (for example, yardsyncapp.com/join/their-name). This card displays the profile content the provider chooses to make public and may include a contact form. Information a prospective client submits through that form is collected on behalf of the service provider and made available to them as a lead within their YardSync account. Service providers are responsible for the content of their public card and for handling the prospect information they collect in accordance with applicable law. If a prospect consents, YardSync may send them a one-time confirmation text on the provider&apos;s behalf; standard message and data rates may apply and the prospect may reply STOP to opt out.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">11. Data Security</h2>
          <p>We use industry-standard security measures to protect your data. All data is stored securely in Google Firebase and transmitted over encrypted connections.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">12. Contact Us</h2>
          <p>For privacy questions, contact us at: <a href="mailto:support@yardsyncapp.com" className="text-green-700 underline">support@yardsyncapp.com</a></p>
          <p className="mt-2"><strong>Governing Law:</strong> This Privacy Policy is governed by the laws of the State of Texas.</p>
        </div>

      </section>
    </div>
  )
}
