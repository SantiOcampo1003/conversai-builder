import { Navbar } from "@/components/Navbar";
import { WhatsAppSimulator } from "@/components/WhatsAppSimulator";
import { Button } from "@/components/ui/button";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Sparkles, MessageSquare, Zap } from "lucide-react";

const ChatTest = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const agentIdFromUrl = searchParams.get('agentId');

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background overflow-hidden relative">
      {/* Efectos de fondo futuristas */}
      <div className="absolute inset-0 bg-grid-white/[0.02] pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-20 animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl opacity-20 animate-pulse" style={{animationDelay: '1s'}} />
      
      <Navbar />
      <div className="relative z-10 px-4 py-6 min-h-screen flex items-center justify-center">
        <div className="max-w-7xl mx-auto w-full">
          {/* Header compacto */}
          <div className="mb-6 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="gap-2 hover:gap-3 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver
            </Button>
            
            <div className="flex items-center gap-3 bg-gradient-to-r from-primary/20 to-blue-500/20 backdrop-blur-xl px-4 py-2 rounded-full border border-primary/30">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium">Agente Activo</span>
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
          </div>

          {/* Chat Protagonista */}
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-blue-500/20 to-purple-500/20 rounded-3xl blur-2xl opacity-30 -z-10" />
            
            <WhatsAppSimulator 
              agentId={agentIdFromUrl || undefined}
              agentName="Mi Agente de Ventas" 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatTest;

