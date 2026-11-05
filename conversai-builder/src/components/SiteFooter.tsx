import { Link } from 'react-router-dom'
import { COMPANY } from '@/lib/company'

/** Pie de página público: identifica a la empresa detrás de EasyAgents y enlaza los documentos legales. */
export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-4 text-sm text-muted-foreground">
        <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Documentos legales">
          <Link to="/privacidad" className="hover:text-foreground transition-colors">Política de privacidad</Link>
          <Link to="/terminos" className="hover:text-foreground transition-colors">Términos y condiciones</Link>
          <Link to="/eliminacion-de-datos" className="hover:text-foreground transition-colors">Eliminación de datos</Link>
        </nav>
        <p>
          {COMPANY.brand} es un servicio de <strong className="text-foreground">{COMPANY.legalName}</strong>
          {' '}· NIT {COMPANY.nit} · {COMPANY.address} · Tel.{' '}
          <a href={COMPANY.phoneHref} className="hover:text-foreground">{COMPANY.phone}</a> ·{' '}
          <a href={`mailto:${COMPANY.email}`} className="hover:text-foreground">{COMPANY.email}</a>
        </p>
        <p className="text-xs">© {new Date().getFullYear()} {COMPANY.legalName}. Todos los derechos reservados.</p>
      </div>
    </footer>
  )
}
