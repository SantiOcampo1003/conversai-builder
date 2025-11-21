import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Trash2, Bot, MessageSquare, Store, DollarSign, Truck, MessageCircle, Sparkles, CheckCircle2, Zap } from "lucide-react";

interface Product {
  id: string;
  name: string;
  price: string;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
}

export const FlowFormSection = () => {
  const navigate = useNavigate();
  
  // Información del negocio
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("products");
  const [businessCategory, setBusinessCategory] = useState("");
  const [priceFrom, setPriceFrom] = useState("");
  const [priceTo, setPriceTo] = useState("");
  const [currency, setCurrency] = useState("COP");
  
  // Productos/Servicios
  const [products, setProducts] = useState<Product[]>([
    { id: "1", name: "", price: "" }
  ]);
  
  // Envío y pago
  const [offersDelivery, setOffersDelivery] = useState(false);
  const [deliveryCost, setDeliveryCost] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  
  // FAQ y objeciones
  const [faqs, setFaqs] = useState<FAQ[]>([
    { id: "1", question: "", answer: "" }
  ]);
  const [commonObjection, setCommonObjection] = useState("");
  const [objectionResponse, setObjectionResponse] = useState("");
  
  // Tono y personalidad
  const [tone, setTone] = useState("friendly");
  const [useEmojis, setUseEmojis] = useState(true);
  const [formalityLevel, setFormalityLevel] = useState("tu");
  
  // Cierre
  const [requiredInfo, setRequiredInfo] = useState<string[]>([]);
  const [warranty, setWarranty] = useState("");
  
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  
  // Pasarela de pago
  const [paymentGateway, setPaymentGateway] = useState("none");
  const [paymentLinks, setPaymentLinks] = useState<Record<string, string>>({});
  
  // Instrucciones personalizadas
  const [customInstructions, setCustomInstructions] = useState("");

  // Funciones para manejar productos
  const addProduct = () => {
    const newId = (products.length + 1).toString();
    setProducts([...products, { id: newId, name: "", price: "" }]);
  };

  const removeProduct = (id: string) => {
    if (products.length > 1) {
      setProducts(products.filter(p => p.id !== id));
    }
  };

  const updateProduct = (id: string, field: keyof Product, value: string) => {
    setProducts(products.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  // Funciones para manejar FAQs
  const addFaq = () => {
    const newId = (faqs.length + 1).toString();
    setFaqs([...faqs, { id: newId, question: "", answer: "" }]);
  };

  const removeFaq = (id: string) => {
    if (faqs.length > 1) {
      setFaqs(faqs.filter(f => f.id !== id));
    }
  };

  const updateFaq = (id: string, field: keyof FAQ, value: string) => {
    setFaqs(faqs.map(f => 
      f.id === id ? { ...f, [field]: value} : f
    ));
  };

  const togglePaymentMethod = (method: string) => {
    setPaymentMethods(prev => 
      prev.includes(method) 
        ? prev.filter(m => m !== method)
        : [...prev, method]
    );
  };

  const toggleRequiredInfo = (info: string) => {
    setRequiredInfo(prev => 
      prev.includes(info) 
        ? prev.filter(i => i !== info)
        : [...prev, info]
    );
  };

  const updatePaymentLink = (productName: string, link: string) => {
    setPaymentLinks(prev => ({
      ...prev,
      [productName]: link
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('https://administrators-shot-illustrated-oak.trycloudflare.com/webhook/flow-submission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Información del negocio  
          businessName,
          businessType,
          businessCategory,
          priceRange: { from: priceFrom, to: priceTo, currency },
          
          // Productos/Servicios
          products: products.filter(p => p.name && p.price),
          
          // Envío y pago
          delivery: {
            offers: offersDelivery,
            cost: deliveryCost,
            time: deliveryTime
          },
          paymentMethods,
          
          // FAQ y objeciones
          faqs: faqs.filter(f => f.question && f.answer),
          objectionHandling: {
            common: commonObjection,
            response: objectionResponse
          },
          
          // Tono y personalidad
          agentPersonality: {
            tone,
            useEmojis,
            formalityLevel
          },
          
          // Cierre
          requiredInfo,
          warranty,
          
          // Pasarela de pago
          paymentGateway,
          paymentLinks: paymentGateway !== 'none' ? paymentLinks : {},
          
          // Instrucciones personalizadas
          customInstructions,
          
      email
        }),
      });

      const data = await response.json();
      
      // Soportar ambos formatos: agent_id (de PostgreSQL) o agentId (custom response)
      const agentId = data.agent_id || data.agentId;
      
      if (agentId) {
        localStorage.setItem('currentAgentId', agentId);
        setSubmitted(true);
      } else {
        alert('Error al enviar el flujo: No se recibió agentId');
      }
    } catch (error) {
      console.error('Error al enviar:', error);
      alert('Error al enviar el flujo. Por favor intenta de nuevo.');
    }
  };

  if (submitted) {
    return (
      <section className="fixed inset-0 flex items-center justify-center px-4 sm:px-6 lg:px-8 overflow-auto bg-background z-50">
        {/* Efectos de fondo */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-primary/20"></div>
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          {/* Icono animado */}
          <div className="mb-8 animate-in zoom-in duration-500">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse"></div>
              <div className="relative w-32 h-32 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl animate-bounce">
                <Bot className="w-16 h-16 text-primary-foreground" />
              </div>
              {/* Círculos decorativos */}
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg animate-ping">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          {/* Texto principal */}
          <div className="space-y-6 mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
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

            {/* Características destacadas */}
            <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto mt-8">
              <div className="bg-card/50 backdrop-blur-sm p-4 rounded-xl border border-border/50">
                <MessageSquare className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium">Responde 24/7</p>
              </div>
              <div className="bg-card/50 backdrop-blur-sm p-4 rounded-xl border border-border/50">
                <Sparkles className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium">Personalizado</p>
              </div>
              <div className="bg-card/50 backdrop-blur-sm p-4 rounded-xl border border-border/50">
                <Zap className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium">IA Avanzada</p>
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
            <Button
              onClick={() => navigate('/chat-test')}
              size="lg"
              className="px-10 py-6 text-lg bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-2xl shadow-primary/50 gap-3 group"
            >
              <MessageSquare className="w-6 h-6 group-hover:scale-110 transition-transform" />
              Probar mi agente ahora
              <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            </Button>
            <Button
              onClick={() => setSubmitted(false)}
              variant="outline"
              size="lg"
              className="px-10 py-6 text-lg border-2 hover:bg-secondary/50"
            >
              Crear otro agente
            </Button>
          </div>

          {/* Mensaje adicional */}
          <p className="mt-8 text-sm text-muted-foreground animate-in fade-in delay-700">
            💡 Tip: Prueba el agente con preguntas reales de tus clientes para verificar su comportamiento
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <Bot className="w-16 h-16 mx-auto mb-6 text-primary glow-effect" />
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Crea tu <span className="gradient-text">Agente de Ventas</span> Personalizado
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Completa el formulario y generaremos un agente conversacional inteligente adaptado a tu negocio
          </p>
        </div>

        <Card className="tech-border animate-pulse-glow">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-12">
              {/* SECCIÓN 1: INFORMACIÓN DEL NEGOCIO */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-border">
                  <Store className="w-7 h-7 text-primary" />
                  <h3 className="text-2xl font-bold">1. Información del Negocio</h3>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="business-name" className="text-base font-semibold">
                      Nombre del Negocio *
                    </Label>
                    <Input
                      id="business-name"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="Ej: Tienda Moda Express"
                      className="bg-secondary/50"
                      required
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="business-type" className="text-base font-semibold">
                      Tipo de Negocio *
                    </Label>
                    <Select value={businessType} onValueChange={setBusinessType}>
                      <SelectTrigger className="bg-secondary/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="products">Productos</SelectItem>
                        <SelectItem value="services">Servicios</SelectItem>
                        <SelectItem value="both">Ambos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

              <div className="space-y-3">
                    <Label htmlFor="category" className="text-base font-semibold">
                      Categoría *
                </Label>
                    <Select value={businessCategory} onValueChange={setBusinessCategory}>
                      <SelectTrigger className="bg-secondary/50">
                        <SelectValue placeholder="Selecciona una categoría" />
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
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Rango de Precios *</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={priceFrom}
                        onChange={(e) => setPriceFrom(e.target.value)}
                        placeholder="Desde"
                        className="bg-secondary/50"
                        required
                      />
                      <Input
                        type="number"
                        value={priceTo}
                        onChange={(e) => setPriceTo(e.target.value)}
                        placeholder="Hasta"
                        className="bg-secondary/50"
                        required
                      />
                      <Select value={currency} onValueChange={setCurrency}>
                        <SelectTrigger className="bg-secondary/50 w-24">
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
                  </div>
                </div>
              </div>

              {/* SECCIÓN 2: PRODUCTOS/SERVICIOS */}
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-7 h-7 text-primary" />
                    <h3 className="text-2xl font-bold">2. Productos/Servicios Principales</h3>
                  </div>
                  <Button
                    type="button"
                    onClick={addProduct}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar
                  </Button>
                </div>

                {products.map((product, index) => (
                  <Card key={product.id} className="border-border/50 bg-secondary/30">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">
                          {index + 1}
                        </div>
                        <div className="flex-1 grid md:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-medium mb-2 block">
                              Nombre del {businessType === "services" ? "Servicio" : "Producto"}
                            </Label>
                            <Input
                              value={product.name}
                              onChange={(e) => updateProduct(product.id, "name", e.target.value)}
                              placeholder="Ej: Camiseta básica"
                              className="bg-background/50"
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
                              placeholder="Ej: 25000"
                              className="bg-background/50"
                            />
                          </div>
                        </div>
                        {products.length > 1 && (
                          <Button
                            type="button"
                            onClick={() => removeProduct(product.id)}
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* SECCIÓN 3: ENVÍO Y PAGO */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-border">
                  <Truck className="w-7 h-7 text-primary" />
                  <h3 className="text-2xl font-bold">3. Envío y Formas de Pago</h3>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="delivery"
                      checked={offersDelivery}
                      onCheckedChange={(checked) => setOffersDelivery(checked as boolean)}
                    />
                    <Label htmlFor="delivery" className="text-base font-medium cursor-pointer">
                      Ofrezco envío/domicilio
                    </Label>
                  </div>

                  {offersDelivery && (
                    <div className="grid md:grid-cols-2 gap-6 pl-6">
                      <div className="space-y-3">
                        <Label htmlFor="delivery-cost" className="text-base font-semibold">
                          Costo de Envío
                        </Label>
                        <Input
                          id="delivery-cost"
                          value={deliveryCost}
                          onChange={(e) => setDeliveryCost(e.target.value)}
                          placeholder="Ej: Gratis sobre $50000"
                          className="bg-secondary/50"
                        />
                      </div>

              <div className="space-y-3">
                        <Label htmlFor="delivery-time" className="text-base font-semibold">
                          Tiempo de Entrega
                        </Label>
                        <Input
                          id="delivery-time"
                          value={deliveryTime}
                          onChange={(e) => setDeliveryTime(e.target.value)}
                          placeholder="Ej: 2-3 días hábiles"
                          className="bg-secondary/50"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <Label className="text-base font-semibold">Formas de Pago Aceptadas *</Label>
                    <div className="grid md:grid-cols-3 gap-4">
                      {[
                        { value: "efectivo", label: "Efectivo" },
                        { value: "transferencia", label: "Transferencia" },
                        { value: "nequi", label: "Nequi/Daviplata" },
                        { value: "tarjeta", label: "Tarjeta" },
                        { value: "contraentrega", label: "Contraentrega" },
                        { value: "credito", label: "Crédito" },
                      ].map((method) => (
                        <div key={method.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={method.value}
                            checked={paymentMethods.includes(method.value)}
                            onCheckedChange={() => togglePaymentMethod(method.value)}
                          />
                          <Label htmlFor={method.value} className="cursor-pointer">
                            {method.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* PASARELA DE PAGO ONLINE */}
                  <div className="space-y-4 pt-6 border-t border-border">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-primary" />
                      Pasarela de Pago Online (Opcional)
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      ¿Tus productos tienen checkout online? Selecciona tu plataforma y agrega los links
                    </p>
                    
                    <Select value={paymentGateway} onValueChange={setPaymentGateway}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una plataforma" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Ninguna (solo presencial/transferencia)</SelectItem>
                        <SelectItem value="hotmart">Hotmart</SelectItem>
                        <SelectItem value="stripe">Stripe</SelectItem>
                        <SelectItem value="mercadopago">MercadoPago</SelectItem>
                        <SelectItem value="paypal">PayPal</SelectItem>
                        <SelectItem value="other">Otra</SelectItem>
                      </SelectContent>
                    </Select>

                    {paymentGateway !== 'none' && (
                      <div className="space-y-3 pt-4">
                        <Label className="text-sm font-medium">
                          Links de Pago por Producto
                        </Label>
                        <p className="text-xs text-muted-foreground mb-3">
                          Pega el link de checkout para cada producto. El agente lo enviará cuando el cliente confirme la compra.
                        </p>
                        {products.filter(p => p.name).map((product) => (
                          <div key={product.id} className="space-y-2">
                            <Label className="text-sm text-muted-foreground">
                              {product.name || `Producto ${product.id}`}
                            </Label>
                            <Input
                              value={paymentLinks[product.name] || ''}
                              onChange={(e) => updatePaymentLink(product.name, e.target.value)}
                              placeholder="https://..."
                              className="bg-background/50"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* SECCIÓN 4: PREGUNTAS FRECUENTES */}
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <MessageCircle className="w-7 h-7 text-primary" />
                    <h3 className="text-2xl font-bold">4. Preguntas Frecuentes y Objeciones</h3>
                  </div>
                  <Button
                    type="button"
                    onClick={addFaq}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar FAQ
                  </Button>
                </div>

                {faqs.map((faq, index) => (
                  <Card key={faq.id} className="border-border/50 bg-secondary/30">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">
                          {index + 1}
                        </div>
                        <div className="flex-1 space-y-4">
                          <div>
                            <Label className="text-sm font-medium mb-2 block">
                              ¿Qué pregunta hacen tus clientes?
                            </Label>
                            <Input
                              value={faq.question}
                              onChange={(e) => updateFaq(faq.id, "question", e.target.value)}
                              placeholder="Ej: ¿Tienen envío gratis?"
                              className="bg-background/50"
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium mb-2 block">
                              ¿Cómo respondes normalmente?
                </Label>
                <Textarea
                              value={faq.answer}
                              onChange={(e) => updateFaq(faq.id, "answer", e.target.value)}
                              placeholder="Ej: Sí, envío gratis en compras superiores a $50.000"
                              className="bg-background/50 resize-none"
                              rows={2}
                            />
                          </div>
                        </div>
                        {faqs.length > 1 && (
                          <Button
                            type="button"
                            onClick={() => removeFaq(faq.id)}
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <div className="space-y-4 pt-4">
                  <Label className="text-base font-semibold">Objeción Más Común</Label>
                  <Input
                    value={commonObjection}
                    onChange={(e) => setCommonObjection(e.target.value)}
                    placeholder='Ej: "Es muy caro"'
                    className="bg-secondary/50"
                  />
                  <Textarea
                    value={objectionResponse}
                    onChange={(e) => setObjectionResponse(e.target.value)}
                    placeholder="¿Cómo manejas esta objeción? Ej: Le explico el valor y ofrezco opciones de pago..."
                    className="bg-secondary/50 resize-none"
                    rows={3}
                  />
                </div>
              </div>

              {/* SECCIÓN 5: TONO Y PERSONALIDAD */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-border">
                  <Sparkles className="w-7 h-7 text-primary" />
                  <h3 className="text-2xl font-bold">5. Tono y Personalidad del Agente</h3>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Estilo de Comunicación *</Label>
                    <RadioGroup value={tone} onValueChange={setTone}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="formal" id="formal" />
                        <Label htmlFor="formal" className="cursor-pointer">Formal y profesional</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="friendly" id="friendly" />
                        <Label htmlFor="friendly" className="cursor-pointer">Amigable y cercano</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="casual" id="casual" />
                        <Label htmlFor="casual" className="cursor-pointer">Casual y divertido</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Nivel de Formalidad *</Label>
                    <RadioGroup value={formalityLevel} onValueChange={setFormalityLevel}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="tu" id="tu" />
                        <Label htmlFor="tu" className="cursor-pointer">Tutear (tú)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="usted" id="usted" />
                        <Label htmlFor="usted" className="cursor-pointer">Tratar de usted (formal)</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="emojis"
                    checked={useEmojis}
                    onCheckedChange={(checked) => setUseEmojis(checked as boolean)}
                  />
                  <Label htmlFor="emojis" className="text-base font-medium cursor-pointer">
                    Permitir uso de emojis 😊
                  </Label>
                </div>
              </div>

              {/* SECCIÓN 6: INFORMACIÓN DE CIERRE */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-border">
                  <CheckCircle2 className="w-7 h-7 text-primary" />
                  <h3 className="text-2xl font-bold">6. Información para Cerrar Ventas</h3>
                </div>

                <div className="space-y-6">
                  <div className="space-y-4">
                    <Label className="text-base font-semibold">¿Qué información necesitas del cliente?</Label>
                    <div className="grid md:grid-cols-3 gap-4">
                      {[
                        { value: "nombre", label: "Nombre completo" },
                        { value: "telefono", label: "Teléfono" },
                        { value: "direccion", label: "Dirección" },
                        { value: "cedula", label: "Cédula/ID" },
                        { value: "email", label: "Email" },
                        { value: "ciudad", label: "Ciudad" },
                      ].map((info) => (
                        <div key={info.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={info.value}
                            checked={requiredInfo.includes(info.value)}
                            onCheckedChange={() => toggleRequiredInfo(info.value)}
                          />
                          <Label htmlFor={info.value} className="cursor-pointer">
                            {info.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

              <div className="space-y-3">
                    <Label htmlFor="warranty" className="text-base font-semibold">
                      Garantía (opcional)
                </Label>
                    <Input
                      id="warranty"
                      value={warranty}
                      onChange={(e) => setWarranty(e.target.value)}
                      placeholder="Ej: 30 días de garantía en todos los productos"
                      className="bg-secondary/50"
                    />
                  </div>
                </div>
              </div>

              {/* INSTRUCCIONES PERSONALIZADAS (OPCIONAL) */}
              <div className="space-y-3 pt-6 border-t border-border">
                <Label htmlFor="customInstructions" className="text-lg font-semibold flex items-center gap-2">
                  <Bot className="w-5 h-5 text-primary" />
                  Instrucciones Especiales para tu Agente (Opcional)
                </Label>
                <Textarea
                  id="customInstructions"
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="Ej: Los cursos inician el 26 de enero, NO digas 'acceso inmediato'. Siempre pregunta primero por el principal reto del cliente antes de recomendar productos. Usa un tono empático y femenino..."
                  className="bg-secondary/50 border-border min-h-[120px] resize-y"
                  rows={6}
                />
                <p className="text-sm text-muted-foreground">
                  Agrega instrucciones adicionales específicas para tu negocio. El agente seguirá estas instrucciones al pie de la letra.
                </p>
              </div>

              {/* EMAIL DE CONTACTO */}
              <div className="space-y-3 pt-6 border-t border-border">
                <Label htmlFor="email" className="text-lg font-semibold">
                  Email para Notificaciones *
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="bg-secondary/50 border-border"
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Te enviaremos el link de tu agente y actualizaciones importantes
                </p>
              </div>

              {/* BOTÓN DE ENVÍO */}
              <Button
                type="submit"
                className="w-full text-lg py-6 bg-primary hover:bg-primary/90 text-primary-foreground glow-effect gap-2"
              >
                <Bot className="w-5 h-5" />
                🚀 Crear Mi Agente Personalizado
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
