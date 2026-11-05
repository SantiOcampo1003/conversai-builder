import { useEffect, type ReactNode } from 'react'
import { Navbar } from '@/components/Navbar'
import { SiteFooter } from '@/components/SiteFooter'
import { LEGAL_UPDATED_AT } from '@/lib/company'

interface LegalLayoutProps {
  title: string
  children: ReactNode
}

/** Plantilla común de las páginas legales públicas. */
export function LegalLayout({ title, children }: LegalLayoutProps) {
  useEffect(() => {
    document.title = `${title} | EasyAgents`
    window.scrollTo(0, 0)
  }, [title])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 pt-28 pb-16">
        <h1 className="text-3xl font-bold text-foreground mb-2">{title}</h1>
        <p className="text-sm text-muted-foreground mb-10">Última actualización: {LEGAL_UPDATED_AT}</p>
        <div className="legal-content space-y-6 text-sm leading-relaxed text-muted-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-10 [&_h2]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-1 [&_strong]:text-foreground [&_a]:text-primary [&_a:hover]:underline">
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
