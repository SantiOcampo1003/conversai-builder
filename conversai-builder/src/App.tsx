import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { usePreferencesStore } from "@/stores/usePreferencesStore";
import Index from "./pages/Index";
import ChatTest from "./pages/ChatTest";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import AgentEditor from "./pages/AgentEditor";
import NotFound from "./pages/NotFound";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentFailure from "./pages/PaymentFailure";
import PaymentPending from "./pages/PaymentPending";
import AcceptInvite from "./pages/AcceptInvite";

const queryClient = new QueryClient();

// Aplica tema y tamaño de fuente al <html> desde el store
function PreferencesApplier() {
  const { theme, fontSize } = usePreferencesStore()

  useEffect(() => {
    const html = document.documentElement
    // Tema
    html.classList.remove('light', 'dark')
    html.classList.add(theme)
    // Tamaño de fuente
    html.classList.remove('font-size-sm', 'font-size-md', 'font-size-lg')
    html.classList.add(`font-size-${fontSize}`)
  }, [theme, fontSize])

  return null
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<Login />} />
      <Route path="/chat-test" element={<ChatTest />} />
      <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/dashboard/agent/:agentId" element={<PrivateRoute><AgentEditor /></PrivateRoute>} />
      <Route path="/payment/success" element={<PaymentSuccess />} />
      <Route path="/payment/failure" element={<PaymentFailure />} />
      <Route path="/payment/pending" element={<PaymentPending />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PreferencesApplier />
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
