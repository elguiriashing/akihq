import Link from "next/link";

export function ProductPrivacy({ locale }: { locale: "en" | "es" }) {
  const es = locale === "es";
  return (
    <main className="shell legal">
      <section className="hero">
        <div className="eyebrow">AkiHQ · {es ? "Privacidad" : "Privacy"}</div>
        <h1>
          {es
            ? "Tu información, bajo control"
            : "Your information, under control"}
        </h1>
        <p className="lede">
          {es
            ? "Cómo AkiHQ utiliza tus datos y cómo solicitar la eliminación de tu cuenta compartida de AkiSuite."
            : "How AkiHQ uses your data and how to request deletion of your shared AkiSuite account."}
        </p>
      </section>
      <section className="panel prose">
        <h2>{es ? "Datos y finalidad" : "Data and purpose"}</h2>
        <p>
          {es
            ? "Nombre, usuario, correo, contacto, fotos de perfil y preferencias; pertenencia a organizaciones y ubicaciones; fichas de negocio, eventos, alojamientos y flotas que gestionas. Los espacios compartidos pueden incluir datos de clientes y equipo aportados por operadores autorizados."
            : "Name, username, email, contact details, profile photos and preferences; organisation and location membership; business listings, events, accommodation and fleet records you manage. Shared workspaces can include customer and team data submitted by authorised operators."}
        </p>
        <p>
          {es
            ? "Para autenticar tu cuenta compartida, aplicar permisos, gestionar los registros de tu negocio y proteger el servicio."
            : "To authenticate your shared account, enforce workspace permissions, manage your business records and protect the service."}
        </p>
        <h2>{es ? "Ubicación y mapas" : "Location and maps"}</h2>
        <p>
          {es
            ? "Los mapas envían la zona visible y las búsquedas a nuestros servicios para mostrar resultados. Cuando usas una función de ubicación y das permiso, la zona enviada puede revelar tu ubicación precisa. Puedes utilizar el servicio sin activar la ubicación. Las ubicaciones de negocios y eventos que publicas pueden ser visibles para otras personas."
            : "Maps send the visible area and searches to our services to display results. If you use a location feature and grant permission, the transmitted area may reveal your precise location. You can use the service without enabling location. Business and event locations you publish may be visible to other people."}
        </p>
        <h2>{es ? "Analítica opcional" : "Optional analytics"}</h2>
        <p>
          {es
            ? "Si aceptas la analítica, Google Analytics recibe un identificador de navegador, páginas e interacciones, información del dispositivo y navegador, y una ubicación aproximada derivada de la dirección IP. Puedes retirar el consentimiento en los controles de privacidad. No configuramos Google Ads en este dominio. Las funciones esenciales de cuenta y seguridad no dependen de aceptar la analítica."
            : "If you accept analytics, Google Analytics receives a browser identifier, pages and interactions, device and browser information, and approximate location derived from the IP address. You can withdraw consent in the privacy controls. We do not configure Google Ads on this domain. Essential account and security functions do not depend on accepting analytics."}
        </p>
        <h2>{es ? "Servicios y destinatarios" : "Services and recipients"}</h2>
        <p>
          {es
            ? "La identidad se comparte entre los productos de AkiSuite. Utilizamos Supabase para la cuenta y los datos, Cloudflare para alojar y proteger el servicio, y Google para las funciones de inicio de sesión y analítica que elijas. Las solicitudes se facilitan al proveedor elegido y los registros del espacio de trabajo a sus miembros autorizados. Los proveedores de pago reciben los datos necesarios cuando utilizas sus servicios. No vendemos datos personales."
            : "Identity is shared across AkiSuite products. We use Supabase for accounts and data, Cloudflare to host and protect the service, and Google for the sign-in and analytics functions you choose. Requests are provided to your chosen provider and workspace records to authorised members. Payment providers receive necessary details when you use their services. We do not sell personal data."}
        </p>
        <h2>
          {es
            ? "Eliminar la cuenta y los datos"
            : "Delete your account and data"}
        </h2>
        <p>
          {es
            ? "Puedes solicitarlo desde los controles de datos de Cuenta o escribiendo a support@akipasa.com desde el correo de tu cuenta, con el asunto «Eliminar cuenta AkiSuite». No necesitas tener la aplicación instalada. Si no tienes acceso al correo, contacta con soporte para verificar tu identidad; no envíes contraseñas."
            : "Request deletion through the Account data controls or email support@akipasa.com from your account email with the subject “Delete AkiSuite account”. You do not need the app installed. If you cannot access that email, contact support for identity verification; do not send passwords."}
        </p>
        <p>
          {es
            ? "Una persona tramita manualmente la eliminación de tu cuenta en un plazo de 48 horas desde la verificación de la solicitud y envía una confirmación escrita manualmente desde support@akipasa.com. La eliminación afecta a tu identidad compartida en todos los productos AkiSuite. No elimina automáticamente los registros de una empresa gestionada por otras personas ni los datos que un proveedor deba conservar por sus propias obligaciones."
            : "A person manually processes account deletion within 48 hours of verifying the request and sends a manually written confirmation from support@akipasa.com. Deletion affects your shared identity across all AkiSuite products. It does not automatically remove records of a business managed by other people or data a provider must retain under its own obligations."}
        </p>
        <p>
          <Link href={`https://akipasa.com/${locale}/account-deletion`}>
            {es
              ? "Instrucciones públicas de eliminación"
              : "Public account deletion instructions"}
          </Link>
          {" · "}
          <Link href={`https://akipasa.com/${locale}/account/privacy`}>
            {es ? "Controles de datos de la cuenta" : "Account data controls"}
          </Link>
        </p>
        <h2>
          {es ? "Conservación y excepciones" : "Retention and exceptions"}
        </h2>
        <p>
          {es
            ? "Los datos necesarios de la cuenta se conservan mientras se presta el servicio y se eliminan al tramitar una solicitud verificada en un plazo de 48 horas. La política de conservación establece 90 días para registros operativos y 12 meses desde el cierre para los registros de soporte gestionados en nuestro sistema y las pruebas mínimas de la eliminación. Los registros empresariales y contables sujetos a la obligación española aplicable se conservan 6 años desde el último asiento. Una obligación legal o una reclamación puede exigir conservar registros específicos durante más tiempo; soporte explica y documenta esas excepciones por separado. Las copias de seguridad y los sistemas de proveedores, incluido el correo externo, tienen procesos de conservación separados; soporte puede explicar el alcance aplicable."
            : "Necessary account data is retained while providing the service and deleted when processing a verified request within 48 hours. The retention policy sets 90 days for operational logs and 12 months after closure for support records managed in our system and minimal deletion evidence. Business and accounting records subject to the applicable Spanish obligation are retained for 6 years from the last entry. A legal obligation or claim may require specific records to be kept longer; support explains and documents those exceptions separately. Backups and provider systems, including external email, have separate retention processes; support can explain the applicable scope."}
        </p>
        <h2>{es ? "Contacto y derechos" : "Contact and rights"}</h2>
        <p>
          {es
            ? "Responsable del servicio: AkiPasa Marketing S.L."
            : "Service operator: AkiPasa Marketing S.L."}
        </p>
        <p>
          {es
            ? "Para acceso, exportación, corrección y otras consultas de privacidad: privacy@akipasa.com. Para eliminación y seguimiento de solicitudes: support@akipasa.com."
            : "For access, export, correction and other privacy questions: privacy@akipasa.com. For deletion and request follow-up: support@akipasa.com."}
        </p>
        <p>
          <Link href={`/${locale}/terms`}>{es ? "Condiciones" : "Terms"}</Link>
        </p>
        <small>
          {es
            ? "Actualizado: 25 de octubre de 2026."
            : "Updated: 25 October 2026."}
        </small>
      </section>
    </main>
  );
}
