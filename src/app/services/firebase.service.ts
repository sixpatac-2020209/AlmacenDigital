import { Injectable, inject } from '@angular/core';
import { Database, ref, push, set, get, update, remove, child } from '@angular/fire/database';
import { Storage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from '@angular/fire/storage';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Producto {
  id?: string;
  nombre: string;
  descripcion: string;
  precio: number;
  precioOferta?: number;
  oferta: number; // 1 o 0
  categoriaId?: string;
  imagenes?: string[];
  cantidad: number; // Stock disponible
  createdAt?: number;
}

export interface Categoria {
  id?: string;
  nombre: string;
  createdAt?: number;
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private db = inject(Database);
  private storage = inject(Storage);
  private productosSubject = new BehaviorSubject<Producto[]>([]);
  public productos$ = this.productosSubject.asObservable();
  private categoriasSubject = new BehaviorSubject<Categoria[]>([]);
  public categorias$ = this.categoriasSubject.asObservable();

  constructor() {
    this.loadProductos();
    this.loadCategorias();
  }

  // Cargar productos de Firebase
  loadProductos(): void {
    const dbRef = ref(this.db, 'productos');
    get(dbRef).then((snapshot: any) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const productos: Producto[] = Object.keys(data).map(key => ({
          ...data[key],
          id: key
        }));
        this.productosSubject.next(productos);
      } else {
        this.productosSubject.next([]);
      }
    }).catch((error: any) => {
      console.error('Error loading productos:', error);
      this.productosSubject.next([]);
    });
  }

  // Cargar categorías de Firebase
  loadCategorias(): void {
    const dbRef = ref(this.db, 'categorias');
    get(dbRef).then((snapshot: any) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const categorias: Categoria[] = Object.keys(data).map(key => ({
          ...data[key],
          id: key
        }));
        this.categoriasSubject.next(categorias);
      } else {
        this.categoriasSubject.next([]);
      }
    }).catch((error: any) => {
      console.error('Error loading categorias:', error);
      this.categoriasSubject.next([]);
    });
  }

  // Obtener productos como Observable
  getProductos(): Observable<Producto[]> {
    return this.productos$;
  }

  // Obtener todos los productos (sincrónico)
  getAllProductos(): Producto[] {
    return this.productosSubject.value;
  }

  // Crear producto
  crearProducto(producto: Producto): Promise<string> {
    const dbRef = ref(this.db, 'productos');
    const newRef = push(dbRef);
    const productId = newRef.key;

    return set(newRef, {
      ...producto,
      createdAt: Date.now()
    }).then(() => {
      this.loadProductos();
      return productId || '';
    });
  }

  // Actualizar producto
  actualizarProducto(id: string, producto: Partial<Producto>): Promise<void> {
    const dbRef = ref(this.db, `productos/${id}`);
    return update(dbRef, producto).then(() => {
      this.loadProductos();
    });
  }

  // Eliminar producto
  eliminarProducto(id: string): Promise<void> {
    const dbRef = ref(this.db, `productos/${id}`);

    return get(dbRef).then((snapshot: any) => {
      const producto = snapshot.exists() ? snapshot.val() : null;
      const imagenes: string[] = producto?.imagenes || [];

      return this.eliminarImagenesProducto(imagenes).then(() => {
        return remove(dbRef);
      });
    }).then(() => {
      this.loadProductos();
    });
  }

  private eliminarImagenesProducto(imagenes: string[]): Promise<void> {
    if (!imagenes || imagenes.length === 0) {
      return Promise.resolve();
    }

    const deletePromises = imagenes.map((url) => {
      try {
        const storagePath = this.extraerRutaStorageDesdeUrl(url);
        if (!storagePath) {
          return Promise.resolve();
        }
        const imageRef = storageRef(this.storage, storagePath);
        return deleteObject(imageRef);
      } catch (error) {
        return Promise.resolve();
      }
    });

    return Promise.allSettled(deletePromises).then(() => undefined);
  }

  private extraerRutaStorageDesdeUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathMatch = urlObj.pathname.match(/\/o\/(.+)$/);
      if (!pathMatch || !pathMatch[1]) {
        return null;
      }
      const encodedPath = pathMatch[1].split('?')[0];
      return decodeURIComponent(encodedPath);
    } catch (error) {
      return null;
    }
  }

  // Subir imagen a Firebase Storage
  subirImagen(file: File, productId: string): Promise<string> {
    const path = `productos/${productId}/${Date.now()}_${file.name}`;
    const fileRef = storageRef(this.storage, path);
    
    return uploadBytes(fileRef, file).then((snapshot: any) => {
      return getDownloadURL(snapshot.ref);
    });
  }

  // Subir múltiples imágenes
  subirMultiplesImagenes(files: File[], productId: string): Promise<string[]> {
    const promises = files.map(file => this.subirImagen(file, productId));
    return Promise.all(promises);
  }

  // Obtener categorías como Observable
  getCategorias(): Observable<Categoria[]> {
    return this.categorias$;
  }

  // Obtener todas las categorías (sincrónico)
  getAllCategorias(): Categoria[] {
    return this.categoriasSubject.value;
  }

  // Crear categoría
  crearCategoria(categoria: Categoria): Promise<string> {
    const dbRef = ref(this.db, 'categorias');
    const newRef = push(dbRef);
    const categoriaId = newRef.key;

    return set(newRef, {
      ...categoria,
      createdAt: Date.now()
    }).then(() => {
      this.loadCategorias();
      return categoriaId || '';
    });
  }

  // Actualizar categoría
  actualizarCategoria(id: string, categoria: Partial<Categoria>): Promise<void> {
    const dbRef = ref(this.db, `categorias/${id}`);
    return update(dbRef, categoria).then(() => {
      this.loadCategorias();
    });
  }

  // Eliminar categoría
  eliminarCategoria(id: string): Promise<void> {
    const dbRef = ref(this.db, `categorias/${id}`);
    return remove(dbRef).then(() => {
      this.loadCategorias();
    });
  }
}
