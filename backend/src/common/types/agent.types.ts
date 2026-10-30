export interface Agent {
  agent_id: string;
  client_id: string;
  email: string;
  business_name: string;
  business_type: string;
  business_category: string;
  price_range: PriceRange | null;
  products: Product[] | null;
  delivery: string | null;
  payment_methods: string[] | null;
  faqs: FAQ[] | null;
  objection_handling: string | null;
  agent_personality: AgentPersonality | null;
  required_info: string[] | null;
  warranty: string | null;
  payment_gateway: string | null;
  payment_links: Record<string, string> | null;
  custom_instruction: string | null; // Renombrado de custom_instructions (singular)
  custom_instructions: CustomInstruction[] | null; // Nuevo: array JSONB con toggle
  internal_custom_instructions: string | null; // Nuevo: reglas internas (solo super admin)
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface CustomInstruction {
  instruction: string;
  active: boolean;
}

export interface PriceRange {
  from: number;
  to: number;
  currency: string;
}

export interface Product {
  id?: string; // id estable; liga las fotos de agent_assets con el producto
  name: string;
  price: string;
  description?: string;
  image_url?: string;
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface AgentPersonality {
  tone: string;
  formality: string;
  useEmojis: boolean;
}

export interface ChatHistoryEntry {
  role: 'user' | 'assistant';
  message: string;
  created_at: string;
}

export interface TokenBalance {
  available_tokens: number;
  is_active: boolean;
}

export interface AgentWithTokens extends Agent {
  token_balance: TokenBalance | null;
}

/** Archivo (imagen o PDF) que un agente puede enviar por WhatsApp. Tabla `agent_assets`. */
export interface AgentAsset {
  asset_key: string;
  kind: 'image' | 'document';
  title: string;
  caption: string | null;
  send_when: string | null; // null solo en fotos de producto (se usa una regla por defecto)
  product_id: string | null; // agents.products[].id al que pertenece la foto
  public_url: string;
  file_name: string | null;
  mime_type: string | null;
}

/** Archivo que el canal (WhatsApp) debe enviar después del texto de la respuesta. */
export interface OutboundFile {
  assetKey: string;
  type: 'image' | 'document';
  url: string;
  fileName: string | null;
  mimetype: string | null;
  caption: string | null;
}
