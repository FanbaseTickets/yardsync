export const translations = {
  en: {
    // Navigation
    nav: {
      home:     'Home',
      calendar: 'Calendar',
      clients:  'Clients',
      services: 'Services',
      sms:      'SMS',
    },
    // Dashboard
    dashboard: {
      greeting_morning:   'Good morning',
      greeting_afternoon: 'Good afternoon',
      greeting_evening:   'Good evening',
      jobs_today:         'jobs today',
      job_today:          'job today',
      active_clients:     'Active clients',
      this_month:         'This month',
      jobs_today_stat:    'Jobs today',
      sms_sent:           'SMS sent',
      todays_schedule:    "Today's schedule",
      view_calendar:      'View calendar',
      no_jobs:            'No jobs scheduled today',
      add_to_calendar:    'Add to calendar',
      completed:          'Completed ✓',
      done:               'Done',
      unpaid_invoices:    'unpaid invoice',
      unpaid_invoices_pl: 'unpaid invoices',
      tap_to_review:      'Tap to review',
    },
    // Clients
    clients: {
      title:          'Clients',
      active:         'active',
      inactive:       'inactive',
      add:            'Add',
      search:         'Search by name or address...',
      no_clients:     'No clients yet',
      no_match:       'No clients match your search',
      add_first:      'Add your first client to get started',
      try_different:  'Try a different name or address',
      add_first_btn:  'Add first client',
      base:           'base',
      add_client:     'Add client',
      full_name:      'Full name',
      phone:          'Phone',
      email:          'Email',
      address:        'Service address',
      package:        'Package',
      select_package: '— Select a package —',
      billing_mode:   'Billing mode',
      notes:          'Notes (optional)',
      notes_hint:     'Gate code, preferences...',
      cancel:         'Cancel',
      no_packages:    'No packages set up yet',
      go_to_services: 'Go to Services →',
      client_pays:    'Client pays',
    },
    // Client detail
    client_detail: {
      edit:             'Edit client',
      remove:           'Remove this client',
      billing:          'Billing',
      base_price:       'Base price',
      yardsync_fee:     'YardSync fee',
      client_pays:      'Client pays',
      fee_structure:    'Fee structure',
      billing_mode:     'Billing mode',
      send_invoice:     'Send Square invoice',
      send_invoice_one: 'Send invoice',
      invoice_history:  'Invoice history',
      no_invoices:      'No invoices yet',
      save_changes:     'Save changes',
      remove_confirm:   'Are you sure you want to remove',
      cannot_undo:      'This cannot be undone.',
      package:          'Package',
      keep_current:     '— Keep current package —',
      status:           'Status',
      notes:            'Notes',
    },
    // Calendar
    calendar: {
      title:       'Calendar',
      jobs_in:     'jobs in',
      tap_day:     'Tap a day to view or add jobs',
      dots_show:   'Dots show scheduled visits · Numbers show multiple jobs',
      add_job:     'Add job',
      no_jobs:     'No jobs scheduled',
      client:      'Client',
      time:        'Time',
      repeat:      'Repeat',
      occurrences: 'Number of visits to schedule',
      preview:     'Preview scheduled dates →',
      hide:        'Hide',
      schedule:    'Schedule',
      visits:      'visits',
      recurring:   'Recurring',
      remove_visit:     'Remove visit',
      remove_one:       'Remove just this visit',
      remove_all:       'Remove all future visits',
      recurring_warning: 'This is a recurring visit for',
      completed_note:   'Completed visits will not be affected.',
    },
    // Services
    services: {
      title:           'Services',
      subtitle:        'Base packages + add-ons',
      add:             'Add',
      base_packages:   'Base packages',
      addons:          'Add-on services',
      no_base:         'No base packages yet',
      no_addons:       'No add-ons yet',
      add_base:        'Add base package',
      add_first:       'Add first service',
      service_type:    'Service type',
      package_type:    'Package type',
      visit_schedule:  'Visit schedule',
      preferred_day:   'Preferred visit day',
      package_name:    'Package name',
      description:     'Description',
      whats_included:  "What's included",
      base_price:      'Your base price',
      pricing_type:    'Pricing type',
      service_name:    'Service name',
      price:           'Price',
      add_service:     'Add service',
      save_changes:    'Save changes',
      cancel:          'Cancel',
      edit_service:    'Edit service',
      fee_structure:   'YardSync fee structure',
    },
    // SMS
    sms: {
      title:           'SMS Reminders',
      subtitle:        'Auto-sent before each visit',
      sms_sent:        'SMS sent',
      pending:         'Pending reminders',
      connected:       'Connected · SMS will send when you tap Send',
      not_connected:   'Add Twilio credentials in Settings to enable',
      message_template:'Message template',
      edit:            'Edit',
      done:            'Done',
      variables:       'Variables:',
      upcoming:        'Upcoming visits',
      no_upcoming:     'No upcoming visits',
      add_jobs:        'Add jobs to the calendar to see SMS reminders here',
      sms_sent_check:  'SMS sent ✓',
      sms_pending:     'SMS pending',
      send:            'Send',
      resend:          'Resend',
      showing_next:    'Showing next 10 days · View calendar for full schedule',
    },
    // Settings
    settings: {
      title:           'Settings',
      subtitle:        'Your profile & preferences',
      profile:         'Profile',
      your_name:       'Your name',
      business_name:   'Business name',
      phone:           'Phone number',
      language:        'Language',
      app_language:    'App language',
      sms_note:        'Controls the app display language. SMS language is set per client.',
      reminders:       'SMS Reminders',
      send_reminders:  'Send reminders',
      english_template:'English template',
      spanish_template:'Spanish template',
      variables:       'Variables:',
      subscription:    'Subscription',
      active:          'YardSync — Active',
      fee_note:        'Your clients are automatically charged the YardSync platform fee on every invoice.',
      save:            'Save settings',
      saved:           'Settings saved',
      footer:          'YardSync · A JNew Technologies platform',
      reminder_24:     '24 hours before',
      reminder_48:     '48 hours before',
      reminder_72:     '72 hours before',
      reminder_0:      'Day of visit',
      reminder_all:    'All of the above',
      fee_monthly:     'Monthly',
      fee_quarterly:   'Quarterly',
      fee_annual:      'Annual',
      fee_weekly:      'Weekly',
      fee_onetime:     'One-time',
      fee_addons:      'Add-ons',
    },
    // Onboarding
    onboarding: {
      title:         'Get started with YardSync',
      subtitle:      'Complete these steps to start managing your business',
      step_card:     'Add a card on file',
      step_square:   'Connect Square account',
      step_service:  'Create a service package',
      step_client:   'Add your first client',
      step_schedule: 'Schedule your first job',
      progress:      'steps complete',
      dismiss:       'Got it, hide checklist',
    },
    // Package types
    packages: {
      monthly:   'Monthly',
      weekly:    'Weekly',
      quarterly: 'Quarterly',
      annual:    'Annual',
      onetime:   'One-time',
      biweekly:  'Biweekly',
    },
    // Common
    common: {
      cancel:   'Cancel',
      save:     'Save',
      remove:   'Remove',
      edit:     'Edit',
      add:      'Add',
      loading:  'Loading YardSync...',
      error:    'Something went wrong',
      upfront:  'Upfront',
      active:   'Active',
      active_pl:'Active',
      paused:   'Paused',
      cancelled:'Cancelled',
      yardsync_fee: 'YardSync fee',
      optional: '(Optional)',
    },
  },

  es: {
    // Navigation
    nav: {
      home:     'Inicio',
      calendar: 'Calendario',
      clients:  'Clientes',
      services: 'Servicios',
      sms:      'SMS',
    },
    // Dashboard
    dashboard: {
      greeting_morning:   'Buenos días',
      greeting_afternoon: 'Buenas tardes',
      greeting_evening:   'Buenas noches',
      jobs_today:         'trabajos hoy',
      job_today:          'trabajo hoy',
      active_clients:     'Clientes activos',
      this_month:         'Este mes',
      jobs_today_stat:    'Trabajos hoy',
      sms_sent:           'SMS enviados',
      todays_schedule:    'Horario de hoy',
      view_calendar:      'Ver calendario',
      no_jobs:            'No hay trabajos programados hoy',
      add_to_calendar:    'Agregar al calendario',
      completed:          'Completado ✓',
      done:               'Listo',
      unpaid_invoices:    'factura sin pagar',
      unpaid_invoices_pl: 'facturas sin pagar',
      tap_to_review:      'Toca para revisar',
    },
    // Clients
    clients: {
      title:          'Clientes',
      active:         'activo',
      inactive:       'inactivo',
      add:            'Agregar',
      search:         'Buscar por nombre o dirección...',
      no_clients:     'Sin clientes aún',
      no_match:       'Ningún cliente coincide con tu búsqueda',
      add_first:      'Agrega tu primer cliente para comenzar',
      try_different:  'Intenta un nombre o dirección diferente',
      add_first_btn:  'Agregar primer cliente',
      base:           'base',
      add_client:     'Agregar cliente',
      full_name:      'Nombre completo',
      phone:          'Teléfono',
      email:          'Correo electrónico',
      address:        'Dirección de servicio',
      package:        'Paquete',
      select_package: '— Seleccionar paquete —',
      billing_mode:   'Modo de facturación',
      notes:          'Notas (opcional)',
      notes_hint:     'Código de puerta, preferencias...',
      cancel:         'Cancelar',
      no_packages:    'No hay paquetes configurados aún',
      go_to_services: 'Ir a Servicios →',
      client_pays:    'El cliente paga',
    },
    // Client detail
    client_detail: {
      edit:             'Editar cliente',
      remove:           'Eliminar este cliente',
      billing:          'Facturación',
      base_price:       'Precio base',
      yardsync_fee:     'Tarifa YardSync',
      client_pays:      'El cliente paga',
      fee_structure:    'Estructura de tarifa',
      billing_mode:     'Modo de facturación',
      send_invoice:     'Enviar factura Square',
      send_invoice_one: 'Enviar factura',
      invoice_history:  'Historial de facturas',
      no_invoices:      'Sin facturas aún',
      save_changes:     'Guardar cambios',
      remove_confirm:   '¿Estás seguro de que quieres eliminar a',
      cannot_undo:      'Esto no se puede deshacer.',
      package:          'Paquete',
      keep_current:     '— Mantener paquete actual —',
      status:           'Estado',
      notes:            'Notas',
    },
    // Calendar
    calendar: {
      title:       'Calendario',
      jobs_in:     'trabajos en',
      tap_day:     'Toca un día para ver o agregar trabajos',
      dots_show:   'Los puntos muestran visitas · Los números muestran múltiples trabajos',
      add_job:     'Agregar trabajo',
      no_jobs:     'No hay trabajos programados',
      client:      'Cliente',
      time:        'Hora',
      repeat:      'Repetir',
      occurrences: 'Número de visitas a programar',
      preview:     'Ver fechas programadas →',
      hide:        'Ocultar',
      schedule:    'Programar',
      visits:      'visitas',
      recurring:   'Recurrente',
      remove_visit:      'Eliminar visita',
      remove_one:        'Eliminar solo esta visita',
      remove_all:        'Eliminar todas las visitas futuras',
      recurring_warning: 'Esta es una visita recurrente para',
      completed_note:    'Las visitas completadas no se verán afectadas.',
    },
    // Services
    services: {
      title:           'Servicios',
      subtitle:        'Paquetes base + adicionales',
      add:             'Agregar',
      base_packages:   'Paquetes base',
      addons:          'Servicios adicionales',
      no_base:         'Sin paquetes base aún',
      no_addons:       'Sin servicios adicionales aún',
      add_base:        'Agregar paquete base',
      add_first:       'Agregar primer servicio',
      service_type:    'Tipo de servicio',
      package_type:    'Tipo de paquete',
      visit_schedule:  'Horario de visitas',
      preferred_day:   'Día de visita preferido',
      package_name:    'Nombre del paquete',
      description:     'Descripción',
      whats_included:  'Qué incluye',
      base_price:      'Tu precio base',
      pricing_type:    'Tipo de precio',
      service_name:    'Nombre del servicio',
      price:           'Precio',
      add_service:     'Agregar servicio',
      save_changes:    'Guardar cambios',
      cancel:          'Cancelar',
      edit_service:    'Editar servicio',
      fee_structure:   'Estructura de tarifas YardSync',
    },
    // SMS
    sms: {
      title:           'Recordatorios SMS',
      subtitle:        'Enviados automáticamente antes de cada visita',
      sms_sent:        'SMS enviados',
      pending:         'Recordatorios pendientes',
      connected:       'Conectado · El SMS se enviará cuando toques Enviar',
      not_connected:   'Agrega credenciales de Twilio en Configuración',
      message_template:'Plantilla de mensaje',
      edit:            'Editar',
      done:            'Listo',
      variables:       'Variables:',
      upcoming:        'Próximas visitas',
      no_upcoming:     'Sin próximas visitas',
      add_jobs:        'Agrega trabajos al calendario para ver recordatorios aquí',
      sms_sent_check:  'SMS enviado ✓',
      sms_pending:     'SMS pendiente',
      send:            'Enviar',
      resend:          'Reenviar',
      showing_next:    'Mostrando los próximos 10 días · Ver calendario para horario completo',
    },
    // Settings
    settings: {
      title:           'Configuración',
      subtitle:        'Tu perfil y preferencias',
      profile:         'Perfil',
      your_name:       'Tu nombre',
      business_name:   'Nombre del negocio',
      phone:           'Número de teléfono',
      language:        'Idioma',
      app_language:    'Idioma de la aplicación',
      sms_note:        'Controla el idioma de la aplicación. El idioma de SMS se configura por cliente.',
      reminders:       'Recordatorios SMS',
      send_reminders:  'Enviar recordatorios',
      english_template:'Plantilla en inglés',
      spanish_template:'Plantilla en español',
      variables:       'Variables:',
      subscription:    'Suscripción',
      active:          'YardSync — Activo',
      fee_note:        'A tus clientes se les cobra automáticamente la tarifa de la plataforma YardSync en cada factura.',
      save:            'Guardar configuración',
      saved:           'Configuración guardada',
      footer:          'YardSync · Una plataforma de JNew Technologies',
      reminder_24:     '24 horas antes',
      reminder_48:     '48 horas antes',
      reminder_72:     '72 horas antes',
      reminder_0:      'Día de la visita',
      reminder_all:    'Todos los anteriores',
      fee_monthly:     'Mensual',
      fee_quarterly:   'Trimestral',
      fee_annual:      'Anual',
      fee_weekly:      'Semanal',
      fee_onetime:     'Una vez',
      fee_addons:      'Adicionales',
    },
    // Onboarding
    onboarding: {
      title:         'Comienza con YardSync',
      subtitle:      'Completa estos pasos para empezar a gestionar tu negocio',
      step_card:     'Agregar tarjeta de pago',
      step_square:   'Conectar cuenta de Square',
      step_service:  'Crear un paquete de servicio',
      step_client:   'Agregar tu primer cliente',
      step_schedule: 'Programar tu primer trabajo',
      progress:      'pasos completados',
      dismiss:       'Entendido, ocultar lista',
    },
    // Package types
    packages: {
      monthly:   'Mensual',
      weekly:    'Semanal',
      quarterly: 'Trimestral',
      annual:    'Anual',
      onetime:   'Una vez',
      biweekly:  'Quincenal',
    },
    // Common
    common: {
      cancel:   'Cancelar',
      save:     'Guardar',
      remove:   'Eliminar',
      edit:     'Editar',
      add:      'Agregar',
      loading:  'Cargando YardSync...',
      error:    'Algo salió mal',
      upfront:  'Por adelantado',
      active:   'Activo',
      active_pl:'Activos',
      paused:   'Pausado',
      cancelled:'Cancelado',
      yardsync_fee: 'tarifa YardSync',
      optional: '(Opcional)',
    },
  },
}

