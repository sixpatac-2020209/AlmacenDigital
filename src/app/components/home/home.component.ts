import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { OfertasService } from '../../services/ofertas.service';
import { Oferta } from '../../data/ofertas.model';
import { ProductService } from '../../services/product.service';
import { Product } from '../../services/product.service';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  ofertas: Oferta[] = [];
  productosRecientes: Product[] = [];
  recentSlide = 0;
  recentVisibleCount = 4;

  constructor(
    private ofertasService: OfertasService,
    private productService: ProductService,
    private router: Router,
    private cartService: CartService
  ) {}

  ngOnInit(): void {
    this.updateRecentVisibleCount();
    this.loadOfertasActivas();
    this.loadProductosRecientes();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateRecentVisibleCount();
  }

  get recentPages(): Product[][] {
    const items: Product[][] = [];
    for (let i = 0; i < this.productosRecientes.length; i += this.recentVisibleCount) {
      items.push(this.productosRecientes.slice(i, i + this.recentVisibleCount));
    }
    return items;
  }

  get hasRecentCarouselControls(): boolean {
    return this.recentPages.length > 1;
  }

  prevRecentSlide(): void {
    this.recentSlide = Math.max(0, this.recentSlide - 1);
  }

  nextRecentSlide(): void {
    this.recentSlide = Math.min(this.recentPages.length - 1, this.recentSlide + 1);
  }

  goToRecentSlide(index: number): void {
    this.recentSlide = Math.max(0, Math.min(this.recentPages.length - 1, index));
  }

  private updateRecentVisibleCount(): void {
    const width = window.innerWidth;
    if (width < 576) {
      this.recentVisibleCount = 1;
    } else if (width < 992) {
      this.recentVisibleCount = 2;
    } else if (width < 1200) {
      this.recentVisibleCount = 3;
    } else {
      this.recentVisibleCount = 4;
    }
    this.recentSlide = Math.min(this.recentSlide, Math.max(this.recentPages.length - 1, 0));
  }

  loadOfertasActivas(): void {
    this.ofertasService.getOfertasActivas().subscribe((ofertas) => {
      this.ofertas = ofertas;
    });
  }

  loadProductosRecientes(): void {
    this.productService.getLatestProducts().subscribe((productos) => {
      this.productosRecientes = productos;
      this.recentSlide = 0;
    });
  }

  goToShopWithRecent(): void {
    this.router.navigate(['/shop'], { queryParams: { sortByRecent: 'true' } });
  }

  addToCart(product: Product): void {
    this.cartService.addProduct(product);
  }
}