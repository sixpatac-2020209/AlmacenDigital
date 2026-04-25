import { Component, OnInit } from '@angular/core';
import { ProductService } from '../../services/product.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CartService } from '../../services/cart.service';
import Swal from 'sweetalert2';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FirebaseService } from '../../services/firebase.service';

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './shop.component.html',
  styles: []
})
export class ShopComponent implements OnInit {

  products: any[] = [];
  productosFiltrados: any[] = [];

  categorias: any[] = [];
  categoriaSeleccionada: number | null = null;

  precioMin: number = 0;
  precioMax: number = 999999;

  busqueda: string = '';
  loading: boolean = true;

  constructor(
    private productService: ProductService,
    private cartService: CartService,
    private router: Router,
    private route: ActivatedRoute,
    private firebaseService: FirebaseService
  ) { }

  ngOnInit() {
    this.loading = true;

    this.productService.getProductsObservable().subscribe((data: any) => {
      // Verificar si se debe ordenar por reciente
      this.route.queryParams.subscribe(params => {
        if (params['sortByRecent'] === 'true') {
          // Ordenar de más reciente a más viejo
          this.products = data
            .filter((p: any) => p.createdAt)
            .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
        } else {
          this.products = data;
        }
      });
      
      this.productosFiltrados = this.products;
      this.loading = false;
      this.checkQueryParams();
    });

    this.productService.getCategorias().subscribe(data => {
      this.categorias = data;
    });
  }

  checkQueryParams() {
    this.route.queryParams.subscribe(params => {
      const categoriaId = params['categoria'];
      const searchQuery = params['q'];

      this.categoriaSeleccionada = categoriaId ? +categoriaId : null;
      this.busqueda = searchQuery ? searchQuery : '';

      this.filtrarProductos();
    });
  }

  filtrarProductos() {
    const termino = this.busqueda ? this.busqueda.trim().toLowerCase() : '';

    this.productosFiltrados = this.products.filter(p => {

      const cumpleCategoria =
        !this.categoriaSeleccionada ||
        p.idCategoria == this.categoriaSeleccionada;

      const cumplePrecio =
        p.precio >= this.precioMin &&
        p.precio <= this.precioMax;

      const cumpleBusqueda =
        !termino ||
        p.nombre?.toLowerCase().includes(termino) ||
        p.descripcion?.toLowerCase().includes(termino);

      return cumpleCategoria && cumplePrecio && cumpleBusqueda;
    });
  }

  addToCart(product: any) {
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

  limpiarFiltros() {
    this.categoriaSeleccionada = null;
    this.precioMin = 0;
    this.precioMax = 999999;
    this.productosFiltrados = this.products;
  }
}