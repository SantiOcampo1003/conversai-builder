import { WhatsAppSimulator } from "@/components/WhatsAppSimulator";

const ChatTest = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-darker-surface via-background to-darker-surface py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">
            Prueba tu <span className="gradient-text">Agente de WhatsApp</span>
          </h1>
          <p className="text-xl text-muted-foreground">
            Interactúa con tu agente personalizado en tiempo real
          </p>
        </div>

        <WhatsAppSimulator 
          agentName="Mi Agente de Ventas" 
        />

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>💡 Este es un simulador. El agente responderá según el flujo que configuraste.</p>
        </div>
      </div>
    </div>
  );
};

export default ChatTest;

