import { Check, Zap, Sparkles, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const PricingSection = () => {
  const scrollToForm = () => {
    const formSection = document.getElementById('flow-form');
    if (formSection) {
      formSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-background to-darker-surface">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-6">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-semibold">Precios Transparentes</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Elige el plan perfecto para tu <span className="gradient-text">negocio</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Sin costos ocultos. Cancela cuando quieras. Escala según tus necesidades.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {/* STARTER */}
          <Card className="relative border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all duration-300">
            <CardHeader className="text-center pb-8 pt-8">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Starter</h3>
              <p className="text-muted-foreground text-sm mb-6">Para pequeños negocios</p>
              <div className="flex items-end justify-center gap-2">
                <span className="text-5xl font-bold gradient-text">$39</span>
                <span className="text-muted-foreground mb-2">/mes</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm">1 agente personalizado</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm">1,000 mensajes/mes</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Sin marca de agua</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Personalización completa</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Soporte por email</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Historial 30 días</span>
                </li>
              </ul>
              <Button 
                onClick={scrollToForm}
                className="w-full bg-primary hover:bg-primary/90 text-white"
              >
                Comenzar ahora
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Prueba gratis 14 días
              </p>
            </CardContent>
          </Card>

          {/* BUSINESS - POPULAR */}
          <Card className="relative border-2 border-primary bg-card/80 backdrop-blur-sm shadow-2xl shadow-primary/20 scale-105 hover:scale-[1.07] transition-all duration-300">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-primary/80 text-white px-6 py-1 rounded-full text-sm font-semibold shadow-lg">
              Más Popular
            </div>
            <CardHeader className="text-center pb-8 pt-12">
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Business</h3>
              <p className="text-muted-foreground text-sm mb-6">Para negocios en crecimiento</p>
              <div className="flex items-end justify-center gap-2">
                <span className="text-5xl font-bold gradient-text">$129</span>
                <span className="text-muted-foreground mb-2">/mes</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm font-medium">3 agentes personalizados</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm font-medium">5,000 mensajes/mes</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm font-medium">Todo de Starter +</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm font-medium">Integraciones (CRM, Shopify)</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm font-medium">Analytics avanzados</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm font-medium">Soporte prioritario</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm font-medium">Historial ilimitado</span>
                </li>
              </ul>
              <Button 
                onClick={scrollToForm}
                className="w-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/50"
              >
                Comenzar ahora
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Prueba gratis 14 días
              </p>
            </CardContent>
          </Card>

          {/* ENTERPRISE */}
          <Card className="relative border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all duration-300">
            <CardHeader className="text-center pb-8 pt-8">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Enterprise</h3>
              <p className="text-muted-foreground text-sm mb-6">Para grandes empresas</p>
              <div className="flex items-end justify-center gap-2">
                <span className="text-4xl font-bold gradient-text">Custom</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Agentes ilimitados</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Mensajes ilimitados</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Todo de Business +</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm">API personalizada</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Modelo de IA dedicado</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Account manager</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm">SLA garantizado</span>
                </li>
              </ul>
              <Button 
                variant="outline"
                className="w-full border-primary text-primary hover:bg-primary hover:text-white"
              >
                Contactar ventas
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Soluciones a medida
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Add-ons */}
        <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-xl p-8">
          <h3 className="text-2xl font-bold text-center mb-8">Complementos Disponibles</h3>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold gradient-text mb-2">+$20/mes</div>
              <p className="text-sm text-muted-foreground">Por agente adicional</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold gradient-text mb-2">$0.01</div>
              <p className="text-sm text-muted-foreground">Por mensaje extra</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold gradient-text mb-2">+$30/mes</div>
              <p className="text-sm text-muted-foreground">Integraciones premium</p>
            </div>
          </div>
        </div>

        {/* FAQ o garantía */}
        <div className="text-center mt-16">
          <p className="text-muted-foreground mb-4">
            🎉 <span className="text-primary font-semibold">Oferta de lanzamiento:</span> 50% OFF los primeros 3 meses para early adopters
          </p>
          <p className="text-sm text-muted-foreground">
            💰 Garantía de devolución de 30 días • ⚡ Sin contrato • 🔒 Cancela cuando quieras
          </p>
        </div>
      </div>
    </section>
  );
};

