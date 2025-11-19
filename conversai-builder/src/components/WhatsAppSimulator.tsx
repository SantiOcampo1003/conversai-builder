import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Send, Phone, Video, MoreVertical, RefreshCw, Copy, Check, CheckCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  text: string;
  sender: "user" | "agent";
  timestamp: Date;
  status?: "sent" | "delivered" | "read";
}

interface WhatsAppSimulatorProps {
  agentId?: string;
  agentName?: string;
}

export const WhatsAppSimulator = ({ 
  agentId: propsAgentId,
  agentName = "Agente de Ventas" 
}: WhatsAppSimulatorProps) => {
  const { toast } = useToast();
  const agentId = propsAgentId || localStorage.getItem('currentAgentId') || "demo";
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "¡Hola! 👋 Soy tu agente de ventas virtual. ¿En qué puedo ayudarte hoy?",
      sender: "agent",
      timestamp: new Date(),
      status: "read"
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [userMessageCount, setUserMessageCount] = useState(0);
  const [reachedLimit, setReachedLimit] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactData, setContactData] = useState({ name: "", email: "", phone: "" });
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Simular estado "en línea"
  useEffect(() => {
    const interval = setInterval(() => {
      setIsOnline(prev => prev);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const sendMessage = async () => {
    if (!inputMessage.trim()) return; // TEMPORALMENTE: removido reachedLimit

    // TEMPORALMENTE DESHABILITADO: Incrementar contador de mensajes del usuario
    // const newCount = userMessageCount + 1;
    // setUserMessageCount(newCount);

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputMessage,
      sender: "user",
      timestamp: new Date(),
      status: "sent"
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsTyping(true);

    // TEMPORALMENTE DESHABILITADO: Si alcanzó el límite de 4 mensajes, mostrar CTA
    // if (newCount >= 4) {
    //   setTimeout(() => {
    //     setMessages(prev => prev.map(msg => 
    //       msg.id === userMessage.id ? { ...msg, status: "read" as const } : msg
    //     ));

    //     const ctaMessage: Message = {
    //       id: (Date.now() + 1).toString(),
    //       text: "🎉 ¡Wow! Veo que te está gustando tu agente. \n\n✨ Esta es solo una demostración. \n\n¿Te gustaría tener este agente trabajando 24/7 en tu WhatsApp real?\n\n💬 Déjanos tus datos y te contactamos en menos de 10 minutos.",
    //       sender: "agent",
    //       timestamp: new Date(),
    //       status: "read"
    //     };
    //     setMessages(prev => [...prev, ctaMessage]);
    //     setIsTyping(false);
    //     setReachedLimit(true);
    //     setShowContactForm(true);
    //   }, 1500);
    //   return;
    // }

    // Simular cambio de estado del mensaje
    setTimeout(() => {
      setMessages(prev => prev.map(msg => 
        msg.id === userMessage.id ? { ...msg, status: "delivered" as const } : msg
      ));
    }, 500);

    try {
      const conversationHistory = messages
        .slice(-10)
        .map(msg => ({
          role: msg.sender === "user" ? "user" : "assistant",
          content: msg.text
        }));

      const response = await fetch('https://span-been-pushing-spirituality.trycloudflare.com/webhook/chat-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId,
          message: inputMessage,
          conversationHistory,
          sessionId: `session_${agentId}`,
          timestamp: new Date().toISOString()
        }),
      });

      const data = await response.json();
      
      setTimeout(() => {
        // Marcar como leído
        setMessages(prev => prev.map(msg => 
          msg.id === userMessage.id ? { ...msg, status: "read" as const } : msg
        ));

        const agentMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: data.response || data.message || data.text || "Lo siento, no pude procesar tu mensaje. Intenta de nuevo.",
          sender: "agent",
          timestamp: new Date(),
          status: "read"
        };
        setMessages(prev => [...prev, agentMessage]);
        setIsTyping(false);
      }, 1500);

    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      setIsTyping(false);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "Disculpa, tuve un problema técnico. ¿Puedes intentar de nuevo?",
        sender: "agent",
        timestamp: new Date(),
        status: "read"
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const resetConversation = () => {
    setMessages([
      {
        id: "1",
        text: "¡Hola! 👋 Soy tu agente de ventas virtual. ¿En qué puedo ayudarte hoy?",
        sender: "agent",
        timestamp: new Date(),
        status: "read"
      }
    ]);
    setUserMessageCount(0);
    setReachedLimit(false);
    setShowContactForm(false);
    setContactData({ name: "", email: "", phone: "" });
    toast({
      title: "Conversación reiniciada",
      description: "Puedes empezar una nueva conversación",
    });
  };

  const copyConversation = () => {
    const text = messages
      .map(msg => `${msg.sender === "user" ? "Tú" : agentName}: ${msg.text}`)
      .join('\n\n');
    
    navigator.clipboard.writeText(text);
    toast({
      title: "Conversación copiada",
      description: "El texto ha sido copiado al portapapeles",
    });
  };

  // Función para convertir URLs en links clickeables
  const renderMessageWithLinks = (text: string) => {
    // Regex más estricta que captura solo URLs válidas sin caracteres extra
    const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        // Limpiar el link removiendo puntos, comas o paréntesis al final
        let cleanUrl = part.replace(/[.,;:!?)]+$/, '');
        
        return (
          <a 
            key={index}
            href={cleanUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              // Prevenir el comportamiento por defecto y abrir en nueva pestaña manualmente
              e.preventDefault();
              window.open(cleanUrl, '_blank', 'noopener,noreferrer');
            }}
            className="text-blue-600 hover:text-blue-800 underline font-medium break-all cursor-pointer"
          >
            {cleanUrl}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!contactData.name || !contactData.email || !contactData.phone) {
      toast({
        title: "Datos incompletos",
        description: "Por favor completa todos los campos",
        variant: "destructive"
      });
      return;
    }

    setIsSubmittingContact(true);

    try {
      // Enviar datos de contacto al webhook
      const response = await fetch('https://span-been-pushing-spirituality.trycloudflare.com/webhook/contact-lead', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...contactData,
          agentId,
          source: 'chat-simulator',
          timestamp: new Date().toISOString()
        }),
      });

      if (response.ok) {
        toast({
          title: "¡Gracias!",
          description: "Te contactaremos muy pronto 🚀",
        });
        setShowContactForm(false);
        
        // Mensaje de confirmación
        const confirmMessage: Message = {
          id: (Date.now() + 2).toString(),
          text: `¡Perfecto ${contactData.name}! 🎉\n\nYa tenemos tus datos. Te contactaremos a ${contactData.phone} o ${contactData.email} en los próximos minutos.\n\n¡Gracias por confiar en easy!`,
          sender: "agent",
          timestamp: new Date(),
          status: "read"
        };
        setMessages(prev => [...prev, confirmMessage]);
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Hubo un problema. Intenta de nuevo.",
        variant: "destructive"
      });
    } finally {
      setIsSubmittingContact(false);
    }
  };

  const getStatusIcon = (status?: string) => {
    if (status === "read") return <CheckCheck className="w-3 h-3 text-blue-500" />;
    if (status === "delivered") return <CheckCheck className="w-3 h-3 text-gray-400" />;
    return <Check className="w-3 h-3 text-gray-400" />;
  };

  return (
    <div className="max-w-md mx-auto">
      <Card className="overflow-hidden shadow-2xl border-2 border-primary/30 shadow-primary/10">
        {/* Header estilo WhatsApp */}
        <div className="bg-primary text-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-11 h-11 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg ring-2 ring-white/30">
                  {agentName.charAt(0)}
                </div>
                {isOnline && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-primary"></div>
                )}
              </div>
              <div>
                <h3 className="font-semibold text-base">{agentName}</h3>
                <p className="text-xs text-white/90 flex items-center gap-1">
                  {isTyping ? (
                    <>
                      <span className="animate-pulse">escribiendo</span>
                      <span className="flex gap-0.5">
                        <span className="w-1 h-1 bg-white/90 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-1 h-1 bg-white/90 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-1 h-1 bg-white/90 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </span>
                    </>
                  ) : (
                    "en línea"
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={copyConversation}
                className="text-white hover:bg-white/20 h-9 w-9"
                title="Copiar conversación"
              >
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={resetConversation}
                className="text-white hover:bg-white/20 h-9 w-9"
                title="Reiniciar conversación"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 h-9 w-9"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Área de mensajes */}
        <div 
          className="h-[550px] overflow-y-auto p-4 bg-[#efeae2] relative"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d9d9d9' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}
        >
          {messages.map((message) => (
            <div
              key={message.id}
              className={`mb-3 flex ${
                message.sender === "user" ? "justify-end" : "justify-start"
              } animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 shadow-md ${
                  message.sender === "user"
                    ? "bg-[#d9fdd3] text-gray-900 rounded-tr-none"
                    : "bg-white text-gray-900 rounded-tl-none"
                }`}
              >
                <p className="text-[15px] font-normal whitespace-pre-wrap break-words leading-relaxed text-gray-900">
                  {renderMessageWithLinks(message.text)}
                </p>
                <div className="flex items-center justify-end gap-1 mt-1">
                  <span className="text-[10px] text-gray-500">
                    {message.timestamp.toLocaleTimeString('es-ES', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                  {message.sender === "user" && getStatusIcon(message.status)}
                </div>
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex justify-start mb-3 animate-in fade-in slide-in-from-bottom-2">
              <div className="bg-white rounded-lg rounded-tl-none px-4 py-3 shadow-md">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}

          {/* Formulario de contacto cuando se alcanza el límite */}
          {showContactForm && (
            <form onSubmit={handleContactSubmit} className="bg-white rounded-lg p-4 mb-3 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-500">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Déjanos tus datos 📝</h3>
              <div className="space-y-3">
                <Input
                  type="text"
                  placeholder="Tu nombre completo"
                  value={contactData.name}
                  onChange={(e) => setContactData({...contactData, name: e.target.value})}
                  className="text-sm"
                  required
                />
                <Input
                  type="email"
                  placeholder="Tu email"
                  value={contactData.email}
                  onChange={(e) => setContactData({...contactData, email: e.target.value})}
                  className="text-sm"
                  required
                />
                <Input
                  type="tel"
                  placeholder="Tu teléfono (WhatsApp)"
                  value={contactData.phone}
                  onChange={(e) => setContactData({...contactData, phone: e.target.value})}
                  className="text-sm"
                  required
                />
                <Button
                  type="submit"
                  disabled={isSubmittingContact}
                  className="w-full bg-primary hover:bg-primary/90 text-white"
                >
                  {isSubmittingContact ? "Enviando..." : "Enviar datos 🚀"}
                </Button>
              </div>
            </form>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input de mensaje */}
        <div className="bg-[#f0f0f0] p-3 border-t border-border/50">
          <div className="flex items-center gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Escribe un mensaje..."
              className="flex-1 bg-white text-gray-900 placeholder:text-gray-600 border-none focus-visible:ring-2 focus-visible:ring-primary rounded-full px-4 font-normal text-[15px]"
              disabled={isTyping}
            />
                <Button
                  onClick={sendMessage}
                  disabled={!inputMessage.trim() || isTyping}
              className="bg-primary hover:bg-primary/90 text-white rounded-full h-11 w-11 p-0 shadow-lg shadow-primary/30 transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Info adicional */}
      <div className="mt-4 text-center">
        <p className="text-sm text-muted-foreground">
          💡 Este es un simulador. El agente responderá según tu configuración.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Agent ID: <code className="bg-secondary px-2 py-0.5 rounded">{agentId}</code>
        </p>
      </div>
    </div>
  );
};
