import { Link } from 'react-router-dom'
import { COMPANY } from '@/lib/company'
import { LegalLayout } from './LegalLayout'

const DataDeletion = () => (
  <LegalLayout title="Instrucciones para la eliminación de datos">
    <p>
      En <strong>{COMPANY.brand}</strong>, servicio de <strong>{COMPANY.legalName}</strong>, puedes solicitar en
      cualquier momento la eliminación de tus datos personales, según la Ley 1581 de 2012 y nuestra{' '}
      <Link to="/privacidad">política de privacidad</Link>.
    </p>

    <h2>Si eres cliente de {COMPANY.brand}</h2>
    <ol>
      <li>
        <strong>Desde la plataforma:</strong> en el panel puedes eliminar tus líneas de WhatsApp y los archivos de tus
        agentes. Al eliminar una línea se desconecta de WhatsApp y se borran sus credenciales.
      </li>
      <li>
        <strong>Eliminación total de la cuenta:</strong> escribe a{' '}
        <a href={`mailto:${COMPANY.email}?subject=Solicitud%20de%20eliminaci%C3%B3n%20de%20datos`}>{COMPANY.email}</a>{' '}
        desde el correo registrado, con el asunto <em>"Solicitud de eliminación de datos"</em>. Eliminaremos tu cuenta,
        tus agentes, conversaciones, contactos, archivos y credenciales de conexión. Por este mismo medio puedes pedir
        la eliminación de un agente puntual.
      </li>
    </ol>

    <h2>Si conectaste WhatsApp con "Conectar con Facebook"</h2>
    <p>
      Puedes retirar el acceso de {COMPANY.brand} en cualquier momento desde Facebook: <strong>Configuración y
      privacidad → Configuración → Integraciones comerciales</strong> (o desde la configuración de tu portafolio en Meta
      Business Suite), y quitar {COMPANY.brand}. Al recibir la notificación de Meta, desactivamos la conexión y eliminamos
      los tokens de acceso asociados. Si además quieres borrar el resto de tus datos, envía la solicitud por correo como
      se indica arriba.
    </p>

    <h2>Si eres contacto de un negocio que usa {COMPANY.brand}</h2>
    <p>
      El negocio con el que conversaste es el responsable de tus datos. Puedes pedirle a él la eliminación, o escribirnos a{' '}
      <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> indicando tu número de WhatsApp y el nombre del negocio, y
      gestionaremos la solicitud con ese negocio.
    </p>

    <h2>Qué se elimina y en cuánto tiempo</h2>
    <ul>
      <li>Atendemos la solicitud en un plazo máximo de quince (15) días hábiles y te confirmamos por correo.</li>
      <li>Se eliminan los datos de la cuenta, conversaciones, contactos, archivos y credenciales.</li>
      <li>
        Solo conservamos lo que la ley nos obliga a guardar (por ejemplo, registros contables de pagos), durante el tiempo
        exigido y sin usarlo para otros fines.
      </li>
      <li>Las copias de seguridad se sobrescriben en sus ciclos normales de rotación.</li>
    </ul>

    <h2>Contacto</h2>
    <p>
      {COMPANY.legalName} · NIT {COMPANY.nit} · {COMPANY.address} · Tel. {COMPANY.phone} ·{' '}
      <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
    </p>
  </LegalLayout>
)

export default DataDeletion
