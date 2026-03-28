export type Lang = 'en' | 'es';

export const translations = {
  en: {
    nav: {
      features: 'Features',
      howItWorks: 'How It Works',
      pricing: 'Pricing',
      faq: 'FAQ',
      cta: 'Request a Demo',
    },
    hero: {
      headline: 'Your AI Reservations Desk.\nAlways On. Always Ready.',
      subheadline:
        'Capture more direct bookings by phone. Support your front desk 24/7. No setup fee — pay only on results.',
      cta: 'Request a Demo',
      ctaSecondary: 'See How It Works',
    },
    positioning: {
      title: 'Built for Hotel Revenue Teams',
      text: 'Every missed call is a missed booking. Our AI Reservations Desk answers every inbound call, qualifies booking intent, handles routine guest questions, and transfers complex requests to your team — around the clock, in multiple languages. Not a chatbot. Not a call center. A performance layer for your reservations line.',
    },
    benefits: {
      title: 'What It Does for Your Hotel',
      items: [
        {
          title: 'Capture More Direct Bookings',
          text: 'Every call is answered, every booking opportunity is handled. No more lost revenue from missed or abandoned calls.',
        },
        {
          title: 'Reduce Missed Calls to Zero',
          text: '24/7 phone coverage means no call goes unanswered — during peak hours, overnight, or on holidays.',
        },
        {
          title: 'Support Your Front Desk',
          text: 'Free your team from repetitive phone inquiries so they can focus on the guest experience on-site.',
        },
        {
          title: 'Handle Guest Questions Instantly',
          text: 'Check-in times, parking, amenities, directions — answered immediately, without putting guests on hold.',
        },
        {
          title: 'Transfer Complex Requests to Staff',
          text: 'When a guest needs human attention, the call is routed seamlessly to the right person at your hotel.',
        },
        {
          title: 'Multilingual by Default',
          text: 'Serve international guests in their language. No additional setup, no language barriers on the phone.',
        },
      ],
    },
    howItWorks: {
      title: 'How It Works',
      steps: [
        {
          number: '01',
          title: 'Connect Your Line',
          text: 'We set up your dedicated AI reservations number or forward your existing line. No hardware, no software to install.',
        },
        {
          number: '02',
          title: 'Calls Are Handled Intelligently',
          text: 'The AI answers, qualifies booking intent, provides information, and captures reservation details — naturally and professionally.',
        },
        {
          number: '03',
          title: 'Staff Stays in Control',
          text: 'Complex requests and VIP calls are transferred to your team in real time. You set the rules for when and how.',
        },
        {
          number: '04',
          title: 'You See the Results',
          text: 'Track every call, booking, and revenue impact from your dashboard. Full transparency, no guesswork.',
        },
      ],
    },
    pricing: {
      title: 'Simple, Performance-Based Pricing',
      setup: '€0',
      setupLabel: 'Setup Fee',
      fee: '2.5%',
      feeLabel: 'Success Fee',
      feeSublabel: 'on AI-attributed confirmed room revenue',
      highlights: [
        'No upfront cost',
        'No monthly subscription',
        'We only earn when your hotel earns',
        'Cancel anytime',
      ],
      cta: 'Get Started',
      disclaimer:
        'The 2.5% success fee applies only to net room revenue from confirmed reservations attributed to the platform. Excludes VAT, city tax, OTA bookings, extras, manual bookings not attributed to the AI, cancellations, and no-shows. Commission is billed on stayed bookings or non-refundable charged bookings.',
    },
    faq: {
      title: 'Frequently Asked Questions',
      items: [
        {
          q: 'Does this replace my front desk or reservations team?',
          a: 'No. The AI Reservations Desk supports your team — it handles routine calls and captures bookings when staff are busy or unavailable. Complex requests are always transferred to your team.',
        },
        {
          q: 'What happens if a guest needs to speak to a person?',
          a: 'The call is transferred instantly to the appropriate staff member. You define the transfer rules — by request type, time of day, or VIP status.',
        },
        {
          q: 'How long does setup take?',
          a: 'Most hotels are live within days. No hardware to install, no software to configure. We handle the technical setup.',
        },
        {
          q: 'What languages does it support?',
          a: 'The system handles calls in multiple languages automatically. It detects the guest\'s language and responds naturally — no manual configuration required.',
        },
        {
          q: 'What does "AI-attributed confirmed room revenue" mean?',
          a: 'It means we only charge our success fee on room revenue from reservations that the AI directly helped create, and only after the guest has stayed or the booking is non-refundable. We don\'t charge on cancellations, no-shows, OTA bookings, taxes, or extras.',
        },
        {
          q: 'Can I cancel at any time?',
          a: 'Yes. No long-term contracts, no cancellation fees. If the platform is not delivering value, you can stop at any time.',
        },
        {
          q: 'How do I track performance?',
          a: 'You get access to a real-time dashboard with full visibility into every call, booking, and revenue metric. No reporting gaps.',
        },
        {
          q: 'Is there a minimum number of rooms or calls required?',
          a: 'No. The platform works for boutique hotels, city properties, and resort groups. Pricing scales with your results, not your size.',
        },
      ],
    },
    finalCta: {
      headline: 'Stop Losing Bookings to Missed Calls',
      text: 'See how the AI Reservations Desk can work for your hotel. No commitment, no setup fee.',
      cta: 'Request a Demo',
    },
    footer: {
      copy: '© 2026 Hotel Voice Agent. All rights reserved.',
    },
  },

  es: {
    nav: {
      features: 'Funcionalidades',
      howItWorks: 'Cómo Funciona',
      pricing: 'Precios',
      faq: 'Preguntas',
      cta: 'Solicitar Demo',
    },
    hero: {
      headline: 'Tu Central de Reservas IA.\nSiempre Activa. Siempre Lista.',
      subheadline:
        'Captura más reservas directas por teléfono. Apoya a tu recepción 24/7. Sin coste de alta — pagas solo por resultados.',
      cta: 'Solicitar Demo',
      ctaSecondary: 'Ver Cómo Funciona',
    },
    positioning: {
      title: 'Diseñado para Equipos de Revenue Hotelero',
      text: 'Cada llamada perdida es una reserva perdida. Nuestra Central de Reservas IA atiende todas las llamadas entrantes, cualifica la intención de reserva, responde las consultas habituales de los huéspedes y transfiere las solicitudes complejas a tu equipo — las 24 horas, en varios idiomas. No es un chatbot. No es un call center. Es una capa de rendimiento para tu línea de reservas.',
    },
    benefits: {
      title: 'Qué Aporta a Tu Hotel',
      items: [
        {
          title: 'Captura Más Reservas Directas',
          text: 'Cada llamada se atiende, cada oportunidad de reserva se gestiona. No más ingresos perdidos por llamadas sin contestar.',
        },
        {
          title: 'Reduce las Llamadas Perdidas a Cero',
          text: 'Cobertura telefónica 24/7: ninguna llamada queda sin respuesta, ni en horas punta, ni de noche, ni en festivos.',
        },
        {
          title: 'Apoya a Tu Recepción',
          text: 'Libera a tu equipo de consultas telefónicas repetitivas para que se concentren en la experiencia del huésped en el hotel.',
        },
        {
          title: 'Responde al Instante a los Huéspedes',
          text: 'Horarios de check-in, parking, servicios, cómo llegar — todo se responde de inmediato, sin poner al huésped en espera.',
        },
        {
          title: 'Transfiere Solicitudes Complejas al Equipo',
          text: 'Cuando un huésped necesita atención humana, la llamada se redirige de forma natural a la persona adecuada de tu hotel.',
        },
        {
          title: 'Multilingüe de Serie',
          text: 'Atiende a huéspedes internacionales en su idioma. Sin configuración adicional, sin barreras lingüísticas al teléfono.',
        },
      ],
    },
    howItWorks: {
      title: 'Cómo Funciona',
      steps: [
        {
          number: '01',
          title: 'Conecta Tu Línea',
          text: 'Configuramos tu número de reservas IA dedicado o redirigimos tu línea actual. Sin hardware, sin software que instalar.',
        },
        {
          number: '02',
          title: 'Las Llamadas Se Gestionan de Forma Inteligente',
          text: 'La IA atiende, cualifica la intención de reserva, proporciona información y captura los datos de la reserva — de forma natural y profesional.',
        },
        {
          number: '03',
          title: 'Tu Equipo Mantiene el Control',
          text: 'Las solicitudes complejas y las llamadas VIP se transfieren a tu equipo en tiempo real. Tú defines las reglas.',
        },
        {
          number: '04',
          title: 'Ves los Resultados',
          text: 'Controla cada llamada, reserva e impacto en ingresos desde tu panel. Transparencia total, sin conjeturas.',
        },
      ],
    },
    pricing: {
      title: 'Precio Simple, Basado en Resultados',
      setup: '€0',
      setupLabel: 'Coste de Alta',
      fee: '2,5%',
      feeLabel: 'Comisión de Éxito',
      feeSublabel: 'sobre ingresos netos de habitación confirmados y atribuidos a la IA',
      highlights: [
        'Sin coste inicial',
        'Sin suscripción mensual',
        'Solo ganamos cuando tu hotel gana',
        'Cancela en cualquier momento',
      ],
      cta: 'Empezar Ahora',
      disclaimer:
        'La comisión del 2,5% se aplica únicamente sobre los ingresos netos de habitación de reservas confirmadas atribuidas a la plataforma. Excluye IVA, tasa turística, reservas de OTAs, extras, reservas manuales no atribuidas a la IA, cancelaciones y no-shows. La comisión se factura sobre estancias realizadas o reservas no reembolsables cobradas.',
    },
    faq: {
      title: 'Preguntas Frecuentes',
      items: [
        {
          q: '¿Esto sustituye a mi equipo de recepción o reservas?',
          a: 'No. La Central de Reservas IA apoya a tu equipo — gestiona llamadas rutinarias y captura reservas cuando el personal está ocupado o no disponible. Las solicitudes complejas siempre se transfieren a tu equipo.',
        },
        {
          q: '¿Qué pasa si un huésped necesita hablar con una persona?',
          a: 'La llamada se transfiere de inmediato al miembro del equipo adecuado. Tú defines las reglas de transferencia: por tipo de solicitud, franja horaria o estatus VIP.',
        },
        {
          q: '¿Cuánto tarda la puesta en marcha?',
          a: 'La mayoría de hoteles están operativos en días. No hay hardware que instalar ni software que configurar. Nosotros nos encargamos de la parte técnica.',
        },
        {
          q: '¿Qué idiomas soporta?',
          a: 'El sistema atiende llamadas en varios idiomas de forma automática. Detecta el idioma del huésped y responde de forma natural, sin configuración manual.',
        },
        {
          q: '¿Qué significa "ingresos netos de habitación confirmados y atribuidos a la IA"?',
          a: 'Significa que solo cobramos nuestra comisión sobre los ingresos de habitación de reservas que la IA ha ayudado directamente a generar, y solo después de que el huésped haya realizado la estancia o la reserva sea no reembolsable. No cobramos por cancelaciones, no-shows, reservas de OTAs, impuestos ni extras.',
        },
        {
          q: '¿Puedo cancelar en cualquier momento?',
          a: 'Sí. No hay contratos a largo plazo ni penalizaciones por cancelación. Si no aporta valor, puedes dejarlo cuando quieras.',
        },
        {
          q: '¿Cómo puedo hacer seguimiento del rendimiento?',
          a: 'Tienes acceso a un panel en tiempo real con visibilidad completa sobre cada llamada, reserva y métrica de ingresos. Sin lagunas en los informes.',
        },
        {
          q: '¿Hay un mínimo de habitaciones o llamadas?',
          a: 'No. La plataforma funciona para hoteles boutique, urbanos y cadenas. El precio escala con tus resultados, no con tu tamaño.',
        },
      ],
    },
    finalCta: {
      headline: 'Deja de Perder Reservas por Llamadas sin Contestar',
      text: 'Descubre cómo la Central de Reservas IA puede trabajar para tu hotel. Sin compromiso, sin coste de alta.',
      cta: 'Solicitar Demo',
    },
    footer: {
      copy: '© 2026 Hotel Voice Agent. Todos los derechos reservados.',
    },
  },
} as const;

export type Translations = typeof translations.en;
