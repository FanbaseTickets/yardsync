'use client'

import { useState, useEffect } from 'react'

export default function PrivacyPage() {
  const [lang, setLang] = useState('en')
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('yardsync_lang')
      if (saved === 'es' || saved === 'en') { setLang(saved); return }
    } catch {}
    if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('es')) setLang('es')
  }, [])
  function switchLang(l) { setLang(l); try { window.localStorage.setItem('yardsync_lang', l) } catch {} }
  const es = lang === 'es'

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="flex items-start justify-between gap-4 mb-2">
        <h1 className="text-3xl font-bold">{es ? 'Política de Privacidad' : 'Privacy Policy'}</h1>
        <button
          type="button"
          onClick={() => switchLang(es ? 'en' : 'es')}
          className="flex-shrink-0 mt-1 text-[13px] font-semibold border border-gray-300 rounded-lg px-3 py-1.5 text-gray-600 hover:border-green-700 hover:text-green-700 transition-colors"
        >
          {es ? '🇺🇸 English' : '🇲🇽 Español'}
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-4">{es ? 'Última actualización: 25 de junio de 2026' : 'Last updated: June 25, 2026'}</p>

      {es && (
        <p className="text-[12px] text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3 mb-8">
          Esta es una traducción de cortesía. En caso de cualquier discrepancia, prevalece la versión en inglés, que es la versión oficial y vinculante.
        </p>
      )}

      <section className="space-y-6 text-gray-700 text-sm leading-relaxed">

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{es ? '1. Quiénes somos' : '1. Who We Are'}</h2>
          <p>{es
            ? 'YardSync es una plataforma de gestión de servicios operada por JNew Technologies. Ofrecemos herramientas de programación, facturación y recordatorios por SMS para proveedores de servicio y sus clientes.'
            : 'YardSync is a field service management platform operated by JNew Technologies. We provide scheduling, invoicing, and SMS reminder tools to service providers and their clients.'}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{es ? '2. Información que recopilamos' : '2. Information We Collect'}</h2>
          <p>{es ? 'Recopilamos la información que usted nos proporciona directamente, incluyendo:' : 'We collect information you provide directly, including:'}</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>{es ? 'Nombre, correo electrónico y número de teléfono' : 'Name, email address, and phone number'}</li>
            <li>{es ? 'Nombre del negocio y dirección' : 'Business name and address'}</li>
            <li>{es ? 'Información de contacto de clientes ingresada por los proveedores de servicio' : 'Client contact information entered by service providers'}</li>
            <li>{es ? 'Datos de programación y facturación' : 'Scheduling and invoice data'}</li>
            <li>{es ? 'Logotipo, foto de la tarjeta de presentación (headshot) y otros archivos de imagen subidos por los proveedores de servicio' : 'Logo, business-card photo (headshot), and other image files uploaded by service providers'}</li>
            <li>{es ? 'Contenido del perfil de la tarjeta de presentación pública que define el proveedor (nombre del negocio, eslogan, biografía, área de servicio, color de marca y los datos de contacto que elija mostrar)' : 'Public business-card profile content set by service providers (business name, tagline, bio, service area, brand color, and the contact details they choose to display)'}</li>
            <li>{es ? 'Información que los posibles clientes envían a través del formulario público del proveedor, incluyendo nombre, número de teléfono, correo electrónico, dirección del servicio, interés de servicio, notas y consentimiento para SMS' : 'Information submitted by prospective clients through a service provider’s public intake form, including name, phone number, email address, service address, service interest, notes, and SMS consent'}</li>
            <li>{es ? 'Datos de uso, incluyendo dirección IP, tipo de navegador, tipo de dispositivo y páginas visitadas' : 'Usage data including IP address, browser type, device type, and pages visited'}</li>
            <li>{es ? 'Información de facturación de la suscripción. Cuando configura los pagos, puede guardar una tarjeta para su suscripción de YardSync. Su tarjeta es recopilada y almacenada por Stripe, nuestro procesador de pagos; YardSync nunca recibe ni almacena el número completo de su tarjeta. Solo conservamos un identificador de cliente de Stripe y un token de referencia del método de pago que nos permiten cobrar su suscripción a través de Stripe.' : 'Subscription billing information. When you set up payments, you may save a card on file for your YardSync subscription. Your card is collected and stored by Stripe, our payment processor; YardSync never receives or stores your full card number. We retain only a Stripe customer identifier and a payment-method reference token that let us bill your subscription through Stripe.'}</li>
            <li>{es ? 'Comunicaciones enviadas a través de la plataforma' : 'Communications sent through the platform'}</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{es ? '3. Cómo usamos su información' : '3. How We Use Your Information'}</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>{es ? 'Para brindar servicios de programación, facturación y recordatorios por SMS' : 'To provide scheduling, invoicing, and SMS reminder services'}</li>
            <li>{es ? 'Para enviar mensajes de texto de recordatorio de cita a los clientes en nombre de su proveedor de servicio' : 'To send appointment reminder text messages to clients on behalf of their service provider'}</li>
            <li>{es ? 'Para procesar pagos mediante Stripe' : 'To process payments via Stripe'}</li>
            <li>{es ? 'Para mejorar y mantener la plataforma' : 'To improve and maintain the platform'}</li>
            <li>{es ? 'Para impulsar funciones de redacción de mensajes asistida por IA usando la API de Claude de Anthropic' : 'To power AI-assisted message drafting features using Anthropic’s Claude API'}</li>
            <li>{es ? 'Para almacenar y mostrar los logotipos, headshots y perfiles de tarjeta de los contratistas en las páginas de pago y en las tarjetas de presentación digitales públicas' : 'To store and display contractor logos, headshots, and business-card profiles on client-facing payment pages and public digital business cards'}</li>
            <li>{es ? 'Para alojar la tarjeta de presentación digital pública de cada proveedor y capturar solicitudes de servicio de posibles clientes como prospectos para ese proveedor' : 'To host each service provider’s public digital business card and to capture service requests from prospective clients as leads for that provider'}</li>
            <li>{es ? 'Para cobrar su suscripción de YardSync a través de Stripe usando la tarjeta que tiene guardada, incluyendo iniciar el cobro de la suscripción cuando se pague su primera factura a un cliente' : 'To bill your YardSync subscription through Stripe using your saved card on file, including initiating the subscription charge when your first client invoice is paid'}</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{es ? '4. Cookies y rastreo' : '4. Cookies and Tracking'}</h2>
          <p>{es
            ? 'YardSync usa cookies y tecnologías similares para mantener su sesión iniciada y recordar sus preferencias. No usamos cookies para publicidad ni para rastrearlo en sitios web de terceros. Puede deshabilitar las cookies en la configuración de su navegador, pero hacerlo puede impedir que algunas funciones operen correctamente.'
            : 'YardSync uses cookies and similar technologies to maintain your login session and remember your preferences. We do not use cookies for advertising or tracking across third-party websites. You may disable cookies in your browser settings, but doing so may prevent some features from working correctly.'}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{es ? '5. Mensajes SMS' : '5. SMS Messaging'}</h2>
          <p>{es
            ? 'YardSync envía mensajes SMS de recordatorio de cita a los clientes en nombre de los proveedores de servicio. La frecuencia de los mensajes varía según las citas programadas. Pueden aplicar tarifas de mensajes y datos. Para cancelar, responda STOP a cualquier mensaje. Para ayuda, responda HELP.'
            : 'YardSync sends appointment reminder SMS messages to clients on behalf of service providers. Message frequency varies based on scheduled appointments. Message and data rates may apply. To opt out, reply STOP to any message. For help, reply HELP.'}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{es ? '6. Compartir datos' : '6. Data Sharing'}</h2>
          <p>{es
            ? 'No vendemos su información personal. Los datos de suscripción móvil y los números de teléfono recopilados para comunicaciones por SMS nunca se compartirán con terceros ni afiliados con fines de marketing o promoción. Solo compartimos datos con proveedores de confianza necesarios para operar la plataforma (Firebase, Stripe, Twilio, Anthropic). No compartimos datos con terceros con fines de marketing. Los detalles de la tarjeta de su suscripción son almacenados por Stripe bajo los términos de Stripe; YardSync solo almacena un identificador de cliente y un token del método de pago, no el número de su tarjeta.'
            : 'We do not sell your personal information. Mobile opt-in data and phone numbers collected for SMS communications will never be shared with third parties or affiliates for marketing or promotional purposes. We share data only with trusted service providers necessary to operate the platform (Firebase, Stripe, Twilio, Anthropic). We do not share data with third parties for marketing purposes. Card details for your subscription are stored by Stripe under Stripe’s terms; YardSync stores only a customer identifier and a payment-method token, not your card number.'}</p>
          <p className="mt-2">{es ? 'Conservamos sus datos mientras su cuenta esté activa. Si cancela su cuenta, sus datos se conservan en formato de solo lectura para permitir la reactivación. Puede solicitar la eliminación permanente de sus datos escribiendo a ' : 'We retain your data for as long as your account is active. If you cancel your account, your data is preserved in read-only format to allow reactivation. You may request permanent deletion of your data by contacting '}<a href="mailto:support@yardsyncapp.com" className="text-green-700 underline">support@yardsyncapp.com</a>.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{es ? '7. Sus derechos' : '7. Your Rights'}</h2>
          <p>{es ? 'Según su ubicación, usted puede tener derecho a:' : 'Depending on your location, you may have the right to:'}</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>{es ? 'Acceder a la información personal que tenemos sobre usted' : 'Access the personal information we hold about you'}</li>
            <li>{es ? 'Solicitar la corrección de información inexacta' : 'Request correction of inaccurate information'}</li>
            <li>{es ? 'Solicitar la eliminación de su información personal' : 'Request deletion of your personal information'}</li>
            <li>{es ? 'Obtener una copia portátil de cierta información personal que usted haya proporcionado' : 'Obtain a portable copy of certain personal information you have provided'}</li>
            <li>{es ? 'Optar por no participar en ciertas actividades de procesamiento de datos' : 'Opt out of certain data processing activities'}</li>
          </ul>
          <p className="mt-2">{es ? 'Los proveedores de servicio también pueden exportar sus propios registros de clientes y facturas como archivos CSV en cualquier momento desde Configuración. Estos archivos se generan en su dispositivo y se descargan directamente en él.' : 'Service providers may also export their own client and invoice records as CSV files at any time from Settings. These files are generated on your device and downloaded directly to it.'}</p>
          <p className="mt-2">{es ? 'Los residentes de Texas pueden ejercer sus derechos bajo la Ley de Privacidad y Seguridad de Datos de Texas (TDPSA) escribiéndonos a ' : 'Texas residents may exercise rights under the Texas Data Privacy and Security Act (TDPSA) by contacting us at '}<a href="mailto:support@yardsyncapp.com" className="text-green-700 underline">support@yardsyncapp.com</a>. {es ? 'Responderemos a las solicitudes verificadas dentro de 45 días.' : 'We will respond to verified requests within 45 days.'}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{es ? '8. Privacidad de menores' : '8. Children’s Privacy'}</h2>
          <p>{es
            ? 'YardSync no está dirigido a menores de 13 años. No recopilamos a sabiendas información personal de menores de 13 años. Si cree que hemos recopilado dicha información de manera inadvertida, contáctenos de inmediato.'
            : 'YardSync is not intended for users under the age of 13. We do not knowingly collect personal information from children under 13. If you believe we have inadvertently collected such information, please contact us immediately.'}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{es ? '9. Almacenamiento de imágenes y archivos' : '9. Image and File Storage'}</h2>
          <p>{es
            ? 'Los proveedores de servicio pueden subir imágenes de logotipo y una foto personal de tarjeta de presentación (headshot) a YardSync. Estos archivos se almacenan en Google Firebase Storage y se sirven a través de conexiones HTTPS seguras. Debido a que se muestran en las páginas de pago de cara al cliente y en la tarjeta de presentación digital pública del proveedor, estas imágenes son accesibles públicamente para cualquiera que tenga el enlace o escanee el código QR de la tarjeta. Los proveedores controlan qué imágenes suben y pueden eliminarlas en cualquier momento desde Configuración.'
            : 'Service providers may upload business logo images and a personal business-card photo (headshot) to YardSync. These files are stored in Google Firebase Storage and served over secure HTTPS connections. Because they are shown on client-facing payment pages and on the provider’s public digital business card, these images are publicly accessible to anyone who has the link or scans the card’s QR code. Service providers control which images they upload and may remove them at any time through Settings.'}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{es ? '10. Tarjeta de presentación pública y captura de prospectos' : '10. Public Business Card and Lead Intake'}</h2>
          <p>{es
            ? 'Cada proveedor de servicio puede publicar una tarjeta de presentación digital pública en un enlace de YardSync (por ejemplo, yardsyncapp.com/join/su-nombre). Esta tarjeta muestra el contenido del perfil que el proveedor elige hacer público y puede incluir un formulario de contacto. La información que un posible cliente envía a través de ese formulario se recopila en nombre del proveedor de servicio y se le pone a disposición como prospecto dentro de su cuenta de YardSync. Los proveedores son responsables del contenido de su tarjeta pública y del manejo de la información de prospectos que recopilan, conforme a la ley aplicable. Si un prospecto da su consentimiento, YardSync puede enviarle un mensaje de confirmación único en nombre del proveedor; pueden aplicar tarifas estándar de mensajes y datos, y el prospecto puede responder STOP para cancelar.'
            : 'Each service provider may publish a public digital business card at a YardSync link (for example, yardsyncapp.com/join/their-name). This card displays the profile content the provider chooses to make public and may include a contact form. Information a prospective client submits through that form is collected on behalf of the service provider and made available to them as a lead within their YardSync account. Service providers are responsible for the content of their public card and for handling the prospect information they collect in accordance with applicable law. If a prospect consents, YardSync may send them a one-time confirmation text on the provider’s behalf; standard message and data rates may apply and the prospect may reply STOP to opt out.'}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{es ? '11. Seguridad de los datos' : '11. Data Security'}</h2>
          <p>{es
            ? 'Usamos medidas de seguridad estándar de la industria para proteger sus datos. Todos los datos se almacenan de forma segura en Google Firebase y se transmiten a través de conexiones cifradas.'
            : 'We use industry-standard security measures to protect your data. All data is stored securely in Google Firebase and transmitted over encrypted connections.'}</p>
          <p className="mt-2">{es
            ? 'Cuando usted exporta o descarga sus datos, el archivo resultante sale de los sistemas protegidos de YardSync y queda almacenado en su propio dispositivo. Usted es responsable de resguardar los archivos exportados —que pueden contener datos de contacto de clientes y otra información personal— y de manejar esa información conforme a la ley aplicable.'
            : 'When you export or download your data, the resulting file leaves YardSync’s secured systems and is stored on your own device. You are responsible for safeguarding any exported files — which may contain client contact details and other personal information — and for handling that information in accordance with applicable law.'}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{es ? '12. Contáctenos' : '12. Contact Us'}</h2>
          <p>{es ? 'Para preguntas sobre privacidad, contáctenos en: ' : 'For privacy questions, contact us at: '}<a href="mailto:support@yardsyncapp.com" className="text-green-700 underline">support@yardsyncapp.com</a></p>
          <p className="mt-2"><strong>{es ? 'Ley aplicable:' : 'Governing Law:'}</strong> {es ? 'Esta Política de Privacidad se rige por las leyes del Estado de Texas.' : 'This Privacy Policy is governed by the laws of the State of Texas.'}</p>
        </div>

      </section>
    </div>
  )
}
