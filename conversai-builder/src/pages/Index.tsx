import { HeroSection } from "@/components/HeroSection";
import { ValuePropositionSection } from "@/components/ValuePropositionSection";
import { FlowFormSection } from "@/components/FlowFormSection";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <HeroSection />
      <ValuePropositionSection />
      <div id="flow-form">
        <FlowFormSection />
      </div>
    </div>
  );
};

export default Index;
