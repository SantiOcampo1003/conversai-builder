import { Link } from 'react-router-dom'
import { COMPANY } from '@/lib/company'
import { LegalLayout } from './LegalLayout'

const PrivacyPolicy = () => (
  <LegalLayout title="Política de privacidad y tratamiento de datos personales">
    <p>
      Esta política explica cómo <strong>{COMPANY.legalName}</strong> (en adelante, "Fractal"), empresa que presta el
      servicio <strong>{COMPANY.brand}</strong>, recolecta, usa, almacena y protege los datos personales, en
      cumplimiento de la Ley 1581 de 2012, el Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015) y demás
      normas colombianas de protección de datos.
    </p>

    <h2>1. Responsable del tratamiento</h2>
    <ul>
      <li><strong>Razón social:</strong> {COMPANY.legalName}</li>
      <li><strong>NIT:</strong> {COMPANY.nit}</li>
      <li><strong>Dirección:</strong> {COMPANY.address}</li>
      <li><strong>Teléfono:</strong> {COMPANY.phone}</li>
      <li><strong>Correo:</strong> <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></li>
      <li><strong>Sitio web:</strong> <a href={COMPANY.website}>{COMPANY.website}</a></li>
    </ul>

    <h2>2. A quién aplica</h2>
    <p>
      <strong>Clientes de {COMPANY.brand}:</strong> empresas y personas que crean una cuenta para configurar agentes de
      inteligencia artificial que atienden por WhatsApp. Frente a sus datos de cuenta, Fractal es el responsable del
      tratamiento.
    </p>
    <p>
      <strong>Contactos finales:</strong> personas que escriben por WhatsApp a un negocio que usa {COMPANY.brand}.
      Frente a estos datos, el negocio es el responsable del tratamiento y Fractal actúa como encargado: los trata solo
      para prestar el servicio que el negocio contrató y según sus instrucciones.
    </p>

    <h2>3. Datos que tratamos</h2>
    <ul>
      <li><strong>Datos de cuenta:</strong> nombre, correo, empresa, rol en el equipo y credenciales de acceso (la contraseña se guarda cifrada por nuestro proveedor de autenticación).</li>
      <li><strong>Configuración de los agentes:</strong> información del negocio, instrucciones, productos, archivos e imágenes que el cliente carga.</li>
      <li><strong>Conversaciones de WhatsApp:</strong> número de teléfono y nombre de perfil del contacto, mensajes, notas de voz, imágenes y documentos intercambiados con el agente.</li>
      <li><strong>Datos que el agente recoge:</strong> los campos que el cliente configura (por ejemplo nombre, ciudad o interés) y el estado del contacto.</li>
      <li><strong>Datos de conexión con WhatsApp y Meta:</strong> número conectado, identificadores de la cuenta de WhatsApp Business y del portafolio de negocio en Meta, y los tokens de acceso que Meta entrega al conectar la cuenta (se almacenan cifrados y nunca se muestran en el navegador).</li>
      <li><strong>Datos de pago:</strong> referencia y estado de las transacciones. Los datos de tarjetas los procesa directamente la pasarela de pagos; no los almacenamos.</li>
      <li><strong>Datos técnicos:</strong> registros de uso y de errores, dirección IP y tipo de navegador, para seguridad y soporte.</li>
    </ul>

    <h2>4. Finalidades</h2>
    <ul>
      <li>Prestar el servicio: recibir los mensajes de WhatsApp, generar las respuestas del agente y enviarlas.</li>
      <li>Registrar los contactos y los datos que el cliente pidió recoger, y avisar al cliente o a su equipo cuando un contacto queda completo.</li>
      <li>Mostrar métricas e historial de conversaciones al cliente.</li>
      <li>Gestionar la cuenta, la facturación, el soporte y las comunicaciones del servicio.</li>
      <li>Garantizar la seguridad, prevenir abusos y cumplir obligaciones legales.</li>
    </ul>

    <h2>5. Uso de inteligencia artificial</h2>
    <ul>
      <li>Los mensajes se procesan con modelos de lenguaje de terceros (actualmente OpenAI) únicamente para generar la respuesta de cada conversación.</li>
      <li><strong>No usamos las conversaciones de WhatsApp para entrenar ni mejorar modelos de inteligencia artificial</strong>, ni permitimos que nuestros proveedores lo hagan con esos datos.</li>
      <li>Cada agente se limita a atender los asuntos del negocio que lo configuró. El negocio puede intervenir y atender personalmente las conversaciones cuando lo considere necesario.</li>
    </ul>

    <h2>6. WhatsApp y Meta</h2>
    <p>
      {COMPANY.brand} se conecta a WhatsApp mediante la WhatsApp Business Platform de Meta o mediante la vinculación del
      número que haga el propio cliente. Para entregar los mensajes, la información necesaria se intercambia con Meta
      Platforms, Inc. y WhatsApp LLC, que la tratan según sus propias políticas. Cuando un cliente conecta su cuenta con
      "Conectar con Facebook", solo recibimos los identificadores de su cuenta de WhatsApp Business y los permisos que
      autoriza para enviar y recibir mensajes y administrar plantillas; no accedemos a su perfil personal de Facebook ni
      a sus chats personales.
    </p>

    <h2>7. Proveedores que tratan datos por cuenta nuestra</h2>
    <p>Para operar el servicio usamos proveedores que actúan como encargados y pueden almacenar datos fuera de Colombia:</p>
    <ul>
      <li>Supabase: base de datos, autenticación y almacenamiento de archivos.</li>
      <li>Vercel: alojamiento del sitio web y del panel.</li>
      <li>Proveedor de servidores virtuales donde se ejecutan el backend y los flujos de automatización.</li>
      <li>OpenAI: generación de respuestas y transcripción de notas de voz.</li>
      <li>Meta (WhatsApp Business Platform): envío y recepción de mensajes.</li>
      <li>Google: solo si el cliente activa la sincronización con Google Sheets.</li>
      <li>Mercado Pago: procesamiento de pagos.</li>
    </ul>
    <p>
      Al aceptar esta política, el titular autoriza la transferencia y transmisión internacional de datos a estos
      proveedores, que cuentan con medidas de seguridad adecuadas.
    </p>

    <h2>8. Conservación</h2>
    <p>
      Conservamos los datos mientras la cuenta esté activa y durante el tiempo necesario para cumplir obligaciones
      legales, contables o resolver reclamaciones. Cuando el cliente elimina un agente, una línea o su cuenta, o cuando un
      titular solicita la supresión, los datos se eliminan o anonimizan según lo descrito en la página de{' '}
      <Link to="/eliminacion-de-datos">eliminación de datos</Link>.
    </p>

    <h2>9. Derechos de los titulares</h2>
    <p>Como titular de datos personales tienes derecho a:</p>
    <ul>
      <li>Conocer, actualizar y rectificar tus datos.</li>
      <li>Solicitar prueba de la autorización otorgada.</li>
      <li>Ser informado sobre el uso que se ha dado a tus datos.</li>
      <li>Revocar la autorización y solicitar la supresión de tus datos cuando no exista un deber legal de conservarlos.</li>
      <li>Presentar quejas ante la Superintendencia de Industria y Comercio (SIC).</li>
      <li>Acceder gratuitamente a tus datos.</li>
    </ul>

    <h2>10. Cómo ejercer tus derechos</h2>
    <p>
      Escribe a <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> indicando tu nombre, el número de WhatsApp o el
      correo relacionado y tu solicitud. Las consultas se responden en máximo diez (10) días hábiles y los reclamos en
      máximo quince (15) días hábiles, prorrogables según la ley. Si eres contacto de un negocio que usa{' '}
      {COMPANY.brand}, también puedes dirigirte directamente a ese negocio.
    </p>

    <h2>11. Seguridad</h2>
    <p>
      Aplicamos medidas técnicas y organizativas razonables: cifrado en tránsito, control de acceso por roles, cifrado de
      credenciales sensibles y registro de accesos. Ningún sistema es completamente infalible, por lo que te pedimos
      proteger tus credenciales de acceso.
    </p>

    <h2>12. Menores de edad</h2>
    <p>El servicio está dirigido a empresas y personas mayores de edad. No tratamos de forma intencional datos de menores.</p>

    <h2>13. Cambios a esta política</h2>
    <p>
      Publicaremos cualquier cambio en esta página con su fecha de actualización. Si el cambio es sustancial, lo
      informaremos a los clientes por correo o dentro de la plataforma.
    </p>
  </LegalLayout>
)

export default PrivacyPolicy
