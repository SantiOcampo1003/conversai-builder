import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Bot, ArrowLeft, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10 -z-10" />
      <div className="absolute top-20 right-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-20 left-20 w-72 h-72 bg-primary/5 rounded-full blur-3xl -z-10" />

      <div className="text-center max-w-md">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/20">
              <Bot className="w-10 h-10 text-primary" />
            </div>
            <div className="absolute inset-0 bg-primary/10 rounded-2xl blur-md animate-pulse" />
          </div>
        </div>

        {/* 404 */}
        <h1 className="text-8xl font-black gradient-text mb-2">404</h1>
        <h2 className="text-xl font-semibold text-foreground mb-2">Página no encontrada</h2>
        <p className="text-muted-foreground text-sm mb-8">
          La página <span className="text-primary font-mono">{location.pathname}</span> no existe o fue movida.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={() => navigate('/')}
            variant="outline"
            className="gap-2 border-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio
          </Button>

          {user && (
            <Button
              onClick={() => navigate('/dashboard')}
              className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/30"
            >
              <LayoutDashboard className="w-4 h-4" />
              Ir al Dashboard
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotFound;
