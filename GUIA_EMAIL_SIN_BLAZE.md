# Envio automatico de correo sin Blaze (Google Apps Script)

Esta guia permite enviar correo automaticamente al negocio cuando se crea un pedido, sin usar Cloud Functions de Firebase.

## 1) Crear script en Google Apps Script

1. Ve a https://script.google.com
2. Crea un proyecto nuevo.
3. Reemplaza el contenido de `Code.gs` por este:

```javascript
const DESTINO = 'contacto@almacendigital.com';
const TOKEN = 'CAMBIA_ESTE_TOKEN_SEGUR0';

function doPost(e) {
  try {
    const token = (e.parameter && e.parameter.token) || '';
    if (token !== TOKEN) {
      return ContentService.createTextOutput('unauthorized').setMimeType(ContentService.MimeType.TEXT);
    }

    const raw = e.postData && e.postData.contents ? e.postData.contents : '{}';
    const data = JSON.parse(raw);

    const subject = `Nuevo pedido ${data.orderRef || ''}`;
    const lines = [];
    lines.push('Nuevo pedido recibido');
    lines.push('');
    lines.push(`Orden: ${data.orderRef || ''}`);
    lines.push(`Pedido ID: ${data.pedidoId || 'pendiente'}`);
    lines.push(`Fecha: ${new Date(data.createdAt || Date.now()).toLocaleString('es-GT')}`);
    lines.push('');
    lines.push('FACTURACION');
    lines.push(`${(data.facturacion?.nombre || '')} ${(data.facturacion?.apellido || '')}`);
    lines.push(`Email: ${data.facturacion?.email || ''}`);
    lines.push(`Telefono: ${data.facturacion?.telefono || ''}`);
    lines.push(`Direccion: ${data.facturacion?.direccion || ''}`);
    lines.push('');
    lines.push('ENVIO');
    lines.push(`${(data.envio?.nombre || '')} ${(data.envio?.apellido || '')}`);
    lines.push(`Telefono: ${data.envio?.telefono || ''}`);
    lines.push(`Direccion: ${data.envio?.direccion || ''}`);
    lines.push('');
    lines.push('PRODUCTOS');

    (data.items || []).forEach((item) => {
      lines.push(`- ${item.nombre || ''} x${item.cantidad || 0} = Q.${Number(item.subtotal || 0).toFixed(2)}`);
    });

    lines.push('');
    lines.push(`Subtotal: Q.${Number(data.subtotal || 0).toFixed(2)}`);
    lines.push(`Envio: Q.${Number(data.envioCosto || 0).toFixed(2)}`);
    lines.push(`Total: Q.${Number(data.total || 0).toFixed(2)}`);
    lines.push('');
    lines.push(data.disclaimer || 'Comprobante interno');

    MailApp.sendEmail({
      to: DESTINO,
      subject,
      body: lines.join('\n')
    });

    return ContentService.createTextOutput('ok').setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    return ContentService.createTextOutput('error: ' + err).setMimeType(ContentService.MimeType.TEXT);
  }
}
```

## 2) Publicar como Web App

1. Click en `Deploy` > `New deployment`.
2. Tipo: `Web app`.
3. `Execute as`: `Me`.
4. `Who has access`: `Anyone`.
5. Copia la URL del Web App.

## 3) Configurar Angular

Edita estos archivos:

- `src/environments/environment.ts`
- `src/environments/environment.prod.ts`

Llena estos campos:

```ts
pedidosNotificationWebhookUrl: 'PEGA_AQUI_URL_WEB_APP',
pedidosNotificationToken: 'CAMBIA_ESTE_TOKEN_SEGUR0',
```

El token debe coincidir con `TOKEN` en Apps Script.

## 4) Probar

1. Ejecuta checkout y confirma un pedido.
2. Verifica que llegue correo a `DESTINO`.
3. Verifica que en dashboard aparezca el pedido.

## Notas

- Esto evita depender de Blaze para Cloud Functions.
- El cliente solo ve confirmacion de pedido y descarga su orden.
- El correo lo envias por codigo (backend de Apps Script).

## Alternativa recomendada si Google Script no autoriza: Webhook API (Make)

Si no te deja autorizar Apps Script, usa una API webhook de automatizacion.

### 1) Crear webhook en Make

1. Crea cuenta en https://www.make.com (plan gratis sirve para empezar).
2. Crea un `Scenario`.
3. Primer modulo: `Webhooks` -> `Custom webhook`.
4. Copia la URL del webhook.

### 2) Enviar correo desde Make

1. Segundo modulo: `Gmail` -> `Send an email` (o `Email` si prefieres SMTP).
2. Mapea campos del webhook:
  - Asunto: `Nuevo pedido {{orderRef}}`
  - Cuerpo: usa `facturacion`, `envio`, `items`, `total`, etc.
3. Activa el scenario (`ON`).

### 3) Configurar Angular

En estos archivos:

- `src/environments/environment.ts`
- `src/environments/environment.prod.ts`

coloca:

```ts
pedidosNotificationWebhookUrl: 'URL_WEBHOOK_DE_MAKE',
pedidosNotificationToken: 'TOKEN_SECRETO_TUYO',
```

En Make, valida ese token comparando el query param `token` para evitar llamadas externas no autorizadas.

### 4) Probar

1. Confirma un pedido en checkout.
2. Revisa en Make que el webhook reciba datos.
3. Verifica correo recibido en tu bandeja.

Con esto no dependes de autorizacion OAuth de Google Script para desplegar.

## Solucion de problemas

### A) "Google hasn't verified this app"

Esto es normal en Apps Script propio.

1. En la pantalla de advertencia, haz click en `Advanced`.
2. Luego click en `Go to <nombre-del-proyecto> (unsafe)`.
3. Acepta permisos con tu misma cuenta de Google.

Es seguro en este caso porque el script lo creaste tu y corre en tu cuenta.

### B) "Todavia me abre mailto"

Si todavia abre `mailto`, el navegador esta usando una version anterior del frontend.

1. Guarda cambios en VS Code.
2. Si usas `ng serve`, reinicia el proceso.
3. Haz hard refresh en navegador (`Ctrl+F5`).
4. Verifica que el boton diga `Confirmar pedido` (ya no `Enviar pedido por correo`).

### C) No llega correo aunque el pedido se guarda

1. Confirma que en `environment.ts` y `environment.prod.ts` llenaste:
  - `pedidosNotificationWebhookUrl`
  - `pedidosNotificationToken`
2. Verifica que el `TOKEN` del script coincide exactamente.
3. En Apps Script, revisa `Executions` para ver errores del webhook.
