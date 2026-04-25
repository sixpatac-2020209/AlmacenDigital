import { Component } from '@angular/core';
import { CartService } from '../../services/cart.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './cart.component.html',
  styles: []
})
export class CartComponent {
carrito: any[] = [];

constructor(private cartService: CartService) {}

ngOnInit() {
  this.loadCart();
}

loadCart() {
  this.carrito = this.cartService.getCart();
}

increase(id: number) {
  this.cartService.increase(id);
  this.loadCart();
}

decrease(id: number) {
  this.cartService.decrease(id);
  this.loadCart();
}

remove(id: number) {
  this.cartService.removeProduct(id);
  this.loadCart();
}

getTotal() {
  return this.cartService.getTotal();
}

getShippingCost(): number {
  const total = this.getTotal();
  return total > 500 ? 0 : 25;
}

getGrandTotal(): number {
  return this.getTotal() + this.getShippingCost();
}

clearCart() {
  this.cartService.clear();
  this.loadCart();
}

}