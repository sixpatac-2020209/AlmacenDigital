import { Component } from '@angular/core';
import { CartService } from '../../services/cart.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './checkout.component.html'
})
export class CheckoutComponent {

  carrito: any[] = [];
  totalItems = 0;
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

  constructor(private cartService: CartService) { }

  ngOnInit() {
    this.loadCart();
  }

  loadCart() {
    this.carrito = this.cartService.getCart();
  }

  getTotal() {
    return this.carrito.reduce((total, item) => total + item.precio * item.cantidad, 0);
  }

  enviarPedido() {

    const datosEnvio = this.usarMismosDatos ? this.facturacion : this.envio;

    let mensaje = `🛒 *Nuevo Pedido*\n\n`;

    mensaje += `📌 *Facturación*\n`;
    mensaje += `👤 ${this.facturacion.nombre} ${this.facturacion.apellido}\n`;
    mensaje += `📧 ${this.facturacion.email}\n`;
    mensaje += `📱 ${this.facturacion.telefono}\n`;
    mensaje += `📍 ${this.facturacion.direccion}\n\n`;

    mensaje += `🚚 *Envío*\n`;
    mensaje += `👤 ${datosEnvio.nombre} ${datosEnvio.apellido}\n`;
    mensaje += `📱 ${datosEnvio.telefono}\n`;
    mensaje += `📍 ${datosEnvio.direccion}\n\n`;

    mensaje += `🧾 *Productos*\n`;

    this.carrito.forEach(item => {
      mensaje += `- ${item.nombre} x${item.cantidad} = Q.${item.precio * item.cantidad}\n`;
    });

    mensaje += `\n� Envío: Q.${this.getShippingCost()}`;
    mensaje += `\n💰 Total final: Q.${this.getGrandTotal()}`;

    const numero = '50231681920';
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;

    window.open(url, '_blank');
  }

  loadCount() {
    this.totalItems = this.cartService.getTotalItems();
  }
}