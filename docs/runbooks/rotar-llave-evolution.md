# Runbook: desplegar Evolution en el backend y rotar la llave global

**Por qué:** hasta este cambio el dashboard llamaba a Evolution desde el navegador con la llave
global (`VITE_EVOLUTION_API_KEY`). Esa llave quedó publicada en el JavaScript de
www.easyagent.space y en el historial de git (`conversai-builder/.env.production`), y está
escrita a mano en nodos de n8n. Con ella se pueden leer, enviar, desconectar o borrar las
líneas de **todos** los clientes. Hay que darla por expuesta y cambiarla.

**El orden importa.** Si se rota la llave antes de actualizar el backend y n8n, los agentes
dejan de responder por WhatsApp.

Cada paso que toca producción se ejecuta con confirmación de quien opera.

---

## 1. Backend (EasyPanel)

1. Mergear el PR. `deploy-backend.yml` despliega solo (cambia `backend/`).
2. En EasyPanel → servicio `conversation-builder-backend` → Environment:
   - Confirmar que existen `EVOLUTION_API_URL` y `EVOLUTION_API_KEY` (ya los usan los avisos al closer).
   - `NODE_ENV=production` (hoy arranca como `development`).
   - Opcional: `WHATSAPP_INCOMING_WEBHOOK_URL` (por defecto el flujo v2 de n8n).
3. Verificar:
   ```bash
   ssh easypanel 'docker exec $(docker ps -q -f name=easy_agents_conversation-builder-backend) node -v'   # v24.x
   curl -s -o /dev/null -w '%{http_code}\n' https://<backend>/api/chat/health                        # 200
   curl -s -w ' %{http_code}\n' 'https://<backend>/api/whatsapp-lines?clientId=00000000-0000-0000-0000-000000000000'  # 401 sin sesión
   ```

## 2. Frontend (Vercel)

1. El mismo merge despliega el frontend.
2. En Vercel → Project → Settings → Environment Variables: **borrar** `VITE_EVOLUTION_API_URL`,
   `VITE_EVOLUTION_API_KEY` y `VITE_EVOLUTION_WEBHOOK_URL`. Confirmar que `VITE_BACKEND_CHAT_URL`
   apunta al backend. Redesplegar.
3. Node: Vercel toma `engines.node = 24.x` del `package.json`; confirmar en el log del build.
4. Verificar que el bundle publicado ya no tiene la llave (sin imprimirla):
   ```bash
   K=$(ssh easypanel 'docker exec $(docker ps -q -f name=easy_agents_evolution-api.1) printenv AUTHENTICATION_API_KEY')
   for js in $(curl -s https://www.easyagent.space/ | grep -oE '/assets/[^"]+\.js'); do
     curl -s "https://www.easyagent.space$js" | grep -q "$K" && echo "LLAVE EN $js"
   done; echo listo
   ```
5. En /dashboard/wa-connections: las líneas muestran su estado real y en la pestaña Network no
   hay ninguna petición a `easy-agents-evolution-api…`.

## 3. n8n: sacar la llave de los nodos

Crear una credencial **Header Auth** llamada `Evolution API` (nombre `apikey`, valor = llave
actual) y usarla en estos nodos HTTP en lugar del header escrito a mano
(inventario del 2026-11-05, exportando los 27 workflows):

| Workflow | Estado | Nodos |
|---|---|---|
| `T86Befb8C8Qq9p8P` WhatsApp Incoming v2 (archivos) - PRUEBA | **activo, tráfico real** | Send WhatsApp Response, Send Media |
| `i5-nWn6dxBksSV0mLK16A` WhatsApp Incoming PROD | **activo** | Send WhatsApp Response |
| `jajSdrXjkMF4djEA` 05 - Teia Invest | **activo** | Send WhatsApp Response1, Send WhatsApp Response2 |
| `oIOB5IO0mOk9fI6h` 05 - WhatsApp El Gibbor Barbería | inactivo | Send WhatsApp Response |
| `gTpAtA75EYYYszoJ` 05 - Tampa Luxury n | inactivo | Send WhatsApp Response1 |
| `tWzy4qGtasrSghQvzeGkN` 05 - Tampa luxury | inactivo | Send WhatsApp Response2 |

Después de cada cambio, mandar un mensaje de prueba a una línea conectada y confirmar que el
agente responde. Repetir el inventario para confirmar que ningún nodo conserva la llave.

## 4. Rotar la llave (ventana corta, los tres cambios seguidos)

1. Generar una nueva: `openssl rand -hex 16 | tr a-f A-F`.
2. EasyPanel → `evolution-api` → `AUTHENTICATION_API_KEY` = nueva → redeploy.
   Las sesiones de WhatsApp viven en la base de Evolution: no hay que volver a escanear QR.
3. EasyPanel → `conversation-builder-backend` → `EVOLUTION_API_KEY` = nueva → redeploy.
4. n8n → credencial `Evolution API` → valor nuevo.

## 5. Verificar

- El panel sincroniza las líneas sin aviso de error.
- Un mensaje a una línea conectada recibe respuesta (ejecución `success` en n8n).
- En los logs del backend no aparece `Evolution respondió 401`:
  `ssh easypanel 'docker logs --since 10m $(docker ps -q -f name=easy_agents_conversation-builder-backend) 2>&1 | grep -c 401'`
- La llave vieja ya no sirve: `curl -s -o /dev/null -w '%{http_code}' -H "apikey: <vieja>" https://easy-agents-evolution-api.ftppdk.easypanel.host/instance/fetchInstances` → `401`.

## Notas

- La llave vieja sigue en el historial de git; una vez rotada ya no sirve, no hace falta reescribir el historial.
- Las ejecuciones de n8n guardan el body del webhook de Evolution, que incluye la llave de la
  instancia. Conviene bajar la retención de ejecuciones exitosas.
