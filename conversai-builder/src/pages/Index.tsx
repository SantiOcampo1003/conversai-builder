import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { ValuePropositionSection } from "@/components/ValuePropositionSection";
import { PricingSection } from "@/components/PricingSection";
import { FlowFormSection } from "@/components/FlowFormSection";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <ValuePropositionSection />
      <div id="flow-form">
        <FlowFormSection />
      </div>
      <PricingSection />
    </div>
  );
};

export default Index;
