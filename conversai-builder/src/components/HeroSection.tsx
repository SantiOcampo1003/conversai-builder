import { MessageSquare, Zap, Target } from "lucide-react";
import { Button } from "@/components/ui/button";

export const HeroSection = () => {
  const scrollToForm = () => {
    const formSection = document.getElementById('flow-form');
    if (formSection) {
      formSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 overflow-hidden pt-16">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-darker-surface via-background to-darker-surface"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--neon-green)/0.1),transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(var(--neon-cyan)/0.1),transparent_50%)]"></div>

      <div className="relative z-10 max-w-6xl mx-auto text-center">
        {/* Main Headline */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold leading-tight mb-4 sm:mb-6 px-2">
            Diseña tu flujo de{" "}
            <span className="gradient-text text-shadow-glow">
              ventas por WhatsApp
            </span>
          </h1>
          <p className="text-base sm:text-xl md:text-2xl text-muted-foreground max-w-4xl mx-auto leading-relaxed px-2">
            Convierte tu proceso de ventas en un{" "}
            <span className="text-neon-cyan font-semibold">agente conversacional automatizado</span>
            {" "}que entiende tu negocio y vende las 24 horas
          </p>
        </div>

        {/* Value Proposition Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12 max-w-5xl mx-auto">
          <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-4 sm:p-6 text-center">
            <MessageSquare className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-primary glow-effect" />
            <h3 className="text-base sm:text-lg font-semibold mb-2">Sin conocimientos técnicos</h3>
            <p className="text-sm sm:text-base text-muted-foreground">
              Solo describe cómo vendes, nosotros hacemos el resto
            </p>
          </div>

          <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-4 sm:p-6 text-center">
            <Zap className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-neon-cyan glow-accent" />
            <h3 className="text-base sm:text-lg font-semibold mb-2">Automatización inteligente</h3>
            <p className="text-sm sm:text-base text-muted-foreground">
              Responde con contexto y evita pérdidas de ventas
            </p>
          </div>

          <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-4 sm:p-6 text-center sm:col-span-2 md:col-span-1">
            <Target className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-tech-blue" />
            <h3 className="text-base sm:text-lg font-semibold mb-2">Adaptado a tu negocio</h3>
            <p className="text-sm sm:text-base text-muted-foreground">
              No más bots genéricos que no entienden tu flujo
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="space-y-3 sm:space-y-4 px-4">
          <Button
            onClick={scrollToForm}
            className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-xl bg-primary hover:bg-primary/90 text-primary-foreground glow-effect transition-all duration-300 hover:scale-105"
          >
            Empezar a diseñar mi agente
          </Button>
          <p className="text-xs sm:text-sm text-muted-foreground">
            ⚡ En 5 minutos tendrás tu flujo mapeado
          </p>
        </div>
      </div>

      {/* Floating Elements */}
      <div className="absolute top-20 left-10 w-2 h-2 bg-neon-green rounded-full animate-pulse"></div>
      <div className="absolute top-40 right-20 w-1 h-1 bg-neon-cyan rounded-full animate-pulse delay-1000"></div>
      <div className="absolute bottom-40 left-20 w-1.5 h-1.5 bg-tech-blue rounded-full animate-pulse delay-500"></div>
      <div className="absolute bottom-20 right-10 w-1 h-1 bg-primary rounded-full animate-pulse delay-2000"></div>
    </section>
  );
};