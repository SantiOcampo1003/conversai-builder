import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Send, Phone, Video, MoreVertical, RefreshCw, Copy, Check, CheckCheck, Loader2 } from "lucide-react";
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
  const [searchParams] = useSearchParams();
  
  // Prioridad: 1. Props, 2. URL params, 3. localStorage, 4. default
  const urlAgentId = searchParams.get('agentId');
  const agentId = propsAgentId || urlAgentId || localStorage.getItem('currentAgentId') || "demo";
  
  // Guardar en localStorage si viene de URL
  useEffect(() => {
    if (urlAgentId) {
      localStorage.setItem('currentAgentId', urlAgentId);
    }
  }, [urlAgentId]);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [userMessageCount, setUserMessageCount] = useState(0);
  const [reachedLimit, setReachedLimit] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
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
    if (!inputMessage.trim() || reachedLimit) return;

    // Incrementar contador de mensajes del usuario
    const newCount = userMessageCount + 1;
    setUserMessageCount(newCount);

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

    // Si alcanzó el límite de 20 mensajes, mostrar CTA
    if (newCount >= 20) {
      // ⭐ BLOQUEAR INMEDIATAMENTE
      setReachedLimit(true);
      setShowContactForm(true);
      
      setTimeout(() => {
        setMessages(prev => prev.map(msg => 
          msg.id === userMessage.id ? { ...msg, status: "read" as const } : msg
        ));

        const ctaMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: "🎉 ¡Veo que te está gustando el agente!\n\n✨ Como puedes ver, funciona muy bien.\n\n💼 ¿Te gustaría conectar este agente a tu WhatsApp de ventas real?\n\n📱 Déjanos tus datos y te contactamos en menos de 10 minutos para activarlo.",
          sender: "agent",
          timestamp: new Date(),
          status: "read"
        };
        setMessages(prev => [...prev, ctaMessage]);
        setIsTyping(false);
      }, 1500);
      return;
    }

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

      // URL de producción
      const webhookUrl = 'https://easy-agents-n8n.ftppdk.easypanel.host/webhook/chat-message';
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId,
          userId: `web_user_${Date.now()}`,
          messageText: inputMessage,
          conversationHistory,
          sessionId: `session_${agentId}`,
          timestamp: new Date().toISOString()
        }),
      });

      const data = await response.json();
      console.log('Respuesta del webhook:', data);
      
      setTimeout(() => {
        // Marcar como leído
        setMessages(prev => prev.map(msg => 
          msg.id === userMessage.id ? { ...msg, status: "read" as const } : msg
        ));

        const agentMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: data.response || data.output || data.message || data.text || "Lo siento, no pude procesar tu mensaje. Intenta de nuevo.",
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
    setFormSubmitted(false);
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
      const response = await fetch('https://easy-agents-n8n.ftppdk.easypanel.host/webhook/contact-lead', {
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
        const submittedName = contactData.name;
        const submittedPhone = contactData.phone;
        const submittedEmail = contactData.email;
        
        toast({
          title: "¡Gracias!",
          description: "Te contactaremos muy pronto 🚀",
        });
        setShowContactForm(false);
        setFormSubmitted(true); // ⭐ Marcar como enviado
        setContactData({ name: "", email: "", phone: "" });
        
        // Mensaje de confirmación
        const confirmMessage: Message = {
          id: (Date.now() + 2).toString(),
          text: `¡Perfecto ${submittedName}! 🎉\n\nYa tenemos tus datos. Te contactaremos a ${submittedPhone} o ${submittedEmail} en los próximos minutos.\n\n¡Gracias por confiar en easy!`,
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
    <div className="max-w-6xl mx-auto h-full flex items-center justify-center">
      <Card className="overflow-hidden shadow-2xl border-2 border-primary/40 shadow-primary/20 bg-gradient-to-br from-card/95 to-card/90 backdrop-blur-xl relative w-full flex flex-col" style={{ height: 'calc(100vh - 200px)', maxHeight: '800px', minHeight: '600px' }}>
        {/* Header estilo WhatsApp */}
        <div className="flex-shrink-0 bg-gradient-to-r from-primary via-primary/95 to-primary/90 text-white p-5 backdrop-blur-xl border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <div className="absolute inset-0 bg-white/20 rounded-full blur-md group-hover:blur-lg transition-all" />
                <div className="relative w-14 h-14 bg-gradient-to-br from-white/30 to-white/10 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-2xl ring-2 ring-white/40 backdrop-blur-sm">
                  {agentName.charAt(0)}
                </div>
                {isOnline && (
                  <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-400 rounded-full border-3 border-primary shadow-lg animate-pulse"></div>
                )}
              </div>
              <div>
                <h3 className="font-bold text-lg mb-0.5">{agentName}</h3>
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
          className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-[#f0ebe5] to-[#efeae2] relative"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d9d9d9' fill-opacity='0.08'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
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
                className={`max-w-[75%] rounded-2xl px-4 py-3 shadow-lg backdrop-blur-sm transition-all hover:scale-[1.02] ${
                  message.sender === "user"
                    ? "bg-gradient-to-br from-[#d9fdd3] to-[#c8f0c3] text-gray-900 rounded-tr-none border border-green-200/50"
                    : "bg-gradient-to-br from-white to-gray-50 text-gray-900 rounded-tl-none border border-gray-200/50"
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
            <form onSubmit={handleContactSubmit} className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-5 mb-4 shadow-2xl border-2 border-primary/30 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center text-white shadow-lg text-lg">
                  📝
                </div>
                <h3 className="text-base font-bold text-gray-900">Conecta tu WhatsApp</h3>
              </div>
              <p className="text-xs text-gray-600 mb-4">Te contactaremos en menos de 10 minutos para activar tu agente</p>
              <div className="space-y-3">
                <Input
                  type="text"
                  placeholder="Tu nombre completo"
                  value={contactData.name}
                  onChange={(e) => setContactData({...contactData, name: e.target.value})}
                  className="text-sm border-2 border-gray-200 focus:border-primary transition-all"
                  required
                />
                <Input
                  type="email"
                  placeholder="Tu email"
                  value={contactData.email}
                  onChange={(e) => setContactData({...contactData, email: e.target.value})}
                  className="text-sm border-2 border-gray-200 focus:border-primary transition-all"
                  required
                />
                <Input
                  type="tel"
                  placeholder="Tu teléfono (WhatsApp)"
                  value={contactData.phone}
                  onChange={(e) => setContactData({...contactData, phone: e.target.value})}
                  className="text-sm border-2 border-gray-200 focus:border-primary transition-all"
                  required
                />
                <Button
                  type="submit"
                  disabled={isSubmittingContact}
                  className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white shadow-lg hover:shadow-xl transition-all h-12 text-base font-semibold"
                >
                  {isSubmittingContact ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Enviando...
                    </span>
                  ) : (
                    "Conectar mi WhatsApp 🚀"
                  )}
                </Button>
              </div>
            </form>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input de mensaje */}
        <div className="flex-shrink-0 bg-gradient-to-r from-[#f5f5f5] via-[#f0f0f0] to-[#f5f5f5] p-5 border-t border-border/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={formSubmitted ? "Gracias por tu interés. Te contactaremos pronto 🚀" : (reachedLimit ? "Por favor completa el formulario para continuar..." : "Escribe tu mensaje...")}
              className="flex-1 bg-white text-gray-900 placeholder:text-gray-500 border-2 border-gray-200/50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary/50 rounded-full px-6 py-6 font-normal text-base shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isTyping || reachedLimit}
            />
                <Button
                  onClick={sendMessage}
                  disabled={!inputMessage.trim() || isTyping || reachedLimit}
              className="bg-gradient-to-br from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white rounded-full h-14 w-14 p-0 shadow-xl shadow-primary/40 transition-all hover:scale-110 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed relative group"
            >
              <div className="absolute inset-0 bg-white/20 rounded-full blur-md group-hover:blur-lg transition-all" />
              <Send className="w-6 h-6 relative z-10" />
            </Button>
          </div>
        </div>
      </Card>

    </div>
  );
};
