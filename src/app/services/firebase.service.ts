import { Injectable, inject } from '@angular/core';
import { Firestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, getDoc } from '@angular/fire/firestore';
import { Storage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from '@angular/fire/storage';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Producto {
  id?: string;
  sku?: string;
  codigo?: string;
  productoOriginal?: string;
  marca?: string;
  estado?: string;
  descripcionCatalogo?: string;
  caracteristicas?: string;
  especificaciones?: string;
  fuente?: string;
  urlFuente?: string;
  carpetaProducto?: string;
  imagenesDescargadas?: number;
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

export interface PedidoItem {
  id: string;
  nombre: string;
  precio: number;
  cantidad: number;
}

export interface Pedido {
  id?: string;
  facturacion: {
    nombre: string;
    apellido: string;
    email: string;
    telefono: string;
    direccion: string;
  };
  envio: {
    nombre: string;
    apellido: string;
    telefono: string;
    direccion: string;
  };
  items: PedidoItem[];
  subtotal: number;
  envioCosto: number;
  total: number;
  estado?: string;
  createdAt?: number;
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private firestore = inject(Firestore);
  private storage = inject(Storage);
  private productosSubject = new BehaviorSubject<Producto[]>([]);
  public productos$ = this.productosSubject.asObservable();
  private categoriasSubject = new BehaviorSubject<Categoria[]>([]);
  public categorias$ = this.categoriasSubject.asObservable();
  private pedidosSubject = new BehaviorSubject<Pedido[]>([]);
  public pedidos$ = this.pedidosSubject.asObservable();

  constructor() {
    this.loadProductos();
    this.loadCategorias();
    this.loadPedidos();
  }

  // Cargar productos de Firebase
  loadProductos(): void {
    const productosCol = collection(this.firestore, 'productos');
    getDocs(productosCol).then((snapshot) => {
      const productos: Producto[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Producto)
      }));
      this.productosSubject.next(productos);
    }).catch((error: any) => {
      console.error('Error loading productos:', error);
      this.productosSubject.next([]);
    });
  }

  // Cargar categorías de Firebase
  loadCategorias(): void {
    const categoriasCol = collection(this.firestore, 'categorias');
    getDocs(categoriasCol).then((snapshot) => {
      const categorias: Categoria[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Categoria)
      }));
      this.categoriasSubject.next(categorias);
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

  private normalizeKey(value?: string): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase()
      .trim();
  }

  // Buscar producto por SKU
  getProductoBySku(sku: string): Promise<Producto | null> {
    return getDocs(collection(this.firestore, 'productos')).then(snapshot => {
      const target = this.normalizeKey(sku);
      const doc = snapshot.docs.find(d => {
        const data = d.data() as Producto;
        return this.normalizeKey(data.sku) === target || this.normalizeKey(data.codigo) === target;
      });
      if (!doc) return null;
      return { id: doc.id, ...(doc.data() as Producto) };
    });
  }

  // Crear producto
  crearProducto(producto: Producto, skipReload = false): Promise<string> {
    const productosCol = collection(this.firestore, 'productos');
    // Eliminar campos undefined para que Firestore no los rechace
    const data = Object.fromEntries(
      Object.entries({ ...producto, createdAt: Date.now() })
        .filter(([, v]) => v !== undefined)
    );
    return addDoc(productosCol, data).then((docRef) => {
      if (!skipReload) this.loadProductos();
      return docRef.id;
    });
  }

  // Actualizar producto
  actualizarProducto(id: string, producto: Partial<Producto>): Promise<void> {
    const productoDoc = doc(this.firestore, `productos`, id);
    return updateDoc(productoDoc, producto as any).then(() => {
      this.loadProductos();
    });
  }

  // Eliminar producto
  eliminarProducto(id: string): Promise<void> {
    const productoDoc = doc(this.firestore, `productos`, id);
    return getDoc(productoDoc).then((snapshot: any) => {
      const productoData = snapshot.exists() ? snapshot.data() : null;
      const imagenes: string[] = productoData?.imagenes || [];

      return this.eliminarImagenesProducto(imagenes).then(() => {
        return deleteDoc(productoDoc);
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

  // Crear pedido en Firestore
  crearPedido(pedido: Pedido): Promise<string> {
    const pedidosCol = collection(this.firestore, 'pedidos');
    return addDoc(pedidosCol, {
      ...pedido,
      estado: pedido.estado || 'nuevo',
      createdAt: Date.now()
    }).then(docRef => {
      this.loadPedidos();
      return docRef.id;
    });
  }

  // Cargar pedidos de Firebase
  loadPedidos(): void {
    const pedidosCol = collection(this.firestore, 'pedidos');
    getDocs(pedidosCol).then((snapshot) => {
      const pedidos: Pedido[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Pedido)
      }));
      this.pedidosSubject.next(pedidos);
    }).catch((error: any) => {
      console.error('Error loading pedidos:', error);
      this.pedidosSubject.next([]);
    });
  }

  // Obtener pedidos como Observable
  getPedidos(): Observable<Pedido[]> {
    return this.pedidos$;
  }

  // Obtener todos los pedidos (sincrónico)
  getAllPedidos(): Pedido[] {
    return this.pedidosSubject.value;
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
    const categoriasCol = collection(this.firestore, 'categorias');
    return addDoc(categoriasCol, {
      ...categoria,
      createdAt: Date.now()
    }).then((docRef) => {
      this.loadCategorias();
      return docRef.id;
    });
  }

  // Obtener categorías desde Firestore una sola vez
  getCategoriasSnapshot(): Promise<Categoria[]> {
    const categoriasCol = collection(this.firestore, 'categorias');
    return getDocs(categoriasCol).then((snapshot) => {
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Categoria)
      }));
    });
  }

  // Asegurar que una categoría exista y devolver su ID
  asegurarCategoria(nombre: string): Promise<string> {
    const target = (nombre || '').trim().toLowerCase();
    return this.getCategoriasSnapshot().then((categorias) => {
      const existente = categorias.find(categoria => (categoria.nombre || '').trim().toLowerCase() === target);
      if (existente?.id) {
        return existente.id;
      }
      return this.crearCategoria({ nombre }).then((id) => id);
    });
  }

  // Actualizar categoría
  actualizarCategoria(id: string, categoria: Partial<Categoria>): Promise<void> {
    const categoriaDoc = doc(this.firestore, `categorias`, id);
    return updateDoc(categoriaDoc, categoria as any).then(() => {
      this.loadCategorias();
    });
  }

  // Eliminar categoría
  eliminarCategoria(id: string): Promise<void> {
    const categoriaDoc = doc(this.firestore, `categorias`, id);
    return deleteDoc(categoriaDoc).then(() => {
      this.loadCategorias();
    });
  }
}
