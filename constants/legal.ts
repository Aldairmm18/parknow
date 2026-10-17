import { env } from '@/config/env';

/**
 * Textos legales de la app.
 *
 * Viven aquí, y no sólo en una página web, porque ambas tiendas exigen que el
 * usuario pueda leerlos **dentro** de la app antes de aceptar, incluso sin
 * conexión. `scripts/build-legal-pages.js` genera con este mismo texto las páginas
 * de `docs/` que se publican en la web (los formularios de App Store Connect
 * y Google Play piden una URL pública).
 *
 * ⚠️ Son una base redactada para una operación de parqueaderos en Colombia
 * sujeta a la Ley 1581 de 2012 y al Decreto 1377 de 2013, con las cláusulas que
 * piden App Store y Google Play. Conviene que los revise un abogado. Si algún
 * día se constituye una empresa, basta con cambiar `LEGAL_ENTITY`.
 */

export const LEGAL_ENTITY = {
  /** Responsable del tratamiento: el desarrollador, como persona natural (igual que en Finance). */
  companyName: 'Aldair Murillo',
  address: 'Medellín, Antioquia, Colombia',
  country: 'Colombia',
  supportEmail: env.supportEmail,
  privacyEmail: env.privacyEmail,
  website: env.legalBaseUrl,
} as const;

/** Fecha de la última revisión; se muestra en la cabecera de cada documento. */
export const LEGAL_LAST_UPDATED = '2026-10-15';
export const LEGAL_VERSION = '1.0.0';

export interface LegalSection {
  heading: string;
  /** Párrafos; los que empiezan por `• ` se pintan como viñetas. */
  paragraphs: string[];
}

export interface LegalDocument {
  title: string;
  subtitle: string;
  lastUpdated: string;
  version: string;
  sections: LegalSection[];
}

const E = LEGAL_ENTITY;

