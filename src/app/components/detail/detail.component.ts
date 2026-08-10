import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductService, Product } from '../../services/product.service';
import { CartService } from '../../services/cart.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import Swal from 'sweetalert2';

interface Review {
  nombre: string;
  comentario: string;
  puntuacion: number;
  fecha: string;
}

@Component({
  selector: 'app-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './detail.component.html',
  styles: []
})
export class DetailComponent implements OnInit {

  product: Product | null = null;
  currentImageIndex: number = 0;
  relatedProducts: Product[] = [];
  reviews: Review[] = [];
  reviewerName: string = '';
  reviewText: string = '';
  reviewRating: number = 0;
  showReviews: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private productService: ProductService,
    private cartService: CartService,
    private router: Router
  ) { }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.productService.getProductsObservable().subscribe((products: Product[]) => {
        this.product = products.find((p: Product) => p.id === id) || null;
        // Obtener productos relacionados (misma categoría)
        if (this.product) {
          this.currentImageIndex = 0;
          const categoryId = this.product.categoriaId || this.product.idCategoria || '';
          this.relatedProducts = products
            .filter((p: Product) => (p.categoriaId || p.idCategoria || '') === categoryId && p.id !== this.product?.id)
            .slice(0, 4);
          this.reviews = (this.product as any).reviews || [];
        }
      });
    }
  }

  nextImage() {
    if (this.product && this.product.imagenes && this.product.imagenes.length > 0) {
      this.currentImageIndex = (this.currentImageIndex + 1) % this.product.imagenes.length;
    }
  }

  prevImage() {
    if (this.product && this.product.imagenes && this.product.imagenes.length > 0) {
      this.currentImageIndex = this.currentImageIndex > 0 ? this.currentImageIndex - 1 : this.product.imagenes.length - 1;
    }
  }

  get averageRating(): number {
    if (this.reviews.length === 0) {
      return 0;
    }
    const total = this.reviews.reduce((sum, review) => sum + review.puntuacion, 0);
    return total / this.reviews.length;
  }

  getStarIcon(star: number): string {
    if (this.averageRating >= star) {
      return 'fas fa-star';
    }
    if (this.averageRating >= star - 0.5) {
      return 'fas fa-star-half-alt';
    }
    return 'far fa-star';
  }

  submitReview() {
    if (!this.reviewerName.trim() || !this.reviewText.trim() || this.reviewRating <= 0) {
      return;
    }

    this.reviews.unshift({
      nombre: this.reviewerName.trim(),
      comentario: this.reviewText.trim(),
      puntuacion: this.reviewRating,
      fecha: new Date().toLocaleDateString()
    });

    this.reviewerName = '';
    this.reviewText = '';
    this.reviewRating = 0;
  }

  addToCart(product?: Product) {
    const itemProduct = product || this.product;
    if (!itemProduct) {
      return;
    }

    const cartItem = {
      id: typeof itemProduct.id === 'string' ? parseInt(itemProduct.id) : itemProduct.id || 0,
      nombre: itemProduct.nombre,
      precio: itemProduct.precio,
      precioOferta: itemProduct.precioOferta,
      oferta: itemProduct.oferta,
      imagen: itemProduct.imagen || itemProduct.imagenes?.[0] || '',
      cantidad: 1
    };

    this.cartService.addProduct(cartItem);
    Swal.fire({
      title: '¡Producto agregado al carrito!',
      text: '¿Quieres seguir comprando o avanzar al pago?',
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
}
