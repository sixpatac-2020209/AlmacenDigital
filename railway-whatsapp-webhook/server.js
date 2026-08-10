import express from 'express';

const app = express();
const port = process.env.PORT || 3000;

// Soporta payload JSON y text/plain (tu frontend actual envia text/plain con JSON serializado).
app.use(express.json({ limit: '1mb' }));
app.use(express.text({ type: 'text/plain', limit: '1mb' }));

function getEnv(name, required = true) {
  const value = process.env[name];
  if (required && !value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value || '';
}

function parseIncomingBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  if (typeof body === 'object') return body;
  return {};
}

function formatCurrency(value) {
  const number = Number(value || 0);
  return `Q.${number.toFixed(2)}`;
}

function buildWhatsappText(data) {
  const orderRef = data.orderRef || 'SIN-REF';
  const pedidoId = data.pedidoId || 'N/A';
  const customerName = `${data?.facturacion?.nombre || ''} ${data?.facturacion?.apellido || ''}`.trim() || 'Cliente';
  const telefono = data?.facturacion?.telefono || data?.envio?.telefono || 'N/A';
  const total = formatCurrency(data.total);

  const items = Array.isArray(data.items) ? data.items : [];
  const itemsText = items.length
    ? items
        .slice(0, 10)
        .map((it) => `- ${it?.nombre || 'Producto'} x${it?.cantidad || 1} (${formatCurrency(it?.subtotal || (it?.precio || 0) * (it?.cantidad || 1))})`)
        .join('\n')
    : '- Sin items';

  return [
    'Nuevo pedido recibido',
    `Orden: ${orderRef}`,
    `Pedido ID: ${pedidoId}`,
    `Cliente: ${customerName}`,
    `Telefono: ${telefono}`,
    `Total: ${total}`,
    '',
    'Productos:',
    itemsText
  ].join('\n');
}

async function sendWhatsappTextMessage(text) {
  const token = getEnv('WHATSAPP_TOKEN');
  const phoneNumberId = getEnv('WHATSAPP_PHONE_NUMBER_ID');
  const to = getEnv('WHATSAPP_TO');
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: {
      preview_url: false,
      body: text
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const raw = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { raw };
  }

  if (!response.ok) {
    throw new Error(`WhatsApp API error ${response.status}: ${raw}`);
  }

  return parsed;
}

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'railway-whatsapp-webhook' });
});

app.post('/webhook/pedido', async (req, res) => {
  try {
    const expectedToken = getEnv('WEBHOOK_TOKEN');
    const incomingToken = String(req.query.token || req.headers['x-webhook-token'] || '');

    if (!incomingToken || incomingToken !== expectedToken) {
      return res.status(401).json({ ok: false, error: 'Unauthorized token' });
    }

    const data = parseIncomingBody(req.body);
    const message = buildWhatsappText(data);
    const result = await sendWhatsappTextMessage(message);

    return res.status(200).json({ ok: true, result });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.listen(port, () => {
  console.log(`Webhook running on port ${port}`);
});
