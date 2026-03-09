import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { LayoutDashboard, LogIn, X, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Navbar = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const closeMobileMenu = () => setMobileMenuOpen(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-b border-primary/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <div className="relative">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center shadow-lg shadow-primary/50">
                <span className="text-xl sm:text-2xl font-black text-white">e</span>
              </div>
              <div className="absolute inset-0 bg-primary/30 rounded-lg blur-md animate-pulse"></div>
            </div>
            <div className="flex flex-col">
              <span className="text-xl sm:text-2xl font-black gradient-text tracking-tight">easy</span>
              <span className="text-[9px] sm:text-[10px] text-primary/70 -mt-0.5 sm:-mt-1 tracking-wider">AI AGENTS</span>
            </div>
          </div>

          {/* Desktop Nav Items */}
          <div className="hidden md:flex items-center gap-6">
            <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Inicio
            </a>
            <a href="#flow-form" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Crear Agente
            </a>

            {user ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-all hover:shadow-lg hover:shadow-primary/50"
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-all hover:shadow-lg hover:shadow-primary/50"
              >
                <LogIn className="w-4 h-4" />
                Iniciar sesión
              </button>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-primary/10 transition-colors"
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6 text-primary" />
            ) : (
              <Menu className="w-6 h-6 text-primary" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        <div
          className={cn(
            "md:hidden overflow-hidden transition-all duration-300 ease-in-out",
            mobileMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <div className="py-4 space-y-3 border-t border-primary/10">
            <a
              href="#"
              onClick={closeMobileMenu}
              className="block px-4 py-2 text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
            >
              Inicio
            </a>
            <a
              href="#flow-form"
              onClick={closeMobileMenu}
              className="block px-4 py-2 text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
            >
              Crear Agente
            </a>

            {user ? (
              <button
                onClick={() => {
                  closeMobileMenu()
                  navigate('/dashboard')
                }}
                className="w-full flex items-center gap-2 px-4 py-3 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-all"
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </button>
            ) : (
              <button
                onClick={() => {
                  closeMobileMenu()
                  navigate('/login')
                }}
                className="w-full flex items-center gap-2 px-4 py-3 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-all"
              >
                <LogIn className="w-4 h-4" />
                Iniciar sesión
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
