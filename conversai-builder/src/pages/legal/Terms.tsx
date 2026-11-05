import { Link } from 'react-router-dom'
import { COMPANY } from '@/lib/company'
import { LegalLayout } from './LegalLayout'

const Terms = () => (
  <LegalLayout title="Términos y condiciones del servicio">
    <p>
      Estos términos regulan el uso de <strong>{COMPANY.brand}</strong>, servicio prestado por{' '}
      <strong>{COMPANY.legalName}</strong>, NIT {COMPANY.nit} (en adelante, "Fractal"). Al crear una cuenta o usar el
      servicio, aceptas estos términos y la <Link to="/privacidad">política de privacidad</Link>.
    </p>

    <h2>1. El servicio</h2>
    <p>
      {COMPANY.brand} permite crear agentes de inteligencia artificial que atienden a los clientes de un negocio por
      WhatsApp: responden preguntas, recogen datos de contacto, envían archivos y avisan al equipo del negocio. El
      negocio conecta su propio número de WhatsApp y configura el comportamiento del agente.
    </p>

    <h2>2. Cuenta y equipo</h2>
    <ul>
      <li>Debes ser mayor de edad y tener facultades para obligar al negocio que registras.</li>
      <li>Eres responsable de la información de tu cuenta, de tus credenciales y de lo que hagan los miembros que invites a tu equipo.</li>
      <li>Debes informarnos de inmediato cualquier uso no autorizado.</li>
    </ul>

    <h2>3. Obligaciones del cliente</h2>
    <ul>
      <li>Cumplir las políticas de WhatsApp Business, la Política de Comercio de WhatsApp y las condiciones de Meta.</li>
      <li>Escribir solo a personas que hayan iniciado la conversación o que hayan dado su autorización (opt-in), y respetar la ventana de atención y las plantillas que exige WhatsApp.</li>
      <li>No usar el servicio para spam, mensajes masivos no solicitados, fraude, contenido ilegal ni para productos o servicios prohibidos por WhatsApp.</li>
      <li>Actuar como responsable del tratamiento de los datos de sus contactos, informarles cuando corresponda que son atendidos por un agente automatizado y atender sus solicitudes sobre datos personales.</li>
      <li>Revisar la información y las instrucciones que da al agente. El cliente responde por lo que su agente comunica en nombre de su negocio.</li>
    </ul>

    <h2>4. Inteligencia artificial</h2>
    <p>
      Las respuestas se generan automáticamente y pueden contener errores o imprecisiones. El agente está limitado a los
      asuntos del negocio que lo configuró; no es un asistente de propósito general. Las conversaciones no se usan para
      entrenar modelos de inteligencia artificial.
    </p>

    <h2>5. WhatsApp, Meta y costos de terceros</h2>
    <ul>
      <li>La disponibilidad de WhatsApp depende de Meta. Fractal no controla bloqueos, restricciones de calidad o cambios de política que Meta aplique al número del cliente.</li>
      <li>Cuando el número se conecta por la WhatsApp Business Platform, Meta cobra sus tarifas de mensajería directamente al cliente, según el método de pago que este registre en su cuenta de Meta. Estas tarifas no están incluidas en el precio de {COMPANY.brand}, salvo que se pacte lo contrario.</li>
      <li>Si el cliente conecta su número mediante la vinculación de WhatsApp Web, entiende que ese método no es una integración oficial de Meta y que puede verse limitado o suspendido por WhatsApp.</li>
    </ul>

    <h2>6. Planes, tokens y pagos</h2>
    <p>
      El uso del servicio se paga según el plan o los paquetes de tokens vigentes en la plataforma. Los pagos se procesan
      a través de la pasarela de pagos indicada al momento de la compra. Salvo que la ley disponga otra cosa, los consumos
      ya realizados no son reembolsables.
    </p>

    <h2>7. Propiedad intelectual</h2>
    <p>
      La plataforma, su software y su marca pertenecen a Fractal. El cliente conserva la titularidad del contenido, los
      archivos y la información de su negocio que carga en el servicio, y autoriza a Fractal a usarlos solo para prestar
      el servicio.
    </p>

    <h2>8. Disponibilidad y responsabilidad</h2>
    <p>
      Trabajamos para mantener el servicio disponible, pero puede haber interrupciones por mantenimiento o por fallas de
      proveedores (incluidos Meta, los proveedores de inteligencia artificial y la infraestructura en la nube). En la
      medida permitida por la ley, Fractal no responde por daños indirectos, lucro cesante ni por decisiones tomadas con
      base en las respuestas del agente, y su responsabilidad total se limita a lo pagado por el cliente en los tres (3)
      meses anteriores al hecho.
    </p>

    <h2>9. Suspensión y terminación</h2>
    <p>
      El cliente puede cancelar su cuenta en cualquier momento. Fractal puede suspender o terminar el servicio si el
      cliente incumple estos términos o las políticas de WhatsApp, o si su uso pone en riesgo la plataforma o a terceros.
      Al terminar, los datos se tratan según la <Link to="/eliminacion-de-datos">política de eliminación de datos</Link>.
    </p>

    <h2>10. Cambios</h2>
    <p>
      Podemos actualizar estos términos. Publicaremos la nueva versión en esta página y, si el cambio es sustancial, lo
      informaremos con anticipación. Seguir usando el servicio implica la aceptación de la nueva versión.
    </p>

    <h2>11. Ley aplicable y contacto</h2>
    <p>
      Estos términos se rigen por las leyes de la República de Colombia. Para cualquier consulta escribe a{' '}
      <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> o llama al {COMPANY.phone}.
    </p>
  </LegalLayout>
)

export default Terms
