-- Seed data para desarrollo local
-- Este archivo solo se ejecuta en local al hacer: supabase db reset
-- Nota: Usamos prefijos public. explícitos porque la migración establece search_path = ''

-- Verificar que las tablas existan antes de insertar
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'clients') THEN
    RAISE EXCEPTION 'La tabla clients no existe. Verifica que las migraciones se hayan aplicado correctamente.';
  END IF;
END $$;

-- 1. Cliente de prueba
INSERT INTO public.clients (id, name, email, phone, company_name, created_at) VALUES
('11111111-1111-1111-1111-111111111111', 'Juan Desarrollador', 'dev@test.com', '+573001234567', 'Test Company SAS', NOW())
ON CONFLICT (id) DO NOTHING;

-- 2. Paquetes de tokens disponibles
INSERT INTO public.token_packages (id, name, display_name, tokens, price_cop, price_usd, description, conversations_approx, active, sort_order) VALUES
('44444444-4444-4444-4444-444444444444', 'basic_100', '100 Créditos', 100, 10000, 2.50, 'Paquete básico para empezar', 20, true, 1),
('55555555-5555-5555-5555-555555555555', 'pro_500', '500 Créditos', 500, 45000, 11.25, 'Paquete profesional', 100, true, 2),
('66666666-6666-6666-6666-666666666666', 'enterprise_1000', '1000 Créditos', 1000, 80000, 20.00, 'Paquete empresarial', 200, true, 3)
ON CONFLICT (id) DO NOTHING;

-- 3. Balance de tokens para el cliente
INSERT INTO public.token_balances (id, client_id, total_tokens, used_tokens, is_active, created_at) VALUES
('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 100, 25, true, NOW())
ON CONFLICT (id) DO NOTHING;

-- 4. Transacción de tokens de bienvenida
INSERT INTO public.token_transactions (id, client_id, type, tokens, description, created_at) VALUES
('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'bonus', 100, 'Tokens de bienvenida - desarrollo', NOW())
ON CONFLICT (id) DO NOTHING;

-- 5. Agente de prueba vinculado al cliente
INSERT INTO public.agents (id, agent_id, email, business_name, business_type, business_category, client_id,
  price_range, products, payment_methods, delivery, faqs, agent_personality, required_info, created_at) VALUES
(1, 'agent_dev_001', 'dev@test.com', 'Pizzería Test Dev', 'restaurant', 'food',
  '11111111-1111-1111-1111-111111111111',
  '{"from": "25000", "to": "35000", "currency": "COP"}'::jsonb,
  '[
    {"name": "Pizza Hawaiana", "price": "25000", "description": "Pizza con piña y jamón"},
    {"name": "Pizza Pepperoni", "price": "28000", "description": "Pizza con pepperoni"},
    {"name": "Pizza Vegetariana", "price": "26000", "description": "Pizza con verduras"},
    {"name": "Pizza Especial", "price": "35000", "description": "Pizza con ingredientes premium"}
  ]'::jsonb,
  '["cash", "transfer", "nequi", "card"]'::jsonb,
  '{"offers": true, "cost": "5000", "time": "30-40 minutos"}'::jsonb,
  '[
    {"question": "¿Cuál es el horario?", "answer": "Atendemos de lunes a sábado, 11am a 10pm"},
    {"question": "¿Hacen domicilio?", "answer": "Sí, domicilio gratis en pedidos mayores a $40.000"}
  ]'::jsonb,
  '{"tone": "friendly", "formality": "casual", "use_emojis": true}'::jsonb,
  '["name", "phone", "address"]'::jsonb,
  NOW())
ON CONFLICT (id) DO UPDATE SET
  business_name = EXCLUDED.business_name,
  client_id = EXCLUDED.client_id,
  price_range = EXCLUDED.price_range,
  delivery = EXCLUDED.delivery,
  required_info = EXCLUDED.required_info;

