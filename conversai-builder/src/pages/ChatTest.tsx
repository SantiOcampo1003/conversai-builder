import { Navbar } from "@/components/Navbar";
import { WhatsAppSimulator } from "@/components/WhatsAppSimulator";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, MessageSquare, Zap } from "lucide-react";

const ChatTest = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-darker-surface via-background to-darker-surface">
      <Navbar />
      <div className="py-8 px-4 pt-24">
      <div className="max-w-5xl mx-auto">
        {/* Header mejorado */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mb-6 gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a inicio
          </Button>
          
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-4">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Modo Testing</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Prueba tu <span className="gradient-text">Agente de WhatsApp</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Interactúa con tu agente personalizado y verifica que responda correctamente
            </p>
          </div>
        </div>

        {/* Tips rápidos */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="bg-card p-4 rounded-lg border border-border/50">
            <MessageSquare className="w-8 h-8 text-primary mb-2" />
            <h3 className="font-semibold mb-1">Conversa Natural</h3>
            <p className="text-sm text-muted-foreground">
              Habla como lo harías en WhatsApp real
            </p>
          </div>
          <div className="bg-card p-4 rounded-lg border border-border/50">
            <Zap className="w-8 h-8 text-primary mb-2" />
            <h3 className="font-semibold mb-1">Prueba Casos Reales</h3>
            <p className="text-sm text-muted-foreground">
              Simula preguntas frecuentes de tus clientes
            </p>
          </div>
          <div className="bg-card p-4 rounded-lg border border-border/50">
            <Sparkles className="w-8 h-8 text-primary mb-2" />
            <h3 className="font-semibold mb-1">Verifica Respuestas</h3>
            <p className="text-sm text-muted-foreground">
              Confirma que el tono y la info sean correctos
            </p>
          </div>
        </div>

        {/* Simulador */}
        <WhatsAppSimulator 
          agentName="Mi Agente de Ventas" 
        />

        {/* Footer con acciones */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            ¿No te convence? Puedes editar tu agente en cualquier momento
          </p>
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            className="gap-2"
          >
            Editar Configuración del Agente
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
};

export default ChatTest;

