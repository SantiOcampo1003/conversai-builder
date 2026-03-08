-- =====================================================
-- Migration: Convert leads.id from INTEGER to UUID
-- Descripcion: Convierte el ID de leads a UUID para consistencia
-- Fecha: 2024-03-08
-- =====================================================

-- IMPORTANTE: Esta migracion debe ejecutarse ANTES de crear las tablas de Meta Ads

-- 1. Crear nueva columna UUID temporal
ALTER TABLE leads ADD COLUMN id_new UUID DEFAULT gen_random_uuid();

-- 2. Poblar la nueva columna con UUIDs unicos para cada registro existente
UPDATE leads SET id_new = gen_random_uuid() WHERE id_new IS NULL;

-- 3. Hacer la columna NOT NULL
ALTER TABLE leads ALTER COLUMN id_new SET NOT NULL;

-- 4. Eliminar la restriccion de PRIMARY KEY antigua
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_pkey;

-- 5. Eliminar la secuencia asociada al ID anterior
DROP SEQUENCE IF EXISTS leads_id_seq CASCADE;

-- 6. Renombrar columna antigua y nueva
ALTER TABLE leads RENAME COLUMN id TO id_old;
ALTER TABLE leads RENAME COLUMN id_new TO id;

-- 7. Establecer nuevo PRIMARY KEY
ALTER TABLE leads ADD PRIMARY KEY (id);

-- 8. Eliminar columna antigua (ya no la necesitamos)
ALTER TABLE leads DROP COLUMN id_old;

-- Comentario
COMMENT ON COLUMN leads.id IS 'UUID unico del lead (migrado desde INTEGER)';
