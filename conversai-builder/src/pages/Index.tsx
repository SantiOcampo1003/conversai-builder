import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { ValuePropositionSection } from "@/components/ValuePropositionSection";
// import { PricingSection } from "@/components/PricingSection";
import { FlowFormSection } from "@/components/FlowFormSection";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Detectar si viene de un email de recuperación de contraseña
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      // Redirigir a la página de reset password manteniendo el hash
      navigate('/reset-password' + hash, { replace: true });
    }
  }, [navigate]);

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
