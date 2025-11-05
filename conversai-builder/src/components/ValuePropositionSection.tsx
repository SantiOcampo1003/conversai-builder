import { CheckCircle, AlertTriangle, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const ValuePropositionSection = () => {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-background to-darker-surface">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            ¿Por qué necesitas un{" "}
            <span className="gradient-text">agente inteligente</span>?
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Los bots genéricos y equipos mal entrenados están costándote ventas. 
            Nosotros solucionamos eso con IA que entiende tu negocio.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-16">
          {/* Problem */}
          <Card className="border-destructive/20 bg-destructive/5">
            <CardContent className="p-8 text-center">
              <AlertTriangle className="w-16 h-16 mx-auto mb-6 text-destructive" />
              <h3 className="text-xl font-bold mb-4 text-destructive">El problema actual</h3>
              <ul className="space-y-3 text-left text-muted-foreground">
                <li>• Bots que no entienden tu producto</li>
                <li>• Empleados que no siguen el script</li>
                <li>• Respuestas inconsistentes</li>
                <li>• Pérdida de leads calificados</li>
                <li>• Clientes frustrados</li>
              </ul>
            </CardContent>
          </Card>

          {/* Solution */}
          <Card className="border-primary/20 bg-primary/5 transform scale-105">
            <CardContent className="p-8 text-center">
              <CheckCircle className="w-16 h-16 mx-auto mb-6 text-primary glow-effect" />
              <h3 className="text-xl font-bold mb-4 text-primary">Nuestra solución</h3>
              <ul className="space-y-3 text-left text-muted-foreground">
                <li>• Agente que conoce tu flujo exacto</li>
                <li>• Respuestas personalizadas 24/7</li>
                <li>• Seguimiento automático de leads</li>
                <li>• Escalación inteligente</li>
                <li>• Mejora continua con datos</li>
              </ul>
            </CardContent>
          </Card>

          {/* Results */}
          <Card className="border-neon-cyan/20 bg-neon-cyan/5">
            <CardContent className="p-8 text-center">
              <TrendingUp className="w-16 h-16 mx-auto mb-6 text-neon-cyan glow-accent" />
              <h3 className="text-xl font-bold mb-4 text-neon-cyan">Resultados esperados</h3>
              <ul className="space-y-3 text-left text-muted-foreground">
                <li>• +40% más conversiones</li>
                <li>• Respuesta inmediata siempre</li>
                <li>• 0 leads perdidos por horarios</li>
                <li>• Experiencia consistente</li>
                <li>• Escalabilidad sin límites</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Process Steps */}
        <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-xl p-8">
          <h3 className="text-2xl font-bold text-center mb-8">
            Cómo funciona nuestro proceso
          </h3>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-lg mx-auto mb-4 glow-effect">
                1
              </div>
              <h4 className="font-semibold mb-2">Describes tu flujo</h4>
              <p className="text-sm text-muted-foreground">
                Nos cuentas paso a paso cómo vendes actualmente
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-neon-cyan rounded-full flex items-center justify-center text-background font-bold text-lg mx-auto mb-4 glow-accent">
                2
              </div>
              <h4 className="font-semibold mb-2">Analizamos y optimizamos</h4>
              <p className="text-sm text-muted-foreground">
                Identificamos mejoras y creamos la lógica conversacional
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-tech-blue rounded-full flex items-center justify-center text-background font-bold text-lg mx-auto mb-4">
                3
              </div>
              <h4 className="font-semibold mb-2">Desarrollamos tu agente</h4>
              <p className="text-sm text-muted-foreground">
                Creamos un agente IA específico para tu negocio
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-lg mx-auto mb-4 glow-effect">
                4
              </div>
              <h4 className="font-semibold mb-2">Implementación y mejora</h4>
              <p className="text-sm text-muted-foreground">
                Conectamos a WhatsApp y optimizamos con datos reales
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};