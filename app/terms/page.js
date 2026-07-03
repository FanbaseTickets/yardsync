'use client'

import { useState, useEffect } from 'react'

export default function TermsPage() {
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
        <h1 className="text-3xl font-bold">{es ? 'Términos y Condiciones' : 'Terms and Conditions'}</h1>
        <button
          type="button"
          onClick={() => switchLang(es ? 'en' : 'es')}
          className="flex-shrink-0 mt-1 text-[13px] font-semibold border border-gray-300 rounded-lg px-3 py-1.5 text-gray-600 hover:border-green-700 hover:text-green-700 transition-colors"
        >
          {es ? '🇺🇸 English' : '🇲🇽 Español'}
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-4">{es ? 'Última actualización: 30 de junio de 2026' : 'Last updated: June 30, 2026'}</p>

      {es && (
        <p className="text-[12px] text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3 mb-8">
          Esta es una traducción de cortesía. En caso de cualquier discrepancia, prevalece la versión en inglés, que es la versión oficial y vinculante.
        </p>
      )}

      <section className="space-y-6 text-gray-700 text-sm leading-relaxed">

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{es ? '1. Aceptación de los Términos' : '1. Acceptance of Terms'}</h2>
          <p>{es
            ? 'Al usar YardSync, usted acepta estos Términos y Condiciones. YardSync es operado por JNew Technologies. Si no está de acuerdo, por favor no use la plataforma.'
            : 'By using YardSync, you agree to these Terms and Conditions. YardSync is operated by JNew Technologies. If you do not agree, please do not use the platform.'}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{es ? '2. Descripción del Servicio' : '2. Description of Service'}</h2>
          <p>{es
            ? 'YardSync ofrece herramientas de gestión de servicios que incluyen programación de clientes, facturación mediante Stripe Connect, control de materiales, redacción de SMS asistida por IA, almacenamiento de imágenes de logotipo y headshot, una tarjeta de presentación digital pública con código QR y formulario de captación de prospectos, recompensas de suscripción por volumen y recordatorios de cita por SMS a través de Twilio.'
            : 'YardSync provides field service management tools including client scheduling, invoicing via Stripe Connect, materials tracking, AI-assisted SMS drafting, logo and headshot image storage, a public digital business card with QR code and prospect-intake (lead capture) form, volume-based subscription rewards, and SMS appointment reminders via Twilio.'}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{es ? '3. Programa de Mensajes SMS' : '3. SMS Messaging Program'}</h2>
          <p>{es
            ? 'YardSync envía mensajes SMS de recordatorio de cita y de facturas a los clientes en nombre de los proveedores de servicio. Al proporcionar un número de teléfono a un proveedor que usa YardSync, los clientes dan su consentimiento para recibir estos mensajes.'
            : 'YardSync sends appointment reminder and invoice SMS messages to clients on behalf of service providers. By providing a phone number to a YardSync-powered service provider, clients consent to receive these messages.'}</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>{es ? 'La frecuencia de los mensajes varía según las citas y facturas programadas' : 'Message frequency varies based on scheduled appointments and invoices'}</li>
            <li>{es ? 'Pueden aplicar tarifas de mensajes y datos' : 'Message and data rates may apply'}</li>
            <li>{es ? <>Para cancelar, responda <strong>STOP</strong> a cualquier mensaje</> : <>To opt out, reply <strong>STOP</strong> to any message</>}</li>
            <li>{es ? <>Para ayuda, responda <strong>HELP</strong> o escriba a support@yardsyncapp.com</> : <>For help, reply <strong>HELP</strong> or contact support@yardsyncapp.com</>}</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{es ? '4. Términos de Pago y Tarifas de la Plataforma' : '4. Payment Terms and Platform Fees'}</h2>
          <p>{es ? 'YardSync tiene dos cargos separados, ambos facturados a través de Stripe:' : 'YardSync has two separate charges, both billed through Stripe:'}</p>
          <ul className="list-disc pl-5 mt-2 space-y-2">
            <li>{es
              ? <><strong>Cuota de suscripción.</strong> Las cuentas nuevas empiezan gratis. Usted puede registrarse y usar YardSync —incluyendo conectar Stripe, crear su tarjeta de presentación digital, agregar clientes, programar y enviar facturas— sin costo. Cuando configura los pagos, guardamos de forma segura una tarjeta de pago a través de Stripe <strong>sin cobrarla</strong>. La suscripción de $39 por mes (o $390 por año) no comienza y su tarjeta no se cobra hasta que <strong>se pague la primera factura que usted envíe a un cliente a través de YardSync</strong>. En ese momento la suscripción se activa, se cobra a la tarjeta guardada y se renueva automáticamente cada periodo (mensual por defecto; hay un plan anual disponible dentro de la app) hasta que usted cancele. Si nunca se paga una factura a través de YardSync, nunca se le cobra la cuota de suscripción. Puede cancelar en cualquier momento; la cancelación surte efecto al final del periodo ya pagado.</>
              : <><strong>Subscription fee.</strong> New accounts start free. You can sign up and use YardSync — including connecting Stripe, building your digital business card, adding clients, scheduling, and sending invoices — at no charge. When you set up payments, we securely save a payment card on file through Stripe <strong>without charging it</strong>. The $39 per month (or $390 per year) subscription does not begin and your card is not charged until <strong>the first client invoice you send through YardSync is paid</strong>. At that point the subscription activates and is billed to the card on file, and renews automatically each period (monthly by default; an annual plan is available as an in-app option) until you cancel. If you never have a client invoice paid through YardSync, you are never charged the subscription fee. You may cancel at any time; cancellation takes effect at the end of the then-current paid period.</>}</li>
            <li>{es
              ? <><strong>Tarifa de aplicación por factura.</strong> Se cobra una tarifa de aplicación fija del 5.5%, <strong>con un tope de $100 por factura</strong>, sobre cada factura que usted envíe a sus clientes a través de YardSync, deducida automáticamente al momento en que el cliente paga. El saldo restante se deposita directamente en su cuenta de Stripe conectada. La tarifa y cualquier tope aplicable se le muestran en la vista previa de cada factura antes de enviarla. YardSync puede ajustar el monto del tope para cuentas nuevas con al menos 30 días de aviso publicado en esta página.</>
              : <><strong>Per-invoice application fee.</strong> A flat 5.5% application fee, <strong>capped at $100 per invoice</strong>, is taken on every invoice you send to your clients through YardSync, deducted automatically at the time the client pays. The remaining balance settles directly to your connected Stripe account. The fee and any applicable cap are shown to you on every invoice preview before you send it. YardSync may adjust the cap amount for new accounts with at least 30 days’ notice posted to this page.</>}</li>
          </ul>
          {/* PENDING LEGAL REVIEW (added 2026-06-27): fee-inclusive pricing / surcharge disclaimer — draft language, counsel to confirm. */}
          <p className="mt-2">{es
            ? <><strong>Precios con la comisión incluida (opcional).</strong> Usted puede optar por fijar un precio único, con la comisión incluida, para una factura de cliente, de modo que el monto que paga el cliente absorba la tarifa de aplicación de YardSync y las tarifas de procesamiento de Stripe. Cuando se activa, al cliente se le cobra un solo total con todo incluido, aplicado de manera uniforme sin importar el método de pago; YardSync no agrega, desglosa ni informa al cliente ningún recargo por tarjeta por separado. Todas las decisiones de precio, incluyendo si usar precios con la comisión incluida, las toma únicamente usted. YardSync no exige, dirige ni establece recargos, y no es parte del acuerdo de precio entre usted y su cliente. Usted es el único responsable de asegurar que su precio —incluyendo cualquier precio con la comisión incluida— cumpla con la ley aplicable y las reglas de las redes de tarjetas, y acepta no representar ninguna parte de un precio con todo incluido ante un cliente como un recargo por tarjeta de crédito.</>
            : <><strong>Fee-inclusive pricing (optional).</strong> You may choose to set a single, fee-inclusive price for a client invoice, so that the amount the client pays absorbs the YardSync application fee and Stripe’s processing fees. When enabled, the client is billed one inclusive total, applied uniformly regardless of payment method; YardSync does not add, itemize, or disclose any separate card surcharge to the client. All pricing decisions, including whether to use fee-inclusive pricing, are made solely by you. YardSync does not require, direct, or set surcharges and is not a party to the pricing arrangement between you and your client. You are solely responsible for ensuring your pricing — including any fee-inclusive pricing — complies with applicable law and card-network rules, and you agree not to represent any portion of an inclusive price to a client as a credit-card surcharge.</>}</p>
          <p className="mt-2">{es
            ? <><strong>Tarjeta guardada y autorización para cargos futuros.</strong> Cuando guarda una tarjeta de pago durante la configuración, usted autoriza a JNew Technologies a almacenar esa tarjeta como credencial en archivo con nuestro procesador de pagos, Stripe, y a cobrarla de forma recurrente por la cuota de suscripción descrita arriba. Usted reconoce y acepta que el <strong>primer cargo de la suscripción ocurrirá automáticamente, sin acción ni confirmación adicional de su parte, en el momento en que se pague su primera factura a un cliente a través de YardSync</strong>, y que la suscripción se renovará y cobrará automáticamente cada periodo posterior hasta que se cancele. Si un cargo de suscripción falla, YardSync puede reintentar el cargo y puede suspender o restringir el acceso a las funciones de pago hasta que se resuelva el saldo. Usted es responsable de mantener una tarjeta de pago válida en archivo. Esta autorización permanece vigente hasta que cancele su suscripción o elimine su tarjeta guardada.</>
            : <><strong>Card on file and authorization for future charges.</strong> When you save a payment card during payment setup, you authorize JNew Technologies to store that card as a credential on file with our payment processor, Stripe, and to charge it on a recurring basis for the subscription fee described above. You acknowledge and agree that the <strong>first subscription charge will occur automatically, without further action or confirmation by you, at the time your first client invoice is paid through YardSync</strong>, and that the subscription will renew and be charged automatically each period thereafter until cancelled. If a subscription charge fails, YardSync may retry the charge and may suspend or restrict access to paid features until the balance is resolved. You are responsible for keeping a valid payment card on file. This authorization remains in effect until you cancel your subscription or remove your card on file.</>}</p>
          {/* PENDING LEGAL REVIEW (added 2026-06-28): recurring auto-billing of a client's card — draft language, counsel to confirm (incl. NACHA/card-network advance-notice + authorization rules). */}
          <p className="mt-2">{es
            ? <><strong>Cobro automático recurrente (opcional).</strong> Puede activar el cobro automático para un cliente, lo que cobra automáticamente la tarjeta guardada de ese cliente por cada visita recurrente. Usted es el único responsable de obtener la autorización del cliente para cobrar su tarjeta de forma recurrente (que YardSync recopila cuando el cliente guarda su tarjeta) y de cumplir con las reglas aplicables de cobro recurrente y de aviso anticipado. YardSync envía al cliente un aviso antes de cada cobro y una forma de cancelar. El proveedor de servicio es el comerciante registrado de cada cobro; YardSync no es parte del acuerdo recurrente entre usted y su cliente.</>
            : <><strong>Recurring auto-billing (optional).</strong> You may enable auto-billing for a client, which automatically charges that client's saved card for each recurring visit. You are solely responsible for obtaining the client's authorization to charge their card on a recurring basis (which YardSync collects when the client saves their card) and for complying with applicable recurring-billing and advance-notice rules. YardSync sends the client an advance reminder before each charge and a way to cancel. The service provider is the merchant of record for each charge; YardSync is not a party to the recurring arrangement between you and your client.</>}</p>
          <p className="mt-2">{es
            ? <><strong>Configuración Pro (opcional).</strong> El complemento único de Configuración Pro por $99, mediante el cual YardSync importa su lista de clientes existente por usted, es opcional y puede adquirirse en cualquier momento dentro de la app. No es necesario para usar YardSync y no es reembolsable una vez que el trabajo de importación ha comenzado.</>
            : <><strong>Pro Setup (optional).</strong> The one-time $99 Pro Setup add-on, under which YardSync imports your existing client list for you, is optional and may be purchased at any time from within the app. It is not required to use YardSync and is non-refundable once the import work has begun.</>}</p>
          <p className="mt-2">{es
            ? <><strong>Recompensas por volumen.</strong> Los proveedores que procesan de forma constante un alto volumen de facturas a través de YardSync obtienen descuentos automáticos en su suscripción. Procesar $1,500 o más en facturas en un mes durante dos meses consecutivos reduce la cuota de suscripción en un 50%. Procesar $3,000 o más en facturas en un mes durante dos meses consecutivos elimina por completo la cuota de suscripción. Los descuentos se mantienen mientras se conserve el volumen requerido y se revierten si el volumen baja del umbral.</>
            : <><strong>Volume rewards.</strong> Service providers who consistently process high invoice volume through YardSync earn automatic discounts on their subscription. Processing $1,500 or more in invoices in a month for two consecutive months reduces the subscription fee by 50%. Processing $3,000 or more in invoices in a month for two consecutive months waives the subscription fee entirely. Discounts persist as long as the qualifying volume is maintained and revert if volume drops below the threshold.</>}</p>
          <p className="mt-2">{es
            ? <><strong>Las tarifas de procesamiento de Stripe son aparte.</strong> Stripe cobra sus propias tarifas de procesamiento de pagos (aproximadamente 2.9% más $0.30 por transacción) directamente sobre cada pago del cliente. Debido a que el proveedor de servicio es el comerciante registrado, estas tarifas de procesamiento de Stripe corren por cuenta del proveedor y se deducen del monto que se deposita en la cuenta conectada, además de la tarifa de aplicación del 5.5% de YardSync. YardSync no controla, cobra ni reembolsa las tarifas de procesamiento de Stripe.</>
            : <><strong>Stripe’s own processing fees are separate.</strong> Stripe charges its own payment processing fees (approximately 2.9% plus $0.30 per transaction) directly against each client payment. Because the service provider is the merchant of record, these Stripe processing fees are borne by the service provider and are deducted from the amount that settles to the connected account, in addition to the YardSync 5.5% application fee. YardSync does not control, collect, or rebate Stripe processing fees.</>}</p>
          <p className="mt-2">{es
            ? 'YardSync puede ajustar la cuota de suscripción o la tarifa de aplicación para cuentas nuevas en cualquier momento, con al menos 30 días de aviso publicado en esta página. Las cuentas existentes pueden estar sujetas al Bloqueo de Precio para Primeros Usuarios descrito en la Sección 6.'
            : 'YardSync may adjust either the subscription fee or the application fee for new accounts at any time, with at least 30 days’ notice posted to this page. Existing accounts may be subject to the Early Adopter Pricing Lock described in Section 6.'}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{es ? '5. Procesamiento de Pagos con Stripe' : '5. Stripe Payment Processing'}</h2>
          <p>{es
            ? 'Los servicios de procesamiento de pagos para los proveedores en YardSync son proporcionados por Stripe y están sujetos al Acuerdo de Cuenta Conectada de Stripe, que incluye los Términos de Servicio de Stripe (en conjunto, el "Acuerdo de Servicios de Stripe"). Al conectar una cuenta bancaria y aceptar pagos a través de YardSync, usted acepta quedar obligado por el Acuerdo de Servicios de Stripe, según sea modificado por Stripe de tiempo en tiempo. Como condición para que YardSync habilite los servicios de procesamiento de pagos a través de Stripe, usted acepta proporcionar a YardSync información precisa y completa sobre usted y su negocio, y autoriza a YardSync a compartirla junto con la información de transacciones relacionada con su uso de los servicios de procesamiento de pagos de Stripe.'
            : 'Payment processing services for service providers on YardSync are provided by Stripe and are subject to the Stripe Connected Account Agreement, which includes the Stripe Terms of Service (collectively, the "Stripe Services Agreement"). By connecting a bank account and accepting payments through YardSync, you agree to be bound by the Stripe Services Agreement, as the same may be modified by Stripe from time to time. As a condition of YardSync enabling payment processing services through Stripe, you agree to provide YardSync accurate and complete information about you and your business, and you authorize YardSync to share it and transaction information related to your use of the payment processing services provided by Stripe.'}</p>
          <p className="mt-2">{es
            ? <>YardSync facilita los pagos entre los proveedores de servicio y sus clientes usando cargos directos de Stripe Connect. <strong>El proveedor de servicio (la cuenta de Stripe conectada) es el comerciante registrado de cada pago del cliente.</strong> JNew Technologies actúa únicamente como plataforma tecnológica y facilitador de pagos, y no es el comerciante registrado, ni el vendedor, ni el proveedor del trabajo de servicio subyacente, y no es parte de ningún acuerdo entre un proveedor de servicio y su cliente.</>
            : <>YardSync facilitates payments between service providers and their clients using Stripe Connect direct charges. <strong>The service provider (the connected Stripe account) is the merchant of record for each client payment.</strong> JNew Technologies acts solely as a technology platform and payment facilitator and is not the merchant of record, the seller, or the provider of the underlying field-service work, and is not a party to any agreement between a service provider and its client.</>}</p>
          <p className="mt-2">{es
            ? <><strong>Reembolsos, contracargos y disputas.</strong> Debido a que el proveedor de servicio es el comerciante registrado, el proveedor es el único responsable de todos los reembolsos, contracargos, cargos disputados y cualquier tarifa relacionada que surja de los pagos cobrados a través de YardSync Pay. Los reembolsos se emiten desde la cuenta conectada del proveedor, y el proveedor autoriza a Stripe y a JNew Technologies a debitar la cuenta conectada por el monto de cualquier reembolso, contracargo, disputa o tarifa asociada. El proveedor es responsable de mantener un saldo suficiente en la cuenta conectada para cubrir estos montos y de cualquier saldo negativo resultante. La tarifa de aplicación del 5.5% no es reembolsable y la conserva JNew Technologies incluso si un pago del cliente es posteriormente reembolsado o disputado. JNew Technologies no garantiza ningún pago del cliente y no es responsable de, ni parte en, ninguna disputa entre un proveedor de servicio y su cliente.</>
            : <><strong>Refunds, chargebacks, and disputes.</strong> Because the service provider is the merchant of record, the service provider is solely responsible for all refunds, chargebacks, disputed charges, and any related fees arising from payments collected through YardSync Pay. Refunds are issued from the service provider’s connected account, and the service provider authorizes Stripe and JNew Technologies to debit the connected account for the amount of any refund, chargeback, dispute, or associated fee. The service provider is responsible for maintaining a sufficient connected-account balance to cover these amounts and for any resulting negative balance. The 5.5% application fee is non-refundable and is retained by JNew Technologies even if a client payment is later refunded or disputed. JNew Technologies does not guarantee any client payment and is not liable for, or a party to, any dispute between a service provider and its client.</>}</p>
          <p className="mt-2">{es
            ? 'Las tarifas de procesamiento propias de Stripe se cobran directamente sobre cada pago y corren por cuenta de la cuenta conectada del proveedor, de forma separada y adicional a la tarifa de aplicación del 5.5%.'
            : 'Stripe’s own processing fees are charged by Stripe directly against each payment and are borne by the service provider’s connected account, separate from and in addition to the 5.5% application fee.'}</p>
          {/* PENDING LEGAL REVIEW (added 2026-06-30): tax reporting / 1099-K responsibility — draft language, counsel to confirm issuer + threshold framing. */}
          <p className="mt-2">{es
            ? <><strong>Impuestos y reportes fiscales (1099-K).</strong> Debido a que el proveedor de servicio es el comerciante registrado y los pagos se depositan en su cuenta de Stripe conectada, el proveedor es el único responsable de todos los impuestos sobre sus ingresos y de sus propios reportes fiscales. Cualquier formulario de impuestos correspondiente (como un Formulario 1099-K del IRS, cuando se alcanzan los umbrales de reporte aplicables) es emitido por Stripe al proveedor de servicio con base en los pagos liquidados en su cuenta conectada; YardSync no emite formularios 1099-K a los proveedores ni a sus clientes, y no es responsable de determinar la obligación fiscal del proveedor. Los umbrales de reporte los fija la ley y pueden cambiar. YardSync no brinda asesoría fiscal; consulte a un profesional de impuestos.</>
            : <><strong>Taxes and tax reporting (1099-K).</strong> Because the service provider is the merchant of record and payments settle to their connected Stripe account, the service provider is solely responsible for all taxes on their income and for their own tax reporting. Any applicable tax form (such as an IRS Form 1099-K, where applicable reporting thresholds are met) is issued by Stripe to the service provider based on the payments settled to their connected account; YardSync does not issue 1099-K forms to providers or their clients and is not responsible for determining a provider’s tax liability. Reporting thresholds are set by law and may change. YardSync does not provide tax advice; consult a tax professional.</>}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{es ? '6. Bloqueo de Precio para Primeros Usuarios' : '6. Early Adopter Pricing Lock'}</h2>
          <p>{es
            ? <>Los proveedores de servicio que creen una cuenta de YardSync el <strong>15 de abril de 2028</strong> o antes son elegibles para el Bloqueo de Precio para Primeros Usuarios, que garantiza la tarifa de aplicación por factura de lanzamiento del <strong>5.5%</strong> durante toda la vida de la cuenta, incluso si la tarifa estándar para cuentas nuevas se aumenta después.</>
            : <>Service providers who create a YardSync account on or before <strong>April 15, 2028</strong> are eligible for the Early Adopter Pricing Lock, which guarantees the launch per-invoice application fee rate of <strong>5.5%</strong> for the lifetime of the account, even if the standard rate for new accounts is later increased.</>}</p>
          <p className="mt-2">{es
            ? 'El Bloqueo de Precio para Primeros Usuarios está condicionado a una membresía continua e ininterrumpida en buen estado. El Bloqueo se pierde de forma permanente, y la cuenta queda sujeta a la tarifa estándar vigente, si ocurre cualquiera de lo siguiente:'
            : 'The Early Adopter Pricing Lock is contingent on continuous, uninterrupted membership in good standing. The Lock is permanently forfeited, and the account becomes subject to the then-current standard rate, if any of the following occur:'}</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>{es ? <>Cancelación de la cuenta de YardSync seguida de reactivación más de <strong>60 días</strong> después de la fecha de cancelación</> : <>Cancellation of the YardSync account followed by reactivation more than <strong>60 days</strong> after the cancellation date</>}</li>
            <li>{es ? 'Cambio a un nivel o plan inferior, cuando aplique' : 'Downgrade to a lower tier or plan, where applicable'}</li>
            <li>{es ? <>Una falta de pago que permanezca sin resolverse por más de <strong>30 días</strong> desde la fecha del primer cargo fallido</> : <>A lapse in payment that remains unresolved for more than <strong>30 days</strong> from the date of the first failed charge</>}</li>
          </ul>
          <p className="mt-2">{es
            ? <><strong>Periodos de gracia.</strong> Un pago fallido que se resuelve actualizando el método de pago dentro de 30 días no provoca la pérdida del Bloqueo. Una cancelación voluntaria seguida de reactivación dentro de 60 días se trata como una pausa breve y no provoca la pérdida del Bloqueo. Estos periodos de gracia buscan proteger a los contratistas de temporada y a las cuentas afectadas por reemisiones bancarias rutinarias; no están destinados como herramienta para evitar aumentos de tarifa, y YardSync se reserva el derecho de negar la protección del periodo de gracia en casos de manipulación evidente.</>
            : <><strong>Grace windows.</strong> A failed payment that is resolved by updating the payment method within 30 days does not trigger forfeiture. A voluntary cancellation followed by reactivation within 60 days is treated as a brief pause and does not trigger forfeiture. These grace windows are intended to protect seasonal contractors and accounts affected by routine bank reissues; they are not intended as a tool for avoiding rate increases, and YardSync reserves the right to deny grace-window protection in cases of obvious gaming.</>}</p>
          <p className="mt-2">{es
            ? <>Una vez perdido, el Bloqueo de Precio para Primeros Usuarios no puede reinstaurarse. YardSync puede aumentar la tarifa de aplicación por factura estándar para cuentas nuevas no protegidas en <strong>hasta 1% por año</strong> después de la ventana inicial de dos años para primeros usuarios, con al menos 30 días de aviso publicado en esta página. La tarifa real en cualquier momento se mostrará en la configuración de su cuenta y en la vista previa de cada factura antes de enviarla.</>
            : <>Once forfeited, the Early Adopter Pricing Lock cannot be reinstated. YardSync may increase the standard per-invoice application fee for non-grandfathered new accounts by <strong>up to 1% per year</strong> following the initial two-year early adopter window, with at least 30 days’ notice posted to this page. The actual rate at any given time will be disclosed in your account settings and on every invoice preview before sending.</>}</p>
          <p className="mt-2">{es
            ? 'YardSync se reserva el derecho, a su entera discreción, de otorgar el Bloqueo de Precio para Primeros Usuarios a cuentas específicas fuera de la ventana de elegibilidad estándar, incluyendo cuentas de cortesía, acuerdos con socios y participantes del programa de referidos.'
            : 'YardSync reserves the right, at its sole discretion, to grant the Early Adopter Pricing Lock to specific accounts outside the standard eligibility window, including comped accounts, partner arrangements, and referral program participants.'}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{es ? '7. Propiedad Intelectual y Sus Datos' : '7. Intellectual Property and Your Data'}</h2>
          <p>{es
            ? 'Usted conserva la propiedad de todos los datos que ingresa en YardSync, incluyendo información de clientes, programaciones y registros de facturas. Al usar YardSync, otorga a JNew Technologies una licencia limitada para almacenar, procesar y mostrar sus datos únicamente con el fin de prestar el servicio. La plataforma, la marca y el software de YardSync son propiedad exclusiva de JNew Technologies y no pueden copiarse ni reproducirse sin autorización por escrito.'
            : 'You retain ownership of all data you enter into YardSync, including client information, schedules, and invoice records. By using YardSync, you grant JNew Technologies a limited license to store, process, and display your data solely for the purpose of providing the service. YardSync’s platform, branding, and software are the exclusive property of JNew Technologies and may not be copied or reproduced without written permission.'}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{es ? '8. Contenido del Usuario y Tarjeta de Presentación Pública' : '8. User Content and Public Business Card'}</h2>
          <p>{es
            ? 'Los proveedores de servicio pueden subir logotipos, fotos de tarjeta (headshots) y otro contenido a YardSync, y pueden publicar una tarjeta de presentación digital pública en un enlace de YardSync. Usted declara que tiene los derechos sobre cualquier contenido que suba o muestre y que no infringe derechos de propiedad intelectual de terceros, y es el único responsable de la exactitud y el contenido de su tarjeta pública. JNew Technologies se reserva el derecho de eliminar contenido o deshabilitar una tarjeta pública que viole estos Términos.'
            : 'Service providers may upload logos, business-card photos (headshots), and other content to YardSync, and may publish a public digital business card at a YardSync link. You represent that you have the rights to any content you upload or display and that it does not infringe any third-party intellectual property rights, and you are solely responsible for the accuracy and content of your public business card. JNew Technologies reserves the right to remove content or disable a public card that violates these Terms.'}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{es ? '9. Usos Prohibidos' : '9. Prohibited Uses'}</h2>
          <p>{es ? 'Usted acepta no usar YardSync para:' : 'You agree not to use YardSync to:'}</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>{es ? 'Enviar spam, mensajes no solicitados o comunicaciones de acoso' : 'Send spam, unsolicited messages, or harassing communications'}</li>
            <li>{es ? 'Violar cualquier ley o reglamento aplicable' : 'Violate any applicable law or regulation'}</li>
            <li>{es ? 'Hacerse pasar por otra persona o negocio' : 'Impersonate another person or business'}</li>
            <li>{es ? 'Intentar obtener acceso no autorizado a cualquier parte de la plataforma' : 'Attempt to gain unauthorized access to any part of the platform'}</li>
            <li>{es ? 'Usar la plataforma para cualquier fin distinto a la gestión legítima de un negocio' : 'Use the platform for any purpose other than legitimate business management'}</li>
          </ul>
          <p className="mt-2">{es ? 'Las violaciones pueden resultar en la terminación inmediata de la cuenta sin reembolso.' : 'Violations may result in immediate account termination without refund.'}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{es ? '10. Responsabilidades del Usuario' : '10. User Responsibilities'}</h2>
          <p>{es
            ? 'Los proveedores de servicio son responsables de obtener el consentimiento apropiado de sus clientes antes de ingresar su información de contacto en YardSync. Asimismo, los proveedores son responsables de manejar la información que los posibles clientes envían a través de su formulario público —incluyendo nombre, teléfono, correo y dirección— conforme a la ley aplicable, y de contactar a esos prospectos solo según lo permita la ley. Los usuarios aceptan no usar la plataforma para spam, acoso ni ningún fin ilícito.'
            : 'Service providers are responsible for obtaining appropriate consent from their clients before entering client contact information into YardSync. Service providers are likewise responsible for handling information submitted by prospective clients through their public intake form — including name, phone, email, and address — in accordance with applicable law, and for contacting those prospects only as permitted by law. Users agree not to use the platform for spam, harassment, or any unlawful purpose.'}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{es ? '11. Terminación de la Cuenta' : '11. Account Termination'}</h2>
          <p>{es
            ? 'JNew Technologies se reserva el derecho de suspender o terminar cualquier cuenta que viole estos Términos, con o sin aviso. Las cuentas terminadas por causa justificada no son elegibles para reembolsos. Los proveedores de servicio pueden cancelar su propia suscripción en cualquier momento según la Sección 4.'
            : 'JNew Technologies reserves the right to suspend or terminate any account that violates these Terms, with or without notice. Terminated accounts for cause are not eligible for refunds. Service providers may cancel their own subscription at any time per Section 4.'}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{es ? '12. Limitación de Responsabilidad' : '12. Limitation of Liability'}</h2>
          <p>{es
            ? 'JNew Technologies no es responsable de daños indirectos, incidentales o consecuentes que surjan del uso de YardSync. La plataforma se proporciona "tal cual", sin garantías de ningún tipo.'
            : 'JNew Technologies is not liable for indirect, incidental, or consequential damages arising from use of YardSync. The platform is provided as-is without warranties of any kind.'}</p>
          <p className="mt-2">{es
            ? 'Sin limitar la Sección 5, JNew Technologies no es responsable de ningún pago de cliente, reembolso, contracargo o disputa, todos los cuales son responsabilidad exclusiva del proveedor de servicio como comerciante registrado.'
            : 'Without limiting Section 5, JNew Technologies is not liable for any client payment, refund, chargeback, or dispute, all of which are the sole responsibility of the service provider as merchant of record.'}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{es ? '13. Indemnización' : '13. Indemnification'}</h2>
          <p>{es
            ? 'Usted acepta indemnizar y eximir de responsabilidad a JNew Technologies, sus directivos, directores y empleados de cualquier reclamo, daño o gasto que surja de su uso de YardSync, de su violación de estos Términos o de su violación de los derechos de cualquier tercero.'
            : 'You agree to indemnify and hold harmless JNew Technologies, its officers, directors, and employees from any claims, damages, or expenses arising from your use of YardSync, your violation of these Terms, or your violation of any third-party rights.'}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{es ? '14. Fuerza Mayor' : '14. Force Majeure'}</h2>
          <p>{es
            ? 'JNew Technologies no es responsable de ninguna falla o retraso en la prestación de la plataforma debido a causas fuera de su control razonable, incluyendo, entre otras, interrupciones de servicios de terceros (Stripe, Twilio, Firebase, Anthropic), interrupciones de internet o desastres naturales.'
            : 'JNew Technologies is not liable for any failure or delay in providing the platform due to causes beyond its reasonable control, including but not limited to outages of third-party services (Stripe, Twilio, Firebase, Anthropic), internet disruptions, or natural disasters.'}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{es ? '15. Resolución de Disputas y Ley Aplicable' : '15. Dispute Resolution and Governing Law'}</h2>
          <p>{es
            ? 'Estos Términos se rigen por las leyes del Estado de Texas, sin tomar en cuenta los principios de conflicto de leyes. Cualquier disputa que surja de estos Términos se resolverá mediante arbitraje vinculante en el Condado de Bexar, Texas, bajo las reglas de la Asociación Americana de Arbitraje (American Arbitration Association). Usted renuncia a cualquier derecho de participar en una demanda colectiva o en un arbitraje colectivo contra JNew Technologies.'
            : 'These Terms are governed by the laws of the State of Texas, without regard to conflict of law principles. Any dispute arising from these Terms shall be resolved by binding arbitration in Bexar County, Texas, under the rules of the American Arbitration Association. You waive any right to participate in a class action lawsuit or class-wide arbitration against JNew Technologies.'}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{es ? '16. Cambios a los Términos' : '16. Changes to Terms'}</h2>
          <p>{es
            ? 'Podemos actualizar estos términos en cualquier momento. El uso continuo de YardSync después de los cambios constituye la aceptación de los nuevos términos. Los cambios materiales a la tarifa de aplicación de la plataforma o a la cuota de suscripción para cuentas nuevas se publicarán aquí al menos 30 días antes de entrar en vigor.'
            : 'We may update these terms at any time. Continued use of YardSync after changes constitutes acceptance of the new terms. Material changes to the platform application fee or subscription fee for new accounts will be posted here at least 30 days before taking effect.'}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{es ? '17. Disposiciones Generales' : '17. General'}</h2>
          <p>{es
            ? 'Si alguna disposición de estos Términos se considera inaplicable, las disposiciones restantes permanecen en pleno vigor (divisibilidad). El hecho de que YardSync no haga valer algún derecho no constituye una renuncia a ese derecho. Estos Términos constituyen el acuerdo completo entre usted y JNew Technologies respecto a su uso de YardSync.'
            : 'If any provision of these Terms is found unenforceable, the remaining provisions remain in full effect (severability). YardSync’s failure to enforce any right is not a waiver of that right. These Terms constitute the entire agreement between you and JNew Technologies regarding your use of YardSync.'}</p>
        </div>

        {/* PENDING LEGAL REVIEW (added 2026-06-30): Quotes, ESIGN/UETA electronic signatures, and deposits — draft language, counsel to confirm (incl. ESIGN/UETA consent-to-transact-electronically requirements + deposit refundability set by contractor). */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{es ? '18. Cotizaciones, Firmas Electrónicas y Depósitos' : '18. Quotes, Electronic Signatures, and Deposits'}</h2>
          <p>{es
            ? <><strong>Cotizaciones y firmas electrónicas.</strong> Los proveedores de servicio pueden enviar cotizaciones a sus clientes a través de YardSync. Cuando un cliente acepta una cotización escribiendo su nombre y marcando la casilla de "Acepto", esa acción constituye su firma electrónica y forma un acuerdo vinculante con el proveedor de servicio bajo la Ley federal ESIGN y la Ley Uniforme de Transacciones Electrónicas (UETA). Al aceptar de esta manera, el cliente da su consentimiento para realizar esta transacción por medios electrónicos y acepta que su firma electrónica tiene el mismo efecto legal que una firma manuscrita. YardSync registra y conserva metadatos de la firma —incluyendo el nombre escrito, la fecha y hora, la dirección IP y el agente de usuario (navegador/dispositivo)— como evidencia del acuerdo. YardSync facilita esta función únicamente como herramienta tecnológica; el acuerdo es entre el proveedor de servicio y su cliente, y YardSync no es parte de él.</>
            : <><strong>Quotes and electronic signatures.</strong> Service providers may send quotes to their clients through YardSync. When a client accepts a quote by typing their name and checking the "I agree" box, that action constitutes their electronic signature and forms a binding agreement with the service provider under the federal ESIGN Act and the Uniform Electronic Transactions Act (UETA). By accepting in this way, the client consents to transact electronically and agrees that their electronic signature has the same legal effect as a handwritten signature. YardSync records and retains signature metadata — including the typed name, timestamp, IP address, and user-agent (browser/device) — as evidence of the agreement. YardSync facilitates this feature solely as a technology tool; the agreement is between the service provider and their client, and YardSync is not a party to it.</>}</p>
          <p className="mt-2">{es
            ? <><strong>Depósitos y prepago.</strong> Un proveedor de servicio puede exigir un depósito o el pago completo por adelantado como condición para aceptar una cotización. Los depósitos son cobrados por el proveedor de servicio como comerciante registrado mediante un cargo directo en su cuenta de Stripe conectada, igual que cualquier otra factura (ver Sección 5). <strong>La política de reembolso de un depósito la establece cada proveedor de servicio de forma individual, no YardSync;</strong> YardSync únicamente facilita el cobro y no determina si un depósito es reembolsable ni administra su devolución. La tarifa de aplicación del 5.5% que se aplica a un depósito no es reembolsable y la conserva JNew Technologies, de forma consistente con la Sección 5, incluso si el proveedor reembolsa el depósito. Un depósito pagado se acredita al total del trabajo, y el saldo restante se factura por separado.</>
            : <><strong>Deposits and prepayment.</strong> A service provider may require a deposit or full prepayment as a condition of accepting a quote. Deposits are charged by the service provider as merchant of record via a direct charge on their connected Stripe account, the same as any other invoice (see Section 5). <strong>Deposit refundability is set by the individual service provider, not YardSync;</strong> YardSync only facilitates the charge and does not determine whether a deposit is refundable or administer its return. The 5.5% application fee applied to a deposit is non-refundable and retained by JNew Technologies, consistent with Section 5, even if the provider refunds the deposit. A paid deposit is credited toward the job total, and the remaining balance is billed separately.</>}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{es ? '19. Contacto' : '19. Contact'}</h2>
          <p>{es ? 'Para preguntas sobre estos términos: ' : 'For questions about these terms: '}<a href="mailto:support@yardsyncapp.com" className="text-green-700 underline">support@yardsyncapp.com</a></p>
        </div>

      </section>
    </div>
  )
}
