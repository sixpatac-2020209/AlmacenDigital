import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Observable, BehaviorSubject } from 'rxjs';
import { FirebaseService, Producto } from './firebase.service';

export interface Product {
  id: string | number;
  nombre: string;
  descripcion: string;
  precio: number;
  imagen?: string;
  imagenes?: string[];
  oferta?: number | boolean;
  cantidad?: number;
  categoria?: string;
  precioOferta?: number;
  idCategoria?: number;
  createdAt?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private URL = 'https://docs.google.com/spreadsheets/d/1SdVsKRC4nmpKQdDbcVqmGu-6Sa_XMHWFVBrlKAk2QJo/gviz/tq?tqx=out:json&sheet=';
  private productsSubject = new BehaviorSubject<Product[]>([]);
  public products$ = this.productsSubject.asObservable();

  constructor(
    private http: HttpClient,
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
          precio: fp.precio,
          imagenes: fp.imagenes || [],
          imagen: fp.imagenes?.[0] || '',
          oferta: fp.oferta,
          precioOferta: fp.precioOferta,
          categoria: fp.categoriaId, // assuming categoriaId is the id
          cantidad: fp.cantidad || 0,
          idCategoria: fp.categoriaId ? +fp.categoriaId : 0,
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
