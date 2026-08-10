import { Component } from '@angular/core';
import { CartService } from '../../services/cart.service';
import { FirebaseService, Pedido, PedidoItem } from '../../services/firebase.service';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './checkout.component.html'
})
export class CheckoutComponent {

  carrito: any[] = [];
  totalItems = 0;
  private lastOrderRef: string | null = null;
  private lastPedidoId: string | null = null;
  pedidoRealizado = false;
  enviandoPedido = false;
  estadoPedidoMensaje = '';
  facturacion = {
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    direccion: ''
  };

  envio = {
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    direccion: ''
  };

  usarMismosDatos = true;

  getShippingCost(): number {
    const total = this.getTotal();
    return total > 500 ? 0 : 25;
  }

  getGrandTotal(): number {
    return this.getTotal() + this.getShippingCost();
  }

  constructor(
    private cartService: CartService,
    private firebaseService: FirebaseService,
    private authService: AuthService
  ) { }

  private ensureAuthForPedido(): Promise<void> {
    if (this.authService.getCurrentUser()) {
      return Promise.resolve();
    }
    return this.authService.signInAnonymously().then(() => undefined);
  }

  ngOnInit() {
    this.loadCart();
  }

  loadCart() {
    this.carrito = this.cartService.getCart();
  }

  getTotal() {
    return this.carrito.reduce((total, item) => total + item.precio * item.cantidad, 0);
  }

  private getDatosEnvio() {
    return this.usarMismosDatos ? this.facturacion : this.envio;
  }

