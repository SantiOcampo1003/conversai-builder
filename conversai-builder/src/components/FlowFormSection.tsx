import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Trash2, Bot, MessageSquare, Store, DollarSign, Truck, MessageCircle, Sparkles, CheckCircle2, Zap, ArrowRight, ArrowLeft, Check, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Confetti from "react-confetti";
import { useAuth } from "@/context/AuthContext";
import { AuthModal } from "@/components/AuthModal";
import { useFormStore } from "@/stores/useFormStore";
import { supabase } from "@/lib/supabase";

const STEPS = [
  { id: 1, title: "Negocio", icon: Store, description: "Información básica" },
  { id: 2, title: "Productos", icon: DollarSign, description: "Qué vendes" },
  { id: 3, title: "Pagos", icon: Truck, description: "Formas de pago y envío" },
  { id: 4, title: "FAQ", icon: MessageCircle, description: "Preguntas frecuentes" },
  { id: 5, title: "Personalidad", icon: Sparkles, description: "Tono del agente" },
  { id: 6, title: "Finalizar", icon: CheckCircle2, description: "Email y extras" }
];

export const FlowFormSection = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Estados de UI — no persisten, se resetean al recargar
  const [showConfetti, setShowConfetti] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  // Estado del formulario — persiste en localStorage via Zustand
  const {
    currentStep, setCurrentStep,
    businessName, setBusinessName,
    businessType, setBusinessType,
    businessCategory, setBusinessCategory,
    priceFrom, setPriceFrom,
    priceTo, setPriceTo,
    currency, setCurrency,
    products, addProduct, removeProduct, updateProduct,
    offersDelivery, setOffersDelivery,
    deliveryCost, setDeliveryCost,
    deliveryTime, setDeliveryTime,
    paymentMethods, setPaymentMethods,
    paymentGateway, setPaymentGateway,
    paymentLinks, setPaymentLinks,
    faqs, addFaq, removeFaq, updateFaq,
    commonObjection, setCommonObjection,
    objectionResponse, setObjectionResponse,
    tone, setTone,
    useEmojis, setUseEmojis,
    formalityLevel, setFormalityLevel,
    requiredInfo, setRequiredInfo,
    warranty, setWarranty,
    email, setEmail,
    customInstructions, addInstruction, removeInstruction, updateInstruction,
    resetForm,
  } = useFormStore();

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Al volver del redirect de Google OAuth, hacer scroll al formulario
  useEffect(() => {
    if (user && localStorage.getItem('auth_intent') === 'scroll-to-form') {
      localStorage.removeItem('auth_intent');
      setTimeout(() => {
        document.getElementById('flow-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [user]);

  // Nota: addProduct, removeProduct, updateProduct, addFaq, removeFaq, updateFaq,
  // addInstruction, removeInstruction, updateInstruction vienen del store.

  const togglePaymentMethod = (method: string) => {
    setPaymentMethods(
      paymentMethods.includes(method)
        ? paymentMethods.filter(m => m !== method)
        : [...paymentMethods, method]
    );
  };

  const toggleRequiredInfo = (info: string) => {
    setRequiredInfo(
      requiredInfo.includes(info)
        ? requiredInfo.filter(i => i !== info)
        : [...requiredInfo, info]
    );
  };

  const updatePaymentLink = (productName: string, link: string) => {
    setPaymentLinks({ ...paymentLinks, [productName]: link });
  };

  const canProceedToNextStep = () => {
    switch(currentStep) {
      case 1:
        return businessName && businessCategory && priceFrom && priceTo;
      case 2:
        return products.some(p => p.name && p.price);
      case 3:
        return paymentMethods.length > 0;
      case 4:
        return true;
      case 5:
        return true;
      case 6:
        return email;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 6) {
      // Al avanzar del paso 2, verificar autenticación
      if (currentStep === 2 && !user) {
        setShowAuthModal(true);
        return;
      }
      // Confetti en pasos clave
      if (currentStep === 2 || currentStep === 5) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 2000);
      }
      setCurrentStep(currentStep + 1);
    }
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    // Avanzar al paso 3 con confetti
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 2000);
    setCurrentStep(3);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      if (!user) {
        alert('Debes iniciar sesión para crear un agente.');
        setIsSubmitting(false);
        return;
      }

      // Generar agent_id único basado en el nombre del negocio + timestamp
      const slug = businessName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 30);
      const agentId = `agent_${slug}_${Date.now()}`;

      // 1. Buscar si el usuario ya tiene un cliente
      let clientId: string;

      const { data: existingClient } = await supabase
        .from('clients')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (existingClient) {
        // Reusar el cliente existente
        clientId = existingClient.id;
      } else {
        // Crear un nuevo cliente
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .insert({
            name: businessName,
            email,
            company_name: businessName,
            auth_user_id: user.id,
          })
          .select('id')
          .single();

        if (clientError) {
          console.error('Error creando cliente:', clientError);
          alert(`Error al crear el cliente: ${clientError.message}`);
          return;
        }

        clientId = clientData.id;
      }

      // 2. Crear el agente vinculado al cliente
      const { error: agentError } = await supabase
        .from('agents')
        .insert({
          agent_id: agentId,
          email,
          business_name: businessName,
          business_type: businessType,
          business_category: businessCategory,
          client_id: clientId,
          price_range: { from: priceFrom, to: priceTo, currency },
          products: products.filter(p => p.name && p.price),
          delivery: {
            offers: offersDelivery,
            cost: deliveryCost,
            time: deliveryTime,
          },
          payment_methods: paymentMethods,
          faqs: faqs.filter(f => f.question && f.answer),
          objection_handling: {
            common: commonObjection,
            response: objectionResponse,
          },
          agent_personality: {
            tone,
            useEmojis,
            formalityLevel,
          },
          required_info: requiredInfo,
          warranty,
          payment_gateway: paymentGateway,
          payment_links: paymentGateway !== 'none' ? paymentLinks : {},
          custom_instructions: customInstructions
            .filter(i => i.text.trim())
            .map((i, index) => `${index + 1}. ${i.text}`)
            .join('\n'),
        });

      if (agentError) {
        console.error('Error creando agente:', agentError);
        alert(`Error al crear el agente: ${agentError.message}`);
        return;
      }

      // 3. Vincular el usuario autenticado como admin del cliente
      const { error: memberError } = await supabase
        .from('client_members')
        .insert({
          client_id: clientId,
          auth_user_id: user.id,
          role: 'admin',
          status: 'active',
        });

      if (memberError && memberError.code !== '23505') {
        // 23505 = unique_violation (ya era miembro), no es error crítico
        console.error('Error vinculando miembro:', memberError);
      }

      localStorage.setItem('currentAgentId', agentId);
      setCreatedAgentId(agentId);
      setShowConfetti(true);
      resetForm();
      setTimeout(() => {
        setSubmitted(true);
      }, 500);
    } catch (error) {
      console.error('Error al enviar:', error);
      alert('Error al enviar el flujo. Por favor intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
  return (
      <section className="fixed inset-0 flex items-center justify-center px-4 sm:px-6 lg:px-8 overflow-auto bg-background z-50">
        {showConfetti && <Confetti width={windowSize.width} height={windowSize.height} recycle={false} numberOfPieces={500} />}
        
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-primary/20"></div>
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", duration: 0.6 }}
            className="mb-8"
          >
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse"></div>
              <div className="relative w-32 h-32 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl">
                <Bot className="w-16 h-16 text-primary-foreground" />
              </div>
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring" }}
                className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg"
              >
                <CheckCircle2 className="w-5 h-5 text-white" />
              </motion.div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-6 mb-12"
          >
            <div className="inline-flex items-center gap-2 bg-green-500/10 text-green-500 px-6 py-3 rounded-full mb-4 border border-green-500/20">
              <Sparkles className="w-5 h-5" />
              <span className="text-sm font-semibold">¡Todo listo!</span>
            </div>
            
            <h2 className="text-4xl md:text-6xl font-bold mb-6">
              ¡Agente <span className="gradient-text">creado exitosamente!</span> 🎉
          </h2>
            
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Tu agente personalizado está <span className="text-primary font-semibold">listo y esperando</span> para atender a tus clientes
            </p>

            <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto mt-8">
              {[
                { icon: MessageSquare, label: "Responde 24/7" },
                { icon: Sparkles, label: "Personalizado" },
                { icon: Zap, label: "IA Avanzada" }
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                  className="bg-card/50 backdrop-blur-sm p-4 rounded-xl border border-border/50"
                >
                  <item.icon className="w-8 h-8 text-primary mx-auto mb-2" />
                  <p className="text-sm font-medium">{item.label}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button
              onClick={() => navigate(`/chat-test?agentId=${createdAgentId}`)}
              size="lg"
              className="px-10 py-6 text-lg bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-2xl shadow-primary/50 gap-3 group"
            >
              <MessageSquare className="w-6 h-6 group-hover:scale-110 transition-transform" />
              Probar mi agente ahora
              <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            </Button>
            <Button
              onClick={() => {
                setSubmitted(false);
                setCurrentStep(1);
              }}
              variant="outline"
              size="lg"
              className="px-10 py-6 text-lg border-2 hover:bg-secondary/50"
            >
              Crear otro agente
            </Button>
          </motion.div>

          <p className="mt-8 text-sm text-muted-foreground">
            💡 Tip: Prueba el agente con preguntas reales de tus clientes para verificar su comportamiento
          </p>
        </div>
      </section>
    );
  }

  const progressPercentage = (currentStep / STEPS.length) * 100;

  const renderStepContent = () => {
    switch(currentStep) {
      case 1:
        return (
          <motion.div 
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring" }}
                className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl mb-4 backdrop-blur-sm border border-primary/20"
              >
                <Store className="w-8 h-8 text-primary" />
              </motion.div>
              <h3 className="text-xl font-semibold mb-2">Cuéntanos sobre tu negocio</h3>
              <p className="text-sm text-muted-foreground">Información básica para personalizar tu agente</p>
        </div>

            <div className="space-y-4">
              <motion.div
                whileHover={{ scale: 1.01 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <Label htmlFor="business-name" className="text-sm font-medium mb-2 block flex items-center gap-2">
                  ¿Cómo se llama tu negocio? *
                  {businessName && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring" }}
                    >
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    </motion.span>
                  )}
                </Label>
                <Input
                  id="business-name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Ej: Tienda Moda Express"
                  className="bg-secondary/50 h-11 border-2 focus:border-primary transition-all"
                />
              </motion.div>

              <div className="grid md:grid-cols-2 gap-4">
                <motion.div whileHover={{ scale: 1.01 }}>
                  <Label htmlFor="business-type" className="text-sm font-medium mb-2 block">
                    ¿Qué ofreces? *
                  </Label>
                  <Select value={businessType} onValueChange={setBusinessType}>
                    <SelectTrigger className="bg-secondary/50 h-11 border-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="products">Productos físicos</SelectItem>
                      <SelectItem value="services">Servicios</SelectItem>
                      <SelectItem value="both">Ambos</SelectItem>
                    </SelectContent>
                  </Select>
                </motion.div>

                <motion.div whileHover={{ scale: 1.01 }}>
                  <Label htmlFor="category" className="text-sm font-medium mb-2 block flex items-center gap-2">
                    Categoría *
                    {businessCategory && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                      >
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      </motion.span>
                    )}
                  </Label>
                  <Select value={businessCategory} onValueChange={setBusinessCategory}>
                    <SelectTrigger className="bg-secondary/50 h-11 border-2">
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ropa">Ropa y Moda</SelectItem>
                      <SelectItem value="tecnologia">Tecnología</SelectItem>
                      <SelectItem value="alimentos">Alimentos y Bebidas</SelectItem>
                      <SelectItem value="belleza">Belleza y Cuidado Personal</SelectItem>
                      <SelectItem value="hogar">Hogar y Decoración</SelectItem>
                      <SelectItem value="servicios-profesionales">Servicios Profesionales</SelectItem>
                      <SelectItem value="salud">Salud y Bienestar</SelectItem>
                      <SelectItem value="educacion">Educación</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </motion.div>
              </div>

              <motion.div whileHover={{ scale: 1.01 }}>
                <Label className="text-sm font-medium mb-2 block flex items-center gap-2">
                  Rango de precios *
                  {priceFrom && priceTo && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                    >
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    </motion.span>
                  )}
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={priceFrom}
                    onChange={(e) => setPriceFrom(e.target.value)}
                    placeholder="Desde"
                    className="bg-secondary/50 h-11 border-2"
                  />
                  <Input
                    type="number"
                    value={priceTo}
                    onChange={(e) => setPriceTo(e.target.value)}
                    placeholder="Hasta"
                    className="bg-secondary/50 h-11 border-2"
                  />
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="bg-secondary/50 w-24 h-11 border-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COP">COP</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="MXN">MXN</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </motion.div>
            </div>
          </motion.div>
        );

      case 2:
        return (
          <motion.div 
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring" }}
                className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl mb-4 backdrop-blur-sm border border-primary/20"
              >
                <DollarSign className="w-8 h-8 text-primary" />
              </motion.div>
              <h3 className="text-xl font-semibold mb-2">¿Qué vendes?</h3>
              <p className="text-sm text-muted-foreground">Agrega tus productos o servicios principales</p>
                </div>

            <div className="space-y-4">
              {products.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ delay: index * 0.05, type: "spring" }}
                  whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                >
                  <Card className="border-2 border-border/50 bg-gradient-to-br from-secondary/50 to-secondary/30 backdrop-blur-sm hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/10">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <motion.div 
                          whileHover={{ scale: 1.1 }}
                          className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg"
                        >
                          {index + 1}
                        </motion.div>
                        <div className="flex-1 grid md:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-medium mb-2 block">
                              Nombre
                            </Label>
                            <Input
                              value={product.name}
                              onChange={(e) => updateProduct(product.id, "name", e.target.value)}
                              placeholder="Ej: Camiseta básica"
                              className="bg-background/50 border-2"
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium mb-2 block">
                              Precio
                            </Label>
                            <Input
                              type="number"
                              value={product.price}
                              onChange={(e) => updateProduct(product.id, "price", e.target.value)}
                              placeholder="25000"
                              className="bg-background/50 border-2"
                            />
                          </div>
                        </div>
                        {products.length > 1 && (
                          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                          <Button
                            type="button"
                              onClick={() => removeProduct(product.id)}
                            variant="ghost"
                            size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          </motion.div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}

              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  type="button"
                  onClick={addProduct}
                  variant="outline"
                  className="w-full gap-2 border-dashed border-2 py-6 hover:border-primary hover:bg-primary/5 transition-all"
                >
                  <Plus className="w-5 h-5" />
                  Agregar otro producto
                </Button>
              </motion.div>
            </div>
          </motion.div>
        );

      case 3:
        return (
          <motion.div 
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring" }}
                className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl mb-4 backdrop-blur-sm border border-primary/20"
              >
                <Truck className="w-8 h-8 text-primary" />
              </motion.div>
              <h3 className="text-xl font-semibold mb-2">Formas de pago y envío</h3>
              <p className="text-sm text-muted-foreground">¿Cómo pueden pagarte tus clientes?</p>
            </div>

            <div className="space-y-6">
              <div>
                <Label className="text-sm font-medium mb-3 block flex items-center gap-2">
                  Formas de pago que aceptas *
                  {paymentMethods.length > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                    >
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    </motion.span>
                  )}
                </Label>
                <div className="grid md:grid-cols-2 gap-3">
                  {[
                    { value: "efectivo", label: "💵 Efectivo", desc: "Pago en efectivo" },
                    { value: "transferencia", label: "🏦 Transferencia", desc: "Bancaria" },
                    { value: "nequi", label: "📱 Nequi/Daviplata", desc: "Apps de pago" },
                    { value: "tarjeta", label: "💳 Tarjeta", desc: "Crédito/débito" },
                    { value: "contraentrega", label: "📦 Contraentrega", desc: "Pago al recibir" },
                    { value: "credito", label: "🤝 Crédito", desc: "Pago a plazos" },
                  ].map((method) => (
                    <motion.div
                      key={method.value}
                      onClick={() => togglePaymentMethod(method.value)}
                      whileHover={{ scale: 1.03, y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      className={`
                        cursor-pointer p-4 rounded-xl border-2 transition-all
                        ${paymentMethods.includes(method.value)
                          ? "border-primary bg-gradient-to-br from-primary/20 to-primary/10 shadow-lg shadow-primary/20"
                          : "border-border bg-secondary/30 hover:border-primary/50 hover:shadow-md"
                        }
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{method.label}</p>
                          <p className="text-xs text-muted-foreground">{method.desc}</p>
                        </div>
                        <AnimatePresence>
                          {paymentMethods.includes(method.value) && (
                            <motion.div
                              initial={{ scale: 0, rotate: -180 }}
                              animate={{ scale: 1, rotate: 0 }}
                              exit={{ scale: 0, rotate: 180 }}
                              transition={{ type: "spring" }}
                            >
                              <CheckCircle2 className="w-6 h-6 text-primary" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-border">
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  className="flex items-center space-x-2 mb-4 p-4 rounded-xl bg-secondary/30 cursor-pointer"
                  onClick={() => setOffersDelivery(!offersDelivery)}
                >
                  <Checkbox
                    id="delivery"
                    checked={offersDelivery}
                    onCheckedChange={(checked) => setOffersDelivery(checked as boolean)}
                  />
                  <Label htmlFor="delivery" className="text-sm font-medium cursor-pointer flex-1">
                    ¿Ofreces envío o domicilio?
                  </Label>
                  {offersDelivery && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                </motion.div>

                <AnimatePresence>
                  {offersDelivery && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ type: "spring" }}
                      className="grid md:grid-cols-2 gap-4 mt-4 pb-2"
                    >
                      <div>
                        <Label className="text-sm font-medium mb-2 block">
                          Costo de envío
                        </Label>
                        <Input
                          value={deliveryCost}
                          onChange={(e) => setDeliveryCost(e.target.value)}
                          placeholder="Ej: Gratis sobre $50000"
                          className="bg-secondary/50 border-2"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium mb-2 block">
                          Tiempo de entrega
                        </Label>
                        <Input
                          value={deliveryTime}
                          onChange={(e) => setDeliveryTime(e.target.value)}
                          placeholder="Ej: 2-3 días hábiles"
                          className="bg-secondary/50 border-2"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="pt-6 border-t border-border">
                <Label className="text-base font-semibold mb-3 block">
                  Pasarela de pago online (opcional)
                </Label>
                <p className="text-sm text-muted-foreground mb-4">
                  ¿Tus productos tienen checkout online?
                </p>
                
                <Select value={paymentGateway} onValueChange={setPaymentGateway}>
                  <SelectTrigger className="bg-secondary/50 border-2">
                    <SelectValue placeholder="Selecciona una plataforma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguna</SelectItem>
                    <SelectItem value="hotmart">Hotmart</SelectItem>
                    <SelectItem value="stripe">Stripe</SelectItem>
                    <SelectItem value="mercadopago">MercadoPago</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="other">Otra</SelectItem>
                  </SelectContent>
                </Select>

                <AnimatePresence>
                  {paymentGateway !== 'none' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3 mt-4 overflow-hidden"
                    >
                      <Label className="text-sm font-medium">
                        Links de pago por producto
                      </Label>
                      {products.filter(p => p.name).map((product, i) => (
                        <motion.div
                          key={product.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                        >
                          <Label className="text-xs text-muted-foreground mb-1 block">
                            {product.name}
                          </Label>
                          <Input
                            value={paymentLinks[product.name] || ''}
                            onChange={(e) => updatePaymentLink(product.name, e.target.value)}
                            placeholder="https://..."
                            className="bg-background/50 border-2"
                          />
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        );

      case 4:
        return (
          <motion.div 
            key="step4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring" }}
                className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl mb-4 backdrop-blur-sm border border-primary/20"
              >
                <MessageCircle className="w-8 h-8 text-primary" />
              </motion.div>
              <h3 className="text-xl font-semibold mb-2">Preguntas frecuentes</h3>
              <p className="text-sm text-muted-foreground">Ayuda a tu agente a responder mejor (opcional)</p>
            </div>

            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <motion.div
                  key={faq.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ delay: index * 0.05, type: "spring" }}
                  whileHover={{ scale: 1.02 }}
                >
                  <Card className="border-2 border-border/50 bg-gradient-to-br from-secondary/50 to-secondary/30 backdrop-blur-sm hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/10">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <motion.div
                          whileHover={{ scale: 1.1 }}
                          className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg"
                        >
                          {index + 1}
                        </motion.div>
                        <div className="flex-1 space-y-3">
                          <div>
                            <Label className="text-sm font-medium mb-2 block">
                              Pregunta
                            </Label>
                            <Input
                              value={faq.question}
                              onChange={(e) => updateFaq(faq.id, "question", e.target.value)}
                              placeholder="Ej: ¿Tienen envío gratis?"
                              className="bg-background/50 border-2"
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium mb-2 block">
                              Respuesta
                            </Label>
                            <Textarea
                              value={faq.answer}
                              onChange={(e) => updateFaq(faq.id, "answer", e.target.value)}
                              placeholder="Ej: Sí, envío gratis en compras superiores a $50.000"
                              className="bg-background/50 resize-none border-2"
                              rows={2}
                            />
                          </div>
                        </div>
                        {faqs.length > 1 && (
                          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                            <Button
                              type="button"
                              onClick={() => removeFaq(faq.id)}
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </motion.div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}

              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  type="button"
                  onClick={addFaq}
                  variant="outline"
                  className="w-full gap-2 border-dashed border-2 py-6 hover:border-primary hover:bg-primary/5 transition-all"
                >
                  <Plus className="w-5 h-5" />
                  Agregar otra pregunta
                </Button>
              </motion.div>

              <div className="pt-6 border-t border-border space-y-3">
                <Label className="text-base font-semibold">
                  Objeción más común (opcional)
                </Label>
                <Input
                  value={commonObjection}
                  onChange={(e) => setCommonObjection(e.target.value)}
                  placeholder='Ej: "Es muy caro"'
                  className="bg-secondary/50 border-2"
                />
                <Textarea
                  value={objectionResponse}
                  onChange={(e) => setObjectionResponse(e.target.value)}
                  placeholder="¿Cómo respondes? Ej: Le explico el valor y ofrezco opciones de pago..."
                  className="bg-secondary/50 resize-none border-2"
                  rows={3}
                />
              </div>
            </div>
          </motion.div>
        );

      case 5:
        return (
          <motion.div 
            key="step5"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring" }}
                className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl mb-4 backdrop-blur-sm border border-primary/20"
              >
                <Sparkles className="w-8 h-8 text-primary" />
              </motion.div>
              <h3 className="text-xl font-semibold mb-2">Personalidad del agente</h3>
              <p className="text-sm text-muted-foreground">¿Cómo quieres que hable con tus clientes?</p>
            </div>

            <div className="space-y-6">
              <div>
                <Label className="text-sm font-medium mb-3 block">
                  Estilo de comunicación
                </Label>
                <RadioGroup value={tone} onValueChange={setTone} className="space-y-3">
                  {[
                    { value: "formal", label: "Formal y profesional", desc: "Para negocios corporativos", icon: "👔" },
                    { value: "friendly", label: "Amigable y cercano", desc: "Balance perfecto", icon: "😊" },
                    { value: "casual", label: "Casual y divertido", desc: "Relajado y fresco", icon: "🎉" },
                  ].map((option) => (
                    <motion.div
                      key={option.value}
                      onClick={() => setTone(option.value)}
                      whileHover={{ scale: 1.02, x: 4 }}
                      whileTap={{ scale: 0.98 }}
                      className={`
                        cursor-pointer p-4 rounded-xl border-2 transition-all
                        ${tone === option.value
                          ? "border-primary bg-gradient-to-r from-primary/20 to-primary/10 shadow-lg shadow-primary/20"
                          : "border-border bg-secondary/30 hover:border-primary/50 hover:shadow-md"
                        }
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{option.icon}</span>
                          <div>
                            <p className="font-semibold">{option.label}</p>
                            <p className="text-sm text-muted-foreground">{option.desc}</p>
                          </div>
                        </div>
                        <RadioGroupItem value={option.value} />
                      </div>
                    </motion.div>
                  ))}
                </RadioGroup>
              </div>

              <div>
                <Label className="text-sm font-medium mb-3 block">
                  Nivel de formalidad
                </Label>
                <RadioGroup value={formalityLevel} onValueChange={setFormalityLevel} className="grid md:grid-cols-2 gap-3">
                  {[
                    { value: "tu", label: "Tutear (tú)", desc: "Más cercano" },
                    { value: "usted", label: "Tratar de usted", desc: "Más formal" }
                  ].map((option) => (
                    <motion.div
                      key={option.value}
                      onClick={() => setFormalityLevel(option.value)}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className={`
                        cursor-pointer p-4 rounded-xl border-2 transition-all
                        ${formalityLevel === option.value
                          ? "border-primary bg-gradient-to-br from-primary/20 to-primary/10 shadow-lg shadow-primary/20"
                          : "border-border bg-secondary/30 hover:border-primary/50"
                        }
                      `}
                    >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{option.label}</p>
                        <p className="text-xs text-muted-foreground">{option.desc}</p>
                      </div>
                        <RadioGroupItem value={option.value} />
                      </div>
                    </motion.div>
                  ))}
                </RadioGroup>
              </div>

              <motion.div
                onClick={() => setUseEmojis(!useEmojis)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`
                  cursor-pointer p-4 rounded-xl border-2 transition-all
                  ${useEmojis
                    ? "border-primary bg-gradient-to-r from-primary/20 to-primary/10 shadow-lg shadow-primary/20"
                    : "border-border bg-secondary/30"
                  }
                `}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Permitir uso de emojis 😊</p>
                    <p className="text-xs text-muted-foreground">
                      Hace la conversación más amigable
                    </p>
                  </div>
                  <Checkbox
                    id="emojis"
                    checked={useEmojis}
                    onCheckedChange={(checked) => setUseEmojis(checked as boolean)}
                  />
                </div>
              </motion.div>
            </div>
          </motion.div>
        );

      case 6:
        return (
          <motion.div 
            key="step6"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring" }}
                className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl mb-4 backdrop-blur-sm border border-primary/20"
              >
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </motion.div>
              <h3 className="text-xl font-semibold mb-2">¡Último paso!</h3>
              <p className="text-sm text-muted-foreground">Información adicional y contacto</p>
            </div>

            <div className="space-y-6">
              <div>
                <Label className="text-sm font-medium mb-3 block">
                  ¿Qué información necesitas del cliente? (opcional)
                </Label>
                <div className="grid md:grid-cols-2 gap-3">
                  {[
                    { value: "nombre", label: "Nombre completo", icon: "👤" },
                    { value: "telefono", label: "Teléfono", icon: "📱" },
                    { value: "direccion", label: "Dirección", icon: "📍" },
                    { value: "cedula", label: "Cédula/ID", icon: "🆔" },
                    { value: "email", label: "Email", icon: "📧" },
                    { value: "ciudad", label: "Ciudad", icon: "🌆" },
                  ].map((info) => (
                    <motion.div
                      key={info.value}
                      onClick={() => toggleRequiredInfo(info.value)}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className={`
                        cursor-pointer p-3 rounded-xl border-2 transition-all
                        ${requiredInfo.includes(info.value)
                          ? "border-primary bg-gradient-to-br from-primary/20 to-primary/10 shadow-lg shadow-primary/20"
                          : "border-border bg-secondary/30 hover:border-primary/50"
                        }
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{info.icon}</span>
                          <span className="font-medium text-sm">{info.label}</span>
                        </div>
                        <AnimatePresence>
                          {requiredInfo.includes(info.value) && (
                            <motion.div
                              initial={{ scale: 0, rotate: -180 }}
                              animate={{ scale: 1, rotate: 0 }}
                              exit={{ scale: 0, rotate: 180 }}
                            >
                              <CheckCircle2 className="w-5 h-5 text-primary" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <motion.div whileHover={{ scale: 1.01 }}>
                <Label htmlFor="warranty" className="text-sm font-medium mb-2 block">
                  Garantía (opcional)
                </Label>
                <Input
                  id="warranty"
                  value={warranty}
                  onChange={(e) => setWarranty(e.target.value)}
                  placeholder="Ej: 30 días de garantía en todos los productos"
                  className="bg-secondary/50 border-2"
                />
              </motion.div>

              <div className="pt-4 border-t border-border">
                <Label className="text-sm font-medium mb-4 block">
                  Instrucciones especiales (opcional)
                </Label>
                <div className="space-y-4">
                  {customInstructions.map((instruction, index) => (
                    <motion.div
                      key={instruction.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ delay: index * 0.05, type: "spring" }}
                      whileHover={{ scale: 1.01, transition: { duration: 0.2 } }}
                    >
                      <Card className="border-2 border-border/50 bg-gradient-to-br from-secondary/50 to-secondary/30 backdrop-blur-sm hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/10">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <motion.div 
                              whileHover={{ scale: 1.1 }}
                              className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm shadow-lg"
                            >
                              {index + 1}
                            </motion.div>
                            <div className="flex-1">
                              <Textarea
                                value={instruction.text}
                                onChange={(e) => updateInstruction(instruction.id, e.target.value)}
                                placeholder="Ej: Siempre sé amable y cercano. Pregunta por el nombre del cliente al inicio de la conversación..."
                                className="bg-background/50 border-2 min-h-[80px] resize-y"
                                rows={3}
                              />
                            </div>
                            {customInstructions.length > 1 && (
                              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                <Button
                                  type="button"
                                  onClick={() => removeInstruction(instruction.id)}
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </motion.div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}

                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      type="button"
                      onClick={addInstruction}
                      variant="outline"
                      className="w-full gap-2 border-dashed border-2 py-6 hover:border-primary hover:bg-primary/5 transition-all"
                    >
                      <Plus className="w-5 h-5" />
                      Agregar otra instrucción
                    </Button>
                  </motion.div>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <motion.div whileHover={{ scale: 1.01 }}>
                  <Label htmlFor="email" className="text-sm font-medium mb-2 block flex items-center gap-2">
                    Email para notificaciones *
                    {email && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                      >
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      </motion.span>
                    )}
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                    className="bg-secondary/50 border-border h-11 border-2 focus:border-primary transition-all"
                    required
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Te enviaremos el link de tu agente y actualizaciones
                  </p>
                </motion.div>
              </div>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 min-h-screen relative overflow-hidden">
      {showConfetti && <Confetti width={windowSize.width} height={windowSize.height} recycle={false} numberOfPieces={200} />}
      <AuthModal open={showAuthModal} onSuccess={handleAuthSuccess} />
      
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10 -z-10"></div>
      <div className="absolute top-20 right-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10"></div>
      
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", duration: 0.8 }}
          >
            <Bot className="w-12 h-12 mx-auto mb-4 text-primary" />
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-bold mb-2"
          >
            Crea tu <span className="gradient-text">Agente de Ventas</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-muted-foreground"
          >
            Solo toma 2 minutos configurarlo
          </motion.p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          {/* Main progress bar */}
          <div className="relative h-2 bg-secondary rounded-full overflow-hidden mb-6">
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/80 rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ type: "spring", stiffness: 100, damping: 20 }}
            />
            {/* Animated glow */}
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-20 blur-sm"
              initial={{ x: "-100%" }}
              animate={{ x: `${(progressPercentage / 100) * window.innerWidth}px` }}
              transition={{ type: "spring", stiffness: 100, damping: 20 }}
            />
          </div>
          
          {/* Step indicators */}
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <motion.div
                    whileHover={{ scale: currentStep > step.id ? 1.15 : 1.1 }}
                    whileTap={{ scale: currentStep > step.id ? 0.95 : 1 }}
                    animate={{
                      scale: currentStep >= step.id ? 1 : 0.9,
                    }}
                    onClick={() => {
                      // Solo permitir ir hacia atrás a pasos ya completados
                      if (currentStep > step.id) {
                        setCurrentStep(step.id);
                      }
                    }}
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all relative
                      ${currentStep > step.id
                        ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/30 cursor-pointer hover:shadow-primary/50"
                        : currentStep === step.id
                        ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground ring-4 ring-primary/20 shadow-lg shadow-primary/50"
                        : "bg-secondary text-muted-foreground"
                      }
                    `}
                  >
                    <AnimatePresence mode="wait">
                      {currentStep > step.id ? (
                        <motion.div
                          key="check"
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0, rotate: 180 }}
                        >
                          <Check className="w-5 h-5" />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="icon"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                        >
                          <step.icon className="w-5 h-5" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                  <span 
                    className={`text-xs font-medium text-center hidden sm:block ${currentStep > step.id ? 'cursor-pointer hover:text-primary transition-colors' : ''}`}
                    onClick={() => {
                      if (currentStep > step.id) {
                        setCurrentStep(step.id);
                      }
                    }}
                  >
                    {step.title}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div className="flex-1 h-1 mx-2 bg-secondary relative overflow-hidden rounded-full">
                    <motion.div
                      initial={{ width: "0%" }}
                      animate={{
                        width: currentStep > step.id ? "100%" : "0%"
                      }}
                      transition={{ duration: 0.3 }}
                      className="absolute inset-0 bg-gradient-to-r from-primary to-primary/80"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form Card */}
        <Card className="border-2 border-border/50 bg-gradient-to-br from-card/80 to-card/50 backdrop-blur-xl shadow-2xl">
          <CardContent className="p-6 md:p-8">
            <AnimatePresence mode="wait">
              {renderStepContent()}
            </AnimatePresence>

            {/* Navigation Buttons */}
            <div className="flex gap-4 mt-8 pt-6 border-t border-border">
              {currentStep > 1 && (
                <motion.div 
                  className="flex-1"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    type="button"
                    onClick={handleBack}
                    variant="outline"
                    size="lg"
                    className="w-full gap-2 border-2"
                  >
                    <ArrowLeft className="w-5 h-5" />
                    Anterior
                  </Button>
                </motion.div>
              )}
              
              {currentStep < 6 ? (
                <motion.div 
                  className="flex-1"
                  whileHover={{ scale: canProceedToNextStep() ? 1.02 : 1 }}
                  whileTap={{ scale: canProceedToNextStep() ? 0.98 : 1 }}
                  animate={{
                    scale: canProceedToNextStep() ? [1, 1.02, 1] : 1
                  }}
                  transition={{
                    duration: 1,
                    repeat: canProceedToNextStep() ? Infinity : 0,
                    repeatDelay: 2
                  }}
                >
                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={!canProceedToNextStep()}
                    size="lg"
                    className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Siguiente
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </motion.div>
              ) : (
                <motion.div 
                  className="flex-1"
                  whileHover={{ scale: canProceedToNextStep() && !isSubmitting ? 1.02 : 1 }}
                  whileTap={{ scale: canProceedToNextStep() && !isSubmitting ? 0.98 : 1 }}
                >
              <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canProceedToNextStep() || isSubmitting}
                    size="lg"
                    className="w-full gap-2 bg-gradient-to-r from-primary via-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-xl shadow-primary/50 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Creando tu agente...
                      </>
                    ) : (
                      <>
                        <Bot className="w-5 h-5" />
                        Crear Mi Agente
                        <Sparkles className="w-5 h-5" />
                      </>
                    )}
              </Button>
                </motion.div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Help Text */}
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-sm text-muted-foreground mt-6"
        >
          Paso {currentStep} de {STEPS.length} • {Math.round(progressPercentage)}% completado
        </motion.p>
      </div>
    </section>
  );
};
