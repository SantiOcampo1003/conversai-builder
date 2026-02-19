#!/bin/bash
# seed_auth_users.sh
# Crea usuarios de prueba en Supabase Auth via admin API y los vincula al cliente de prueba.
# Ejecutar DESPUÉS de: supabase db reset
#
# Usuarios creados:
#   admin@test.com  / Test1234!  → rol admin (acceso total)
#   agent@test.com  / Test1234!  → rol agent-administrator (sin recarga de tokens)

set -e

SUPABASE_URL="http://127.0.0.1:54321"
SERVICE_ROLE_KEY="sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz"
CLIENT_ID="11111111-1111-1111-1111-111111111111"
DB_CONTAINER="supabase_db_easy-agents"

echo "→ Creando usuario admin@test.com..."
ADMIN_RESPONSE=$(curl -s \
  -X POST \
  "${SUPABASE_URL}/auth/v1/admin/users" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"Test1234!","email_confirm":true}')

ADMIN_ID=$(echo "$ADMIN_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)

if [ -z "$ADMIN_ID" ] || [ "$ADMIN_ID" = "None" ]; then
  echo "  ✗ Error creando admin@test.com: $(echo $ADMIN_RESPONSE | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("msg","?"))' 2>/dev/null)"
  exit 1
fi
echo "  ✓ admin@test.com creado (id: $ADMIN_ID)"

echo "→ Creando usuario agent@test.com..."
AGENT_RESPONSE=$(curl -s \
  -X POST \
  "${SUPABASE_URL}/auth/v1/admin/users" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"email":"agent@test.com","password":"Test1234!","email_confirm":true}')

AGENT_ID=$(echo "$AGENT_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)

if [ -z "$AGENT_ID" ] || [ "$AGENT_ID" = "None" ]; then
  echo "  ✗ Error creando agent@test.com: $(echo $AGENT_RESPONSE | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("msg","?"))' 2>/dev/null)"
  exit 1
fi
echo "  ✓ agent@test.com creado (id: $AGENT_ID)"

echo "→ Vinculando usuarios al cliente de prueba en client_members..."
docker exec "$DB_CONTAINER" psql -U postgres -c "
INSERT INTO public.client_members (client_id, auth_user_id, role, permissions, status, created_at)
VALUES
  (
    '${CLIENT_ID}',
    '${ADMIN_ID}',
    'admin', NULL, 'active', NOW()
  ),
  (
    '${CLIENT_ID}',
    '${AGENT_ID}',
    'agent-administrator',
    ARRAY['agents:*','whatsapp-interactions:*','whatsapp-connections:*','agents-usage:*','tokens:view','tokens:history','account:*'],
    'active', NOW()
  )
ON CONFLICT (client_id, auth_user_id) DO NOTHING;
" 2>&1

echo ""
echo "✓ Seed de usuarios completado:"
echo "  admin@test.com  / Test1234!  → admin    (id: $ADMIN_ID)"
echo "  agent@test.com  / Test1234!  → agent-administrator (id: $AGENT_ID)"