export function t(lang, section, key) {
  return translations[lang]?.[section]?.[key] || translations['en']?.[section]?.[key] || key
}

// Localized date formatting
export function formatDateLocalized(date, formatStr, lang = 'en') {
  const d = date instanceof Date ? date : new Date(date)
  if (isNaN(d)) return String(date)
  const locale = lang === 'es' ? 'es-MX' : 'en-US'

  // Full readable: "Sunday, March 22" or "Domingo, 22 de marzo"
  if (formatStr === 'EEEE, MMMM d' || formatStr === 'full_weekday_date') {
    if (lang === 'es') {
      const day = d.toLocaleDateString('es-MX', { weekday: 'long' })
      const num = d.getDate()
      const month = d.toLocaleDateString('es-MX', { month: 'long' })
      return `${day.charAt(0).toUpperCase() + day.slice(1)}, ${num} de ${month}`
    }
    const day = d.toLocaleDateString('en-US', { weekday: 'long' })
    const month = d.toLocaleDateString('en-US', { month: 'long' })
    return `${day}, ${month} ${d.getDate()}`
  }

  // Long date: "March 22, 2026" or "22 de marzo de 2026"
  if (formatStr === 'MMMM d, yyyy' || formatStr === 'long_date') {
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
  }

  // Month year: "March 2026" or "marzo 2026"
  if (formatStr === 'MMMM yyyy' || formatStr === 'month_year') {
    return d.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  }

  // Short date: "Mar 22, 2026" or "22 mar 2026"
  if (formatStr === 'MMM d, yyyy' || formatStr === 'short_date') {
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
  }

  // Weekday + month day: "EEEE, MMMM d" for SMS day headers
  if (formatStr === 'day_month') {
    if (lang === 'es') {
      const day = d.toLocaleDateString('es-MX', { weekday: 'long' })
      const num = d.getDate()
      const month = d.toLocaleDateString('es-MX', { month: 'long' })
      return `${day.charAt(0).toUpperCase() + day.slice(1)}, ${num} de ${month}`
    }
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  }

  // Fallback to Intl
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
}

// Format date for SMS message content based on client language
export function formatDateForSMS(dateStr, clientLang = 'en') {
  const d = new Date(dateStr + 'T12:00:00')
  if (isNaN(d)) return dateStr
  const locale = clientLang === 'es' ? 'es-MX' : 'en-US'
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
}