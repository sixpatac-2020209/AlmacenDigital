# Railway WhatsApp Webhook

Microservicio para recibir pedidos desde checkout y enviar notificaciones por WhatsApp Cloud API.

## 1) Variables de entorno en Railway

Configura estas variables en tu servicio:

- `WEBHOOK_TOKEN`: token secreto que tambien pondras en Angular.
- `WHATSAPP_TOKEN`: access token de WhatsApp Cloud API.
- `WHATSAPP_PHONE_NUMBER_ID`: phone number id de Meta.
- `WHATSAPP_TO`: numero destino en formato internacional, por ejemplo `50255551234`.
- `WHATSAPP_API_VERSION` (opcional): por defecto `v21.0`.

## 2) Deploy rapido

1. Sube esta carpeta a un repo o usa Railway "Deploy from GitHub".
2. Railway detecta `npm start` automaticamente.
3. Espera estado `Deployed`.
4. Prueba salud:
   - `GET https://TU-SERVICIO.up.railway.app/health`

## 3) Endpoint del webhook

- URL: `POST https://TU-SERVICIO.up.railway.app/webhook/pedido?token=TU_WEBHOOK_TOKEN`
- Tambien acepta header `x-webhook-token`.

## 4) Conectar con Angular (ya lo tienes preparado)

En `src/environments/environment.ts` y `src/environments/environment.prod.ts`:

- `pedidosNotificationWebhookUrl`: `https://TU-SERVICIO.up.railway.app/webhook/pedido`
- `pedidosNotificationToken`: `TU_WEBHOOK_TOKEN`

Tu checkout ya envia el POST en segundo plano despues de confirmar pedido.

## 5) Payload esperado (ejemplo)

```json
{
  "orderRef": "OC-2026-ABC123",
  "pedidoId": "abc123",
  "facturacion": { "nombre": "Juan", "apellido": "Perez", "telefono": "5555-5555" },
  "envio": { "telefono": "5555-5555" },
  "items": [
    { "nombre": "Producto 1", "cantidad": 2, "precio": 99.99, "subtotal": 199.98 }
  ],
  "total": 224.98
}
```

## 6) Prueba local opcional

```bash
npm install
npm start
```

Luego prueba:

```bash
curl -X POST "http://localhost:3000/webhook/pedido?token=TU_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"orderRef\":\"OC-TEST-001\",\"facturacion\":{\"nombre\":\"Test\",\"apellido\":\"User\",\"telefono\":\"50255551234\"},\"items\":[{\"nombre\":\"Producto demo\",\"cantidad\":1,\"precio\":100,\"subtotal\":100}],\"total\":100}"
```

## 7) Nota importante

- Este flujo NO abre WhatsApp Web del cliente.
- El mensaje sale desde backend a API oficial de WhatsApp.