  private formatPedidoFolio(pedidoId: string): string {
    const year = new Date().getFullYear();
    const shortId = (pedidoId || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(-6).padStart(6, '0');
    return `OC-${year}-${shortId}`;
  }

  private createProvisionalOrderRef(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `OC-${year}${month}${day}-${hour}${minute}-${suffix}`;
  }

  private markPedidoRealizado(orderRef: string, pedidoId?: string): void {
    this.pedidoRealizado = true;
    this.estadoPedidoMensaje = pedidoId
      ? `Tu pedido fue registrado correctamente. Orden ${orderRef} · ID ${pedidoId}.`
      : `Tu pedido fue recibido con orden provisional ${orderRef}. Te confirmaremos en breve.`;
  }

  private buildBackendNotificationPayload(orderRef: string, datosEnvio: any, pedidoId?: string) {
    return {
      orderRef,
      pedidoId: pedidoId || null,
      createdAt: Date.now(),
      facturacion: { ...this.facturacion },
      envio: { ...datosEnvio },
      items: this.carrito.map(item => ({
        id: item.id,
        nombre: item.nombre,
        cantidad: item.cantidad,
        precio: item.precio,
        subtotal: (item.precio || 0) * (item.cantidad || 0)
      })),
      subtotal: this.getTotal(),
      envioCosto: this.getShippingCost(),
      total: this.getGrandTotal(),
      disclaimer: 'Comprobante interno (no factura SAT)'
    };
  }

  private notifyPedidoWebhook(orderRef: string, datosEnvio: any, pedidoId?: string): void {
    const webhookUrl = (environment as any).pedidosNotificationWebhookUrl || '';
    if (!webhookUrl) return;

    const token = (environment as any).pedidosNotificationToken || '';
    const payload = this.buildBackendNotificationPayload(orderRef, datosEnvio, pedidoId);

    const targetUrl = token
      ? `${webhookUrl}${webhookUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
      : webhookUrl;

    // no-cors keeps this compatible with Apps Script Web App without preflight/CORS config.
    fetch(targetUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    }).catch(() => {
      // Do not block checkout confirmation if notification webhook fails.
    });
  }

  private buildOrdenCompraTexto(orderRef: string, datosEnvio: any, pedidoId?: string): string {
    const lines: string[] = [];
    lines.push('ALMACEN DIGITAL');
    lines.push('ORDEN DE COMPRA (COMPROBANTE INTERNO)');
    lines.push('No reemplaza factura electronica autorizada por SAT.');
    lines.push('');
    lines.push(`Orden: ${orderRef}`);
    lines.push(`Pedido ID: ${pedidoId || 'pendiente de confirmacion'}`);
    lines.push(`Fecha: ${new Date().toLocaleString('es-GT')}`);
    lines.push('');
    lines.push('FACTURACION');
    lines.push(`${this.facturacion.nombre} ${this.facturacion.apellido}`);
    lines.push(`Email: ${this.facturacion.email}`);
    lines.push(`Telefono: ${this.facturacion.telefono}`);
    lines.push(`Direccion: ${this.facturacion.direccion}`);
    lines.push('');
    lines.push('ENVIO');
    lines.push(`${datosEnvio.nombre} ${datosEnvio.apellido}`);
    lines.push(`Telefono: ${datosEnvio.telefono}`);
    lines.push(`Direccion: ${datosEnvio.direccion}`);
    lines.push('');
    lines.push('PRODUCTOS');
    this.carrito.forEach(item => {
      lines.push(`- ${item.nombre} x${item.cantidad} = Q.${(item.precio * item.cantidad).toFixed(2)}`);
    });
    lines.push('');
    lines.push(`Subtotal: Q.${this.getTotal().toFixed(2)}`);
    lines.push(`Envio: Q.${this.getShippingCost().toFixed(2)}`);
    lines.push(`Total: Q.${this.getGrandTotal().toFixed(2)}`);
    return lines.join('\n');
  }

  descargarOrdenCompra(): void {
    if (!this.carrito || this.carrito.length === 0) {
      alert('No hay productos en el carrito para generar la orden de compra.');
      return;
    }

    if (!this.pedidoRealizado) {
      alert('Primero debes confirmar el pedido para poder descargar la orden de compra.');
      return;
    }

    const datosEnvio = this.getDatosEnvio();
    const orderRef = this.lastOrderRef || this.createProvisionalOrderRef();
    const pedidoId = this.lastPedidoId || undefined;
    const contenido = this.buildOrdenCompraTexto(orderRef, datosEnvio, pedidoId);

    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${orderRef}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  enviarPedido() {
    if (this.enviandoPedido || this.pedidoRealizado) {
      return;
    }

    this.enviandoPedido = true;
    const datosEnvio = this.getDatosEnvio();
    const provisionalOrderRef = this.createProvisionalOrderRef();
    this.pedidoRealizado = false;
    this.estadoPedidoMensaje = '';

    // Guardar pedido en Firestore antes de abrir WhatsApp
    const items: PedidoItem[] = this.carrito.map(i => ({ id: i.id, nombre: i.nombre, precio: i.precio, cantidad: i.cantidad }));
    const pedido: Pedido = {
      facturacion: { ...this.facturacion },
      envio: { ...datosEnvio },
      items,
      subtotal: this.getTotal(),
      envioCosto: this.getShippingCost(),
      total: this.getGrandTotal(),
      estado: 'nuevo'
    };

    // Intentar guardar directo; si Firestore lo bloquea por permisos, reintentar con auth anónima.
    this.firebaseService.crearPedido(pedido)
      .then((pedidoId) => {
        const orderRef = this.formatPedidoFolio(pedidoId);
        this.lastOrderRef = orderRef;
        this.lastPedidoId = pedidoId;
        this.markPedidoRealizado(orderRef, pedidoId);
        this.notifyPedidoWebhook(orderRef, datosEnvio, pedidoId);
        this.enviandoPedido = false;
      })
      .catch((firstErr) => {
        const msg = String(firstErr?.message || '').toLowerCase();
        const isPermissionError = msg.includes('permission') || msg.includes('insufficient');

        if (!isPermissionError) {
          this.lastOrderRef = provisionalOrderRef;
          this.lastPedidoId = null;
          this.markPedidoRealizado(provisionalOrderRef);
          this.enviandoPedido = false;
          alert('No se pudo guardar el pedido en la base de datos: ' + firstErr.message);
          return;
        }

        this.ensureAuthForPedido()
          .then(() => this.firebaseService.crearPedido(pedido))
          .then((pedidoId) => {
            const orderRef = this.formatPedidoFolio(pedidoId);
            this.lastOrderRef = orderRef;
            this.lastPedidoId = pedidoId;
            this.markPedidoRealizado(orderRef, pedidoId);
            this.notifyPedidoWebhook(orderRef, datosEnvio, pedidoId);
            this.enviandoPedido = false;
          })
          .catch((authOrRetryErr) => {
            this.lastOrderRef = provisionalOrderRef;
            this.lastPedidoId = null;
            this.markPedidoRealizado(provisionalOrderRef);

            const authMsg = String(authOrRetryErr?.message || '').toLowerCase();
            const adminRestricted = authMsg.includes('admin-restricted-operation') || authMsg.includes('operation-not-allowed');

            const extra = adminRestricted
              ? '\nFirebase: habilita Authentication > Sign-in method > Anonymous.'
              : '\nFirebase: revisa reglas de Firestore para coleccion pedidos (create).';

            this.enviandoPedido = false;
            alert('No se pudo guardar el pedido en la base de datos: ' + authOrRetryErr.message + extra);
          });
      });
  }

  loadCount() {
    this.totalItems = this.cartService.getTotalItems();
  }
}