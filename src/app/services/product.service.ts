import { Injectable } from '@angular/core';
import { map } from 'rxjs/operators';
import { Observable, BehaviorSubject } from 'rxjs';
import { FirebaseService, Producto } from './firebase.service';

export interface Product {
  id: string | number;
  nombre: string;
  descripcion: string;
  caracteristicas?: string;
  precio: number;
  sku?: string;
  codigo?: string;
  imagen?: string;
  imagenes?: string[];
  oferta?: number | boolean;
  cantidad?: number;
  categoria?: string;
  categoriaId?: string;
  precioOferta?: number;
  idCategoria?: string;
  createdAt?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private productsSubject = new BehaviorSubject<Product[]>([]);
  public products$ = this.productsSubject.asObservable();

  constructor(
    private firebaseService: FirebaseService
  ) {
    this.loadProducts();
  }

  loadProducts(): void {
    // Cargar desde Firebase
    this.firebaseService.getProductos().subscribe((firebaseProducts) => {
      if (firebaseProducts && firebaseProducts.length > 0) {
        const products: Product[] = firebaseProducts.map((fp: Producto) => ({
          id: fp.id || '',
          nombre: fp.nombre,
          descripcion: fp.descripcion,
          caracteristicas: fp.caracteristicas || fp.especificaciones || '',
          precio: fp.precio,
          sku: fp.sku || fp.codigo || '',
          codigo: fp.codigo || fp.sku || '',
          imagenes: fp.imagenes || [],
          imagen: fp.imagenes?.[0] || '',
          oferta: fp.oferta,
          precioOferta: fp.precioOferta,
          categoria: fp.categoriaId || '',
          categoriaId: fp.categoriaId || '',
          cantidad: fp.cantidad || 0,
          idCategoria: fp.categoriaId || '',
          createdAt: fp.createdAt
        }));
        this.productsSubject.next(products);
      } else {
        // Si no hay productos, emitir array vacío
        this.productsSubject.next([]);
      }
    });
  }

  getProducts(): Product[] {
    return this.productsSubject.value;
  }

  getProductsObservable(): Observable<Product[]> {
    return this.products$;
  }

  getCategorias(): Observable<any[]> {
    return this.firebaseService.getCategorias();
  }

  // Obtener últimos 8 productos ordenados por fecha de creación (más recientes primero)
  getLatestProducts(): Observable<Product[]> {
    return this.products$.pipe(
      map(products => {
        return products
          .filter(p => p.createdAt) // Solo productos con fecha de creación
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) // Ordenar de más reciente a más viejo
          .slice(0, 8); // Tomar solo los últimos 8
      })
    );
  }

}
