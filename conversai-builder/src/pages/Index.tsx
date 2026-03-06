import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { ValuePropositionSection } from "@/components/ValuePropositionSection";
import { useToast } from "@/hooks/use-toast";
// import { PricingSection } from "@/components/PricingSection";
import { FlowFormSection } from "@/components/FlowFormSection";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const hash = window.location.hash;

    // Detectar si viene de un email de recuperación de contraseña
    if (hash && hash.includes('type=recovery')) {
      // Redirigir a la página de reset password manteniendo el hash
      navigate('/reset-password' + hash, { replace: true });
      return;
    }

    // Detectar si viene de confirmación de email
    if (hash && hash.includes('type=signup')) {
      console.log('✅ Usuario confirmó su email');

      // Mostrar toast de éxito
      const toastShown = sessionStorage.getItem('email_confirmed_toast_shown');
      if (!toastShown) {
        toast({
          title: '✅ Email verificado',
          description: 'Tu email ha sido confirmado exitosamente. Ahora puedes continuar creando tu agente.',
          duration: 5000,
        });
        sessionStorage.setItem('email_confirmed_toast_shown', 'true');
      }

      // Limpiar el hash
      window.history.replaceState({}, '', window.location.pathname);

      // Scroll al formulario para que continue
      setTimeout(() => {
        document.getElementById('flow-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 500);
    }
  }, [navigate, toast]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <ValuePropositionSection />
      <div id="flow-form">
        <FlowFormSection />
      </div>
      {/* <PricingSection /> */}
    </div>
  );
};

export default Index;