export const PRIVACY_POLICY: LegalDocument = {
  title: 'Política de Privacidad',
  subtitle: `Cómo ${E.companyName} trata tus datos personales en ParkNow`,
  lastUpdated: LEGAL_LAST_UPDATED,
  version: LEGAL_VERSION,
  sections: [
    {
      heading: '1. Quién es el responsable',
      paragraphs: [
        `${E.companyName}, desarrollador de ParkNow, con domicilio en ${E.address}, es el responsable del tratamiento de los datos personales que recogemos a través de la aplicación ParkNow.`,
        `Para cualquier asunto relacionado con tus datos puedes escribirnos a ${E.privacyEmail}. Respondemos en un plazo máximo de quince (15) días hábiles, conforme al artículo 14 de la Ley 1581 de 2012.`,
      ],
    },
    {
      heading: '2. Qué datos recogemos',
      paragraphs: [
        'Sólo recogemos lo que la app necesita para funcionar. En concreto:',
        '• Datos de cuenta: nombre, correo electrónico y número de celular. Si entras con Google, Facebook o Apple, recibimos de ese proveedor tu nombre, tu correo y tu foto de perfil, si la tienes.',
        '• Datos de vehículo: la placa y el tipo de vehículo que indicas al reservar.',
        '• Datos de reserva y pago: parqueadero, fecha, horario, espacio asignado, importe y estado del pago. No almacenamos números de tarjeta: los procesa nuestra pasarela de pagos.',
        '• Ubicación aproximada y precisa: sólo mientras la app está abierta y sólo si nos das permiso, para mostrarte los parqueaderos cercanos y guiarte por la ruta. No rastreamos tu ubicación en segundo plano ni cuando la app está cerrada.',
        '• Datos técnicos: modelo de dispositivo, sistema operativo, versión de la app e identificadores de instalación, para diagnosticar fallos.',
        '• Registros de acceso: entradas y salidas del parqueadero validadas por código QR, con su fecha y hora.',
      ],
    },
    {
      heading: '3. Para qué los usamos y con qué base legal',
      paragraphs: [
        '• Para prestarte el servicio: crear tu cuenta, gestionar reservas, emitir tus códigos QR y controlar el acceso al parqueadero. Base: ejecución del contrato que aceptas al usar la app.',
        '• Para cobrarte y facturarte. Base: ejecución del contrato y obligación legal en materia contable y tributaria.',
        '• Para mostrarte parqueaderos cercanos y calcular rutas. Base: tu consentimiento, que otorgas al conceder el permiso de ubicación y que puedes retirar en los ajustes del teléfono.',
        '• Para avisarte de que tu reserva está por comenzar o por vencer. Base: ejecución del contrato.',
        '• Para prevenir fraude y uso indebido de los códigos de acceso. Base: interés legítimo en la seguridad del servicio.',
        '• Para enviarte novedades y promociones. Base: tu consentimiento expreso y separado. Puedes retirarlo en cualquier momento desde Perfil › Privacidad y datos, sin que ello afecte al resto del servicio.',
      ],
    },
    {
      heading: '4. Con quién los compartimos',
      paragraphs: [
        'No vendemos tus datos personales. Los compartimos únicamente con:',
        '• El operador del parqueadero que reservas, y sólo lo imprescindible para darte acceso: nombre, placa, horario y espacio asignado.',
        '• Supabase Inc., que aloja nuestra base de datos y el servicio de autenticación (servidores en la Unión Europea o en Estados Unidos).',
        '• Google LLC, si usas la función de rutas, para calcular el trayecto.',
        '• Nuestra pasarela de pagos, para procesar el cobro.',
        '• Autoridades competentes, cuando una orden judicial o una norma nos obligue a ello.',
        `Algunos de estos proveedores están fuera de Colombia. En esas transferencias internacionales exigimos garantías contractuales de protección equivalentes a las de la Ley 1581 de 2012, conforme a su artículo 26.`,
      ],
    },
    {
      heading: '5. Cuánto tiempo los conservamos',
      paragraphs: [
        '• Datos de cuenta: mientras la cuenta esté activa.',
        '• Reservas y registros de acceso: cinco (5) años desde la reserva, por las obligaciones contables y tributarias colombianas.',
        '• Datos de ubicación del trayecto: se procesan en tu dispositivo durante la navegación y no se guardan en nuestros servidores.',
        '• Registros técnicos y de fallos: doce (12) meses.',
        'Cuando borras tu cuenta eliminamos tus datos de inmediato. Las reservas ya pagadas se conservan sin tu nombre ni tu placa, por obligación contable.',
      ],
    },
    {
      heading: '6. Tus derechos',
      paragraphs: [
        'Como titular de los datos puedes, en cualquier momento:',
        '• Conocer, actualizar y rectificar tus datos.',
        '• Solicitar prueba de la autorización que nos diste.',
        '• Ser informado sobre el uso que les hemos dado.',
        '• Presentar quejas ante la Superintendencia de Industria y Comercio por infracciones a la ley.',
        '• Revocar la autorización y solicitar la supresión de tus datos, cuando no exista un deber legal de conservarlos.',
        '• Acceder gratuitamente a tus datos y obtener una copia en formato legible por máquina.',
        `Puedes consultar y descargar tus datos desde Perfil › Privacidad y datos › Descargar mis datos, o escribiendo a ${E.privacyEmail}. El borrado de la cuenta está disponible en Perfil › Privacidad y datos › Eliminar mi cuenta.`,
      ],
    },
    {
      heading: '7. Seguridad',
      paragraphs: [
        'Ciframos la comunicación entre la app y nuestros servidores con TLS. Los tokens de tu sesión se guardan en el almacenamiento seguro del sistema operativo: el Llavero en iOS y Keystore en Android. El acceso a la base de datos está restringido por políticas por fila, de modo que cada persona sólo puede leer y modificar sus propios datos.',
        'Ningún sistema es infalible. Si se produjera un incidente que afecte a tus datos, te lo notificaremos y lo reportaremos a la Superintendencia de Industria y Comercio en los plazos que exige la norma.',
      ],
    },
    {
      heading: '8. Menores de edad',
      paragraphs: [
        'ParkNow no está dirigida a menores de dieciocho (18) años y no recogemos sus datos a sabiendas. Si detectamos una cuenta de un menor, la eliminaremos. Si eres madre, padre o tutor y crees que un menor a tu cargo nos ha facilitado datos, escríbenos a ' + E.privacyEmail + '.',
      ],
    },
    {
      heading: '9. Cambios en esta política',
      paragraphs: [
        'Si cambiamos esta política de forma sustancial, te avisaremos dentro de la app antes de que entre en vigor y actualizaremos la fecha del encabezado. Seguir usando ParkNow después de ese aviso supone la aceptación del texto nuevo.',
      ],
    },
    {
      heading: '10. Contacto',
      paragraphs: [
        `${E.companyName}`,
        E.address,
        `Privacidad: ${E.privacyEmail}`,
        `Soporte: ${E.supportEmail}`,
        `Web: ${E.website}`,
      ],
    },
  ],
};

