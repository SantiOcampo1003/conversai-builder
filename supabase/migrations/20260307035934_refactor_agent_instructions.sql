-- Refactorizar campos de instrucciones en la tabla agents

-- 1. Renombrar custom_instructions (texto) a custom_instruction (singular)
-- TODO: Eliminar completamente este campo despues del deploy y migracion completa al nuevo sistema
-- Por ahora se mantiene por compatibilidad durante la transicion
ALTER TABLE agents
RENAME COLUMN custom_instructions TO custom_instruction;

-- 2. Crear nuevo campo custom_instructions (JSONB) para instrucciones con toggle
-- Estructura: [{ instruction: string, active: boolean }, ...]
ALTER TABLE agents
ADD COLUMN IF NOT EXISTS custom_instructions JSONB DEFAULT '[]'::jsonb;

-- 3. Crear campo internal_custom_instructions para reglas internas del sistema
-- Este campo solo sera visible para super admins
ALTER TABLE agents
ADD COLUMN IF NOT EXISTS internal_custom_instructions TEXT;

-- 4. Poblar internal_custom_instructions con las reglas finales por defecto
UPDATE agents
SET internal_custom_instructions = '=== REGLAS FINALES ===
1. Lee el historial de conversacion disponible en los mensajes anteriores
2. Si el cliente ya dio informacion, NO la vuelvas a preguntar
3. Usa informacion de mensajes previos para dar contexto
4. Maximo 3 lineas por mensaje
5. Una pregunta a la vez
6. Responde en espanol de forma natural como en WhatsApp
7. IMPORTANTE: Solo interaccion por chat. NO ofrecer llamadas telefonicas ni indicar que devolveras llamadas'
WHERE internal_custom_instructions IS NULL;

-- 5. Comentarios para documentacion
COMMENT ON COLUMN agents.custom_instruction IS 'Instruccion principal del agente (texto simple, anteriormente custom_instructions)';
COMMENT ON COLUMN agents.custom_instructions IS 'Instrucciones personalizadas con toggle de activacion (JSONB: [{instruction: string, active: boolean}])';
COMMENT ON COLUMN agents.internal_custom_instructions IS 'Reglas internas del sistema (solo visible para super admin)';