-- 6. Historial de chat de ejemplo
INSERT INTO public.chat_history (id, agent_id, user_id, role, message, created_at) VALUES
(1, 'agent_dev_001', 'user_test_001', 'user', '¡Hola! Quisiera ordenar una pizza', NOW() - INTERVAL '10 minutes'),
(2, 'agent_dev_001', 'user_test_001', 'assistant', '¡Hola! Con gusto te ayudo. Tenemos: Pizza Hawaiana ($25.000), Pepperoni ($28.000) y Vegetariana ($26.000). ¿Cuál prefieres?', NOW() - INTERVAL '9 minutes'),
(3, 'agent_dev_001', 'user_test_001', 'user', 'La hawaiana por favor', NOW() - INTERVAL '8 minutes'),
(4, 'agent_dev_001', 'user_test_001', 'assistant', 'Perfecto! Una Pizza Hawaiana por $25.000. ¿Cuál es tu dirección de entrega?', NOW() - INTERVAL '7 minutes'),
(5, 'agent_dev_001', 'user_test_001', 'user', 'Calle 123 #45-67', NOW() - INTERVAL '6 minutes'),
(6, 'agent_dev_001', 'user_test_001', 'assistant', 'Excelente! Tu pedido llegará a Calle 123 #45-67 en aproximadamente 30-40 minutos. Total: $25.000. ¿Pagas en efectivo o con tarjeta?', NOW() - INTERVAL '5 minutes')
ON CONFLICT (id) DO NOTHING;

-- 7. Transacciones de consumo de tokens
INSERT INTO public.token_transactions (id, client_id, agent_id, type, tokens, description, metadata, created_at) VALUES
('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', 'agent_dev_001', 'consumption', 5, 'Mensaje chat - conversación pizza', '{"tokens_input": 20, "tokens_output": 50}'::jsonb, NOW() - INTERVAL '9 minutes'),
('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', 'agent_dev_001', 'consumption', 5, 'Mensaje chat - confirmación pedido', '{"tokens_input": 15, "tokens_output": 45}'::jsonb, NOW() - INTERVAL '7 minutes'),
('99999999-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111', 'agent_dev_001', 'consumption', 5, 'Mensaje chat - dirección entrega', '{"tokens_input": 18, "tokens_output": 52}'::jsonb, NOW() - INTERVAL '5 minutes')
ON CONFLICT (id) DO NOTHING;

-- 8. Usuarios de prueba para auth (login con email/password: Test1234!)
--    admin@test.com  → rol admin (acceso total)
--    agent@test.com  → rol agent-manager (gestor de agentes)
INSERT INTO auth.users (
  instance_id, id, aud, role, email,
  encrypted_password,
  email_confirmed_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'authenticated', 'authenticated',
    'admin@test.com',
    extensions.crypt('Test1234!', extensions.gen_salt('bf')),
    NOW(), NOW(),
    '{"provider":"email","providers":["email"]}', '{"name":"Admin Test"}',
    NOW(), NOW(),
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'authenticated', 'authenticated',
    'agent@test.com',
    extensions.crypt('Test1234!', extensions.gen_salt('bf')),
    NOW(), NOW(),
    '{"provider":"email","providers":["email"]}', '{"name":"Agent Admin Test"}',
    NOW(), NOW(),
    '', '', '', ''
  )
ON CONFLICT (id) DO NOTHING;

-- Identidades para GoTrue (id = UUID propio, provider_id = UUID del usuario)
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES
  (
    extensions.uuid_generate_v4(),
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","email":"admin@test.com","email_verified":true}',
    'email', NOW(), NOW(), NOW()
  ),
  (
    extensions.uuid_generate_v4(),
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","email":"agent@test.com","email_verified":true}',
    'email', NOW(), NOW(), NOW()
  )
ON CONFLICT (provider_id, provider) DO NOTHING;

-- Miembros del cliente de prueba vinculados a los usuarios de auth
INSERT INTO public.client_members (client_id, auth_user_id, role, permissions, status, created_at) VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'admin', NULL, 'active', NOW()
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'agent-manager',
    ARRAY['agents:*','whatsapp-interactions:*','whatsapp-connections:*','agents-usage:*','tokens:view','tokens:history','account:*'],
    'active', NOW()
  )
ON CONFLICT (client_id, auth_user_id) DO NOTHING;

-- 9. Lead de ejemplo capturado
INSERT INTO public.leads (id, agent_id, name, phone, email, address, notes, status, source, created_at) VALUES
(1, 'agent_dev_001', 'Ana Pérez', '+573009876543', 'ana@example.com', 'Carrera 7 #80-45', 'Interesada en pizza hawaiana', 'contacted', 'chat', NOW() - INTERVAL '2 hours')
ON CONFLICT (id) DO NOTHING;

-- 9. Resetear secuencias
SELECT setval('public.agents_id_seq', GREATEST((SELECT MAX(id) FROM public.agents), 1));
SELECT setval('public.chat_history_id_seq', GREATEST((SELECT MAX(id) FROM public.chat_history), 1));
SELECT setval('public.leads_id_seq', GREATEST((SELECT MAX(id) FROM public.leads), 1));

-- Confirmación
DO $$
BEGIN
  RAISE NOTICE 'Seed completado: 1 cliente, 1 agente, 3 paquetes, 6 chats, 1 lead';
END $$;
