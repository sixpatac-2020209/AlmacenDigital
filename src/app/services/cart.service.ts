import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface CartItem {
  id: number | string;
  nombre: string;
  precio: number;
  imagen?: string;
  cantidad?: number;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {

  private KEY = 'carrito';
  private totalItemsSubject = new BehaviorSubject<number>(this.getTotalItems());
  totalItems$: Observable<number> = this.totalItemsSubject.asObservable();

  // 🔹 Obtener carrito
  getCart(): CartItem[] {
    return JSON.parse(localStorage.getItem(this.KEY) || '[]');
  }

  // 🔹 Guardar carrito
  private saveCart(cart: CartItem[]) {
    localStorage.setItem(this.KEY, JSON.stringify(cart));
    this.totalItemsSubject.next(this.calculateTotalItems(cart));
  }

  // 🔹 Agregar producto
  addProduct(product: CartItem) {
    const cart = this.getCart();

    const exist = cart.find(p => p.id === product.id);

    if (exist) {
      exist.cantidad = (exist.cantidad || 0) + 1;
    } else {
      cart.push({ ...product, cantidad: 1 });
    }

    this.saveCart(cart);
  }

  // 🔹 Eliminar producto
  removeProduct(id: number | string) {
    const cart = this.getCart().filter(p => p.id !== id);
    this.saveCart(cart);
  }

  // 🔹 Aumentar cantidad
  increase(id: number | string) {
    const cart = this.getCart();
    const prod = cart.find(p => p.id === id);

    if (prod) {
      prod.cantidad = (prod.cantidad || 0) + 1;
      this.saveCart(cart);
    }
  }

  // 🔹 Disminuir cantidad
  decrease(id: number | string) {
    const cart = this.getCart();
    const prod = cart.find(p => p.id === id);

    if (prod) {
      if ((prod.cantidad || 0) > 1) {
        prod.cantidad = (prod.cantidad || 0) - 1;
      } else {
        // si llega a 0 lo elimina
        this.removeProduct(id);
        return;
      }
    }

    this.saveCart(cart);
  }

  // 🔹 Total dinero
  getTotal(): number {
    return this.getCart()
      .reduce((total, p) => total + (p.precio * (p.cantidad || 0)), 0);
  }

  // 🔹 TOTAL DE PRODUCTOS (🔥 ESTE ES EL QUE QUIERES)
  getTotalItems(): number {
    return this.calculateTotalItems(this.getCart());
  }

  private calculateTotalItems(cart: CartItem[]): number {
    return cart.reduce((total, p) => total + (p.cantidad || 0), 0);
  }

  // 🔹 Vaciar carrito
  clear() {
    localStorage.removeItem(this.KEY);
    this.totalItemsSubject.next(0);
  }
}