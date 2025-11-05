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
    <section className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-darker-surface via-background to-darker-surface"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--neon-green)/0.1),transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(var(--neon-cyan)/0.1),transparent_50%)]"></div>
      
      <div className="relative z-10 max-w-6xl mx-auto text-center">
        {/* Main Headline */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
            Diseña tu flujo de{" "}
            <span className="gradient-text text-shadow-glow">
              ventas por WhatsApp
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-4xl mx-auto leading-relaxed">
            Convierte tu proceso de ventas en un{" "}
            <span className="text-neon-cyan font-semibold">agente conversacional automatizado</span>
            {" "}que entiende tu negocio y vende las 24 horas
          </p>
        </div>

        {/* Value Proposition Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12 max-w-5xl mx-auto">
          <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-6 text-center">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 text-primary glow-effect" />
            <h3 className="text-lg font-semibold mb-2">Sin conocimientos técnicos</h3>
            <p className="text-muted-foreground">
              Solo describe cómo vendes, nosotros hacemos el resto
            </p>
          </div>
          
          <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-6 text-center">
            <Zap className="w-12 h-12 mx-auto mb-4 text-neon-cyan glow-accent" />
            <h3 className="text-lg font-semibold mb-2">Automatización inteligente</h3>
            <p className="text-muted-foreground">
              Responde con contexto y evita pérdidas de ventas
            </p>
          </div>
          
          <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-6 text-center">
            <Target className="w-12 h-12 mx-auto mb-4 text-tech-blue" />
            <h3 className="text-lg font-semibold mb-2">Adaptado a tu negocio</h3>
            <p className="text-muted-foreground">
              No más bots genéricos que no entienden tu flujo
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="space-y-4">
          <Button
            onClick={scrollToForm}
            className="px-8 py-4 text-xl bg-primary hover:bg-primary/90 text-primary-foreground glow-effect transition-all duration-300 hover:scale-105"
          >
            Empezar a diseñar mi agente
          </Button>
          <p className="text-sm text-muted-foreground">
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