import { Component, OnInit } from '@angular/core';
import { ProductService, Product } from '../../services/product.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CartService } from '../../services/cart.service';
import Swal from 'sweetalert2';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { Categoria } from '../../services/firebase.service';
import { combineLatest } from 'rxjs';

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './shop.component.html',
  styleUrls: ['./shop.component.css']
})
export class ShopComponent implements OnInit {
  products: Product[] = [];
  productosFiltrados: Product[] = [];
  categorias: Categoria[] = [];

  categoriaSeleccionada: string = '';
  precioMin: number = 0;
  precioMax: number = 0;
  precioMaxDisponible: number = 0;

  busqueda: string = '';
  sortBy: 'recent' | 'priceAsc' | 'priceDesc' | 'nameAsc' = 'recent';
  soloOfertas = false;
  soloDisponibles = false;
  loading: boolean = true;

  constructor(
    private productService: ProductService,
    private cartService: CartService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    this.loading = true;

    combineLatest([
      this.productService.getProductsObservable(),
      this.route.queryParams
    ]).subscribe(([data, params]) => {
      this.products = data || [];
      this.setFiltersFromQueryParams(params as Record<string, string>);
      this.syncPriceRangeWithProducts();
      this.filtrarProductos();
      this.loading = false;
    });

    this.productService.getCategorias().subscribe(data => {
      this.categorias = [...(data || [])].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));
    });
  }

  private setFiltersFromQueryParams(params: Record<string, string>): void {
    const categoriaId = params['categoria'];
    const searchQuery = params['q'];

    this.categoriaSeleccionada = categoriaId ? String(categoriaId) : '';
    this.busqueda = searchQuery ? String(searchQuery) : '';
    if (params['sortByRecent'] === 'true') {
      this.sortBy = 'recent';
    }
  }

  private syncPriceRangeWithProducts(): void {
    const precios = this.products
      .map((p) => Number(p.precio) || 0)
      .filter((precio) => precio >= 0);

    const maxDetectado = precios.length > 0 ? Math.ceil(Math.max(...precios)) : 0;
    this.precioMaxDisponible = maxDetectado;

    if (this.precioMax === 0 || this.precioMax > maxDetectado || this.precioMax === 999999) {
      this.precioMax = maxDetectado;
    }

    if (this.precioMin > this.precioMax) {
      this.precioMin = this.precioMax;
    }
  }

  private normalizeText(value?: string): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private precioVisual(product: Product): number {
    const tieneOferta = (product.oferta === 1 || product.oferta === true)
      && !!product.precioOferta
      && Number(product.precioOferta) < Number(product.precio);
    return tieneOferta ? Number(product.precioOferta) : Number(product.precio);
  }

  filtrarProductos(): void {
    const termino = this.normalizeText(this.busqueda);

    const filtrados = this.products.filter(p => {
      const categoriaProducto = String(p.categoriaId || p.categoria || p.idCategoria || '');
      const nombre = this.normalizeText(p.nombre);
      const descripcion = this.normalizeText(p.descripcion);
      const sku = this.normalizeText(p.sku || p.codigo || '');
      const precio = Number(p.precio) || 0;
      const cantidad = Number(p.cantidad) || 0;
      const tieneOferta = (p.oferta === 1 || p.oferta === true)
        && !!p.precioOferta
        && Number(p.precioOferta) < Number(p.precio);

      const cumpleCategoria = !this.categoriaSeleccionada || categoriaProducto === this.categoriaSeleccionada;
      const cumplePrecio = precio >= this.precioMin && precio <= this.precioMax;
      const cumpleBusqueda =
        !termino ||
        nombre.includes(termino) ||
        descripcion.includes(termino) ||
        sku.includes(termino);
      const cumpleOferta = !this.soloOfertas || tieneOferta;
      const cumpleStock = !this.soloDisponibles || cantidad > 0;

      return cumpleCategoria && cumplePrecio && cumpleBusqueda && cumpleOferta && cumpleStock;
    });

    this.productosFiltrados = this.ordenarProductos(filtrados);
  }

  private ordenarProductos(items: Product[]): Product[] {
    const list = [...items];
    list.sort((a, b) => {
      if (this.sortBy === 'priceAsc') {
        return this.precioVisual(a) - this.precioVisual(b);
      }

      if (this.sortBy === 'priceDesc') {
        return this.precioVisual(b) - this.precioVisual(a);
      }

      if (this.sortBy === 'nameAsc') {
        return (a.nombre || '').localeCompare((b.nombre || ''), 'es', { sensitivity: 'base' });
      }

      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    return list;
  }

  aplicarBusqueda(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: this.busqueda.trim() || null },
      queryParamsHandling: 'merge'
    });
    this.filtrarProductos();
  }

  onCategoriaChange(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { categoria: this.categoriaSeleccionada || null },
      queryParamsHandling: 'merge'
    });
    this.filtrarProductos();
  }

  onSortChange(): void {
    this.filtrarProductos();
  }

  clearBusqueda(): void {
    this.busqueda = '';
    this.aplicarBusqueda();
  }

  addToCart(product: Product): void {
    this.cartService.addProduct(product);
    Swal.fire({
      title: '¡Producto agregado al carrito!',
      text: '¿Deseas continuar comprando o ir al carrito para pagar?',
      icon: 'success',
      confirmButtonText: 'Seguir comprando',
      denyButtonText: 'Ver carrito',
      showDenyButton: true,
      showCancelButton: true,
      cancelButtonText: 'Ir a pagar',
      customClass: {
        popup: 'swal2-border-radius'
      }
    }).then((result) => {
      if (result.isDenied) {
        this.router.navigate(['/cart']);
      } else if (result.isDismissed) {
        this.router.navigate(['/checkout']);
      }
    });
  }

  limpiarFiltros(): void {
    this.categoriaSeleccionada = '';
    this.precioMin = 0;
    this.precioMax = this.precioMaxDisponible;
    this.busqueda = '';
    this.soloOfertas = false;
    this.soloDisponibles = false;
    this.sortBy = 'recent';

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: null, categoria: null, sortByRecent: null },
      queryParamsHandling: 'merge'
    });

    this.filtrarProductos();
  }
}