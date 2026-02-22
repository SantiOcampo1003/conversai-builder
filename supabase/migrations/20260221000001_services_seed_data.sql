-- ============================================================
-- Seed: Datos iniciales de servicios profesionales
-- ============================================================

-- Catálogo de servicios iniciales
INSERT INTO public.services (id, name, display_name, description, price_cop, price_usd, service_type, estimated_hours, features, sort_order) VALUES
(
  '11111111-0000-0000-0000-000000000001',
  'enterprise-implementation',
  'Implementación Enterprise',
  'Configuración personalizada de la plataforma con múltiples agentes, flujos customizados e integraciones a medida para empresas.',
  2000000,
  500.00,
  'implementation',
  40,
  '["Hasta 10 agentes personalizados", "Integración con CRM/ERP", "Flujos de trabajo customizados", "4 sesiones de capacitación", "Soporte prioritario 30 días"]'::jsonb,
  1
),
(
  '22222222-0000-0000-0000-000000000002',
  'custom-implementation',
  'Implementación Customizada',
  'Setup personalizado con agentes e integraciones específicas para tu negocio.',
  500000,
  125.00,
  'implementation',
  10,
  '["3-5 agentes personalizados", "1 integración API", "Setup inicial completo", "2 sesiones de capacitación"]'::jsonb,
  2
),
(
  '33333333-0000-0000-0000-000000000003',
  'basic-setup',
  'Setup Básico',
  'Configuración inicial de la plataforma con 1 agente estándar y capacitación básica.',
  150000,
  37.50,
  'implementation',
  3,
  '["1 agente estándar", "Configuración básica", "1 hora de capacitación"]'::jsonb,
  3
),
(
  '44444444-0000-0000-0000-000000000004',
  'training-session',
  'Sesión de Capacitación',
  'Sesión personalizada de capacitación para tu equipo en el uso de la plataforma.',
  200000,
  50.00,
  'training',
  2,
  '["2 horas de capacitación", "Documentación personalizada", "Soporte post-capacitación 7 días"]'::jsonb,
  4
),
(
  '55555555-0000-0000-0000-000000000005',
  'monthly-support',
  'Soporte Premium Mensual',
  'Soporte técnico prioritario con 10 horas de desarrollo/ajustes incluidos por mes.',
  300000,
  75.00,
  'support',
  10,
  '["10 horas de soporte/mes", "Respuesta prioritaria", "Ajustes y mejoras menores", "Reporte mensual"]'::jsonb,
  5
)
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  price_cop = EXCLUDED.price_cop,
  price_usd = EXCLUDED.price_usd,
  estimated_hours = EXCLUDED.estimated_hours,
  features = EXCLUDED.features,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