export const TERMS_OF_SERVICE: LegalDocument = {
  title: 'Términos del Servicio',
  subtitle: `Condiciones de uso de ParkNow`,
  lastUpdated: LEGAL_LAST_UPDATED,
  version: LEGAL_VERSION,
  sections: [
    {
      heading: '1. Aceptación',
      paragraphs: [
        `Al crear una cuenta o usar ParkNow aceptas estos Términos y la Política de Privacidad. Si no estás de acuerdo con ellos, no uses la aplicación.`,
        'Debes ser mayor de dieciocho (18) años y tener capacidad legal para contratar.',
      ],
    },
    {
      heading: '2. Qué es ParkNow',
      paragraphs: [
        `ParkNow es una plataforma que te permite consultar disponibilidad, reservar un espacio de parqueo por bloques de tiempo y acceder al parqueadero mediante un código QR.`,
        `${E.companyName} actúa como intermediario tecnológico entre tú y el operador del parqueadero. El servicio de custodia del vehículo lo presta el operador, no nosotros.`,
      ],
    },
    {
      heading: '3. Tu cuenta',
      paragraphs: [
        'Eres responsable de la veracidad de los datos que registras y de mantener en secreto tu contraseña. Avísanos de inmediato si sospechas que alguien accedió a tu cuenta.',
        'Puedes cerrar tu cuenta cuando quieras desde Perfil › Privacidad y datos › Eliminar mi cuenta.',
      ],
    },
    {
      heading: '4. Reservas',
      paragraphs: [
        'Las reservas se hacen por bloques de treinta (30) minutos y quedan confirmadas cuando se completa el pago.',
        'Tienes veinticinco (25) minutos de cortesía desde el inicio de tu reserva para llegar al parqueadero. Pasado ese plazo la reserva se marca como expirada y el espacio se libera.',
        'El espacio que eliges en el plano 3D se asigna a tu reserva. Si por una causa operativa del parqueadero ese espacio no estuviera disponible a tu llegada, el operador te asignará otro equivalente.',
      ],
    },
    {
      heading: '5. Precios y pagos',
      paragraphs: [
        'El precio de cada bloque lo fija el operador del parqueadero y se muestra antes de confirmar. Los importes están en pesos colombianos (COP) e incluyen los impuestos aplicables.',
        'El cobro se realiza al confirmar la reserva, a través de nuestra pasarela de pagos.',
      ],
    },
    {
      heading: '6. Cancelaciones y reembolsos',
      paragraphs: [
        'Puedes cancelar sin coste hasta treinta (30) minutos antes del inicio de tu reserva, con reembolso íntegro al medio de pago original.',
        'Dentro de esos treinta minutos, y una vez iniciada la reserva, no hay reembolso, porque el espacio quedó bloqueado para ti.',
        'Si el parqueadero no puede darte acceso por una causa que le sea imputable, te reembolsamos el importe completo.',
      ],
    },
    {
      heading: '7. Tiempo extra',
      paragraphs: [
        'Dispones de diez (10) minutos de tolerancia para salir tras el fin de tu reserva. Si los superas, se cobra tiempo extra por bloques de treinta (30) minutos a la tarifa vigente del parqueadero.',
      ],
    },
    {
      heading: '8. Uso correcto',
      paragraphs: [
        'No puedes ceder, revender ni publicar tu código QR de acceso, usar la app para fines distintos de reservar parqueo, ni intentar vulnerar los sistemas de control de acceso.',
        'Podemos suspender o cerrar cuentas que incumplan estas reglas.',
      ],
    },
    {
      heading: '9. Función de rutas',
      paragraphs: [
        'La ruta y el tiempo estimado son orientativos y dependen de datos de terceros. No sustituyen a tu juicio al volante.',
        'No manipules el teléfono mientras conduces. Respeta siempre las normas de tránsito. No nos hacemos responsables de infracciones ni de accidentes derivados del uso de la app durante la conducción.',
      ],
    },
    {
      heading: '10. Responsabilidad',
      paragraphs: [
        `La custodia del vehículo y de los objetos que haya en su interior corresponde al operador del parqueadero, conforme al contrato de depósito que se perfecciona al ingresar. ${E.companyName} no responde por hurtos ni por daños ocurridos dentro de las instalaciones.`,
        'Procuramos que la app esté siempre disponible, pero no garantizamos un funcionamiento ininterrumpido ni libre de errores.',
        'Nuestra responsabilidad frente a ti se limita, en todo caso, al importe que hayas pagado por la reserva afectada. Esta limitación no aplica en casos de dolo o culpa grave, ni a los derechos que la ley colombiana te reconoce como consumidor y que no pueden restringirse por contrato.',
      ],
    },
    {
      heading: '11. Cambios en el servicio y en los Términos',
      paragraphs: [
        'Podemos modificar o suspender funciones de la app. Si cambiamos estos Términos de forma sustancial, te avisaremos dentro de la app con al menos quince (15) días de antelación.',
      ],
    },
    {
      heading: '12. Ley aplicable y controversias',
      paragraphs: [
        `Estos Términos se rigen por la legislación colombiana. Cualquier controversia se someterá a los jueces competentes de Medellín, Colombia, sin perjuicio del derecho que te asiste como consumidor de acudir a la Superintendencia de Industria y Comercio.`,
      ],
    },
    {
      heading: '13. Contacto',
      paragraphs: [
        `${E.companyName}`,
        E.address,
        `Soporte: ${E.supportEmail}`,
        `Web: ${E.website}`,
      ],
    },
  ],
};
