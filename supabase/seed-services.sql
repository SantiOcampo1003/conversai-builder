-- Servicios profesionales disponibles (en token_packages para reutilizar UI)
-- Identificamos servicios con tokens = 0

INSERT INTO public.token_packages (id, name, display_name, tokens, price_cop, description, active, sort_order) VALUES
(
  'service-001',
  'custom-implementation',
  'Implementación Customizada',
  0, -- Sin tokens
  500000,
  'Configuración personalizada: agentes, flujos, integraciones a medida. Incluye 10 horas de desarrollo.',
  true,
  100 -- Después de los paquetes de tokens
),
(
  'service-002',
  'basic-setup',
  'Setup Inicial',
  0,
  150000,
  'Configuración básica de la plataforma con 1 agente y setup estándar.',
  true,
  101
),
(
  'service-003',
  'training',
  'Capacitación de Equipo',
  0,
  200000,
  'Sesión de 2 horas de capacitación personalizada para tu equipo.',
  true,
  102
)
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  price_cop = EXCLUDED.price_cop,
  description = EXCLUDED.description,
  active = EXCLUDED.active,
  sort_order = EXCLUDED.sort_order;
