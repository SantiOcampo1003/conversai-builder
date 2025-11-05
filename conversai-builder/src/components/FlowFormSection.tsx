import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Bot, MessageSquare } from "lucide-react";

interface FlowState {
  id: string;
  description: string;
  action: string;
}

export const FlowFormSection = () => {
  const navigate = useNavigate();
  const [overallFlow, setOverallFlow] = useState("");
  const [flowStates, setFlowStates] = useState<FlowState[]>([
    { id: "1", description: "", action: "" }
  ]);
  const [problems, setProblems] = useState("");
  const [improvements, setImprovements] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const addFlowState = () => {
    const newId = (flowStates.length + 1).toString();
    setFlowStates([...flowStates, { id: newId, description: "", action: "" }]);
  };

  const removeFlowState = (id: string) => {
    if (flowStates.length > 1) {
      setFlowStates(flowStates.filter(state => state.id !== id));
    }
  };

  const updateFlowState = (id: string, field: keyof FlowState, value: string) => {
    setFlowStates(flowStates.map(state => 
      state.id === id ? { ...state, [field]: value } : state
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('http://localhost:5678/webhook/flow-submission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          overallFlow,
          flowStates,
          problems,
          improvements,
          email
        }),
      });

      const data = await response.json();
      
      if (data.success && data.agentId) {
        // Guardar agentId en localStorage
        localStorage.setItem('currentAgentId', data.agentId);
        setSubmitted(true);
      } else {
        alert('Error al enviar el flujo: ' + (data.message || 'No se recibió agentId'));
      }
    } catch (error) {
      console.error('Error al enviar:', error);
      alert('Error al enviar el flujo. Por favor intenta de nuevo.');
    }
  };

  if (submitted) {
    return (
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-8">
            <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto mb-6 glow-effect">
              <Bot className="w-10 h-10 text-primary-foreground" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              ¡Flujo <span className="gradient-text">recibido correctamente!</span> 🎉
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Tu agente está listo para probar. Puedes interactuar con él en el simulador de WhatsApp.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => navigate('/chat-test')}
              className="px-8 py-4 text-lg bg-primary hover:bg-primary/90 text-primary-foreground glow-effect gap-2"
            >
              <MessageSquare className="w-5 h-5" />
              Probar mi agente en WhatsApp
            </Button>
            <Button
              onClick={() => setSubmitted(false)}
              variant="outline"
              className="px-8 py-4 text-lg"
            >
              Crear otro flujo
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <Bot className="w-16 h-16 mx-auto mb-6 text-primary glow-effect" />
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Mapea tu flujo de <span className="gradient-text">ventas actual</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Describe paso a paso cómo vendes por WhatsApp y nosotros lo convertiremos en un agente conversacional inteligente
          </p>
        </div>

        <Card className="tech-border animate-pulse-glow">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Overall Flow Description */}
              <div className="space-y-3">
                <Label htmlFor="overall-flow" className="text-lg font-semibold">
                  Describe tu flujo de ventas actual
                </Label>
                <Textarea
                  id="overall-flow"
                  value={overallFlow}
                  onChange={(e) => setOverallFlow(e.target.value)}
                  placeholder="Ejemplo: Primero saludo al cliente, luego pregunto qué producto le interesa, después envío el catálogo..."
                  className="min-h-[120px] bg-secondary/50 border-border resize-none"
                />
              </div>

              {/* Flow States */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <Label className="text-lg font-semibold">Estados de tu flujo</Label>
                  <Button
                    type="button"
                    onClick={addFlowState}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar estado
                  </Button>
                </div>

                {flowStates.map((state, index) => (
                  <Card key={state.id} className="border-border/50 bg-secondary/30">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">
                          {index + 1}
                        </div>
                        <div className="flex-1 space-y-4">
                          <div>
                            <Label className="text-sm font-medium mb-2 block">
                              ¿Qué ocurre en este estado?
                            </Label>
                            <Input
                              value={state.description}
                              onChange={(e) => updateFlowState(state.id, "description", e.target.value)}
                              placeholder="Ejemplo: Cliente pregunta por precios"
                              className="bg-background/50"
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium mb-2 block">
                              ¿Qué hace el usuario o qué debería responder el bot?
                            </Label>
                            <Input
                              value={state.action}
                              onChange={(e) => updateFlowState(state.id, "action", e.target.value)}
                              placeholder="Ejemplo: Envío lista de precios y pregunto cuál le interesa"
                              className="bg-background/50"
                            />
                          </div>
                        </div>
                        {flowStates.length > 1 && (
                          <Button
                            type="button"
                            onClick={() => removeFlowState(state.id)}
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Problems Section */}
              <div className="space-y-3">
                <Label htmlFor="problems" className="text-lg font-semibold">
                  ¿Qué problemas has tenido con bots o personas que no entienden tu flujo?
                </Label>
                <Textarea
                  id="problems"
                  value={problems}
                  onChange={(e) => setProblems(e.target.value)}
                  placeholder="Ejemplo: Los bots genéricos no entienden mis productos específicos, o mis empleados no siguen el script..."
                  className="min-h-[100px] bg-secondary/50 border-border resize-none"
                />
              </div>

              {/* Improvements Section */}
              <div className="space-y-3">
                <Label htmlFor="improvements" className="text-lg font-semibold">
                  ¿Qué mejorarías si tuvieras un agente que entendiera tu flujo?
                </Label>
                <Textarea
                  id="improvements"
                  value={improvements}
                  onChange={(e) => setImprovements(e.target.value)}
                  placeholder="Ejemplo: Respuestas más rápidas, seguimiento automático, mejor calificación de leads..."
                  className="min-h-[100px] bg-secondary/50 border-border resize-none"
                />
              </div>

              {/* Email Capture */}
              <div className="space-y-3">
                <Label htmlFor="email" className="text-lg font-semibold">
                  Email para contactarte sobre tu agente
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="bg-secondary/50 border-border"
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full text-lg py-6 bg-primary hover:bg-primary/90 text-primary-foreground glow-effect"
              >
                🚀 Enviar mi flujo y montar mi agente
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};