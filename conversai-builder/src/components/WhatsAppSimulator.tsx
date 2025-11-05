import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Send, Phone, Video, MoreVertical } from "lucide-react";

interface Message {
  id: string;
  text: string;
  sender: "user" | "agent";
  timestamp: Date;
}

interface WhatsAppSimulatorProps {
  agentId?: string;
  agentName?: string;
}

export const WhatsAppSimulator = ({ 
  agentId: propsAgentId,
  agentName = "Agente de Ventas" 
}: WhatsAppSimulatorProps) => {
  // Usar el agentId de props o del localStorage
  const agentId = propsAgentId || localStorage.getItem('currentAgentId') || "demo";
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "¡Hola! 👋 Soy tu agente de ventas virtual. ¿En qué puedo ayudarte hoy?",
      sender: "agent",
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    // Agregar mensaje del usuario
    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputMessage,
      sender: "user",
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsTyping(true);

    try {
      // Preparar historial de conversación (últimos 10 mensajes)
      const conversationHistory = messages
        .slice(-10)
        .map(msg => ({
          role: msg.sender === "user" ? "user" : "assistant",
          content: msg.text
        }));

      // Enviar a n8n
      const response = await fetch('http://localhost:5678/webhook/chat-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId,
          message: inputMessage,
          conversationHistory,
          sessionId: `session_${agentId}_${Date.now()}`,
          timestamp: new Date().toISOString()
        }),
      });

      const data = await response.json();
      
      // Simular delay de escritura
      setTimeout(() => {
        const agentMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: data.response || data.message || data.text || "Lo siento, no pude procesar tu mensaje. Intenta de nuevo.",
          sender: "agent",
          timestamp: new Date()
        };
        setMessages(prev => [...prev, agentMessage]);
        setIsTyping(false);
      }, 1000);

    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      setIsTyping(false);
      
      // Mensaje de error amigable
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "Disculpa, tuve un problema técnico. ¿Puedes intentar de nuevo?",
        sender: "agent",
        timestamp: new Date()
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

  return (
    <div className="max-w-md mx-auto">
      <Card className="overflow-hidden shadow-2xl">
        {/* Header estilo WhatsApp */}
        <div className="bg-[#075e54] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-gray-700 font-bold">
              {agentName.charAt(0)}
            </div>
            <div>
              <h3 className="font-semibold">{agentName}</h3>
              <p className="text-xs text-gray-200">En línea</p>
            </div>
          </div>
          <div className="flex gap-4">
            <Video className="w-5 h-5 cursor-pointer" />
            <Phone className="w-5 h-5 cursor-pointer" />
            <MoreVertical className="w-5 h-5 cursor-pointer" />
          </div>
        </div>

        {/* Área de mensajes */}
        <div 
          className="h-[500px] overflow-y-auto p-4 bg-[#e5ddd5]"
          style={{
            backgroundImage: "url('data:image/svg+xml,%3Csvg width=\"100\" height=\"100\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cpath d=\"M0 0h100v100H0z\" fill=\"%23e5ddd5\"/%3E%3C/svg%3E')"
          }}
        >
          {messages.map((message) => (
            <div
              key={message.id}
              className={`mb-4 flex ${
                message.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[75%] rounded-lg px-4 py-2 ${
                  message.sender === "user"
                    ? "bg-[#dcf8c6] text-gray-900"
                    : "bg-white text-gray-900 shadow-md"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
                <span className="text-xs text-gray-500 mt-1 block text-right">
                  {message.timestamp.toLocaleTimeString('es-ES', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex justify-start mb-4">
              <div className="bg-white rounded-lg px-4 py-2 shadow-md">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input de mensaje */}
        <div className="bg-[#f0f0f0] p-3 flex items-center gap-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Escribe un mensaje..."
            className="flex-1 bg-white border-none focus:ring-2 focus:ring-[#075e54]"
          />
          <Button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isTyping}
            className="bg-[#075e54] hover:bg-[#128c7e] text-white rounded-full p-3"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </Card>
    </div>
  );
};

