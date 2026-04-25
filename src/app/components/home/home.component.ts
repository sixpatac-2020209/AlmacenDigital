import { Component, OnInit } from '@angular/core';
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

  constructor(
    private ofertasService: OfertasService,
    private productService: ProductService,
    private router: Router,
    private cartService: CartService
  ) {}

  ngOnInit(): void {
    this.loadOfertasActivas();
    this.loadProductosRecientes();
  }

  loadOfertasActivas(): void {
    this.ofertasService.getOfertasActivas().subscribe((ofertas) => {
      this.ofertas = ofertas;
    });
  }

  loadProductosRecientes(): void {
    this.productService.getLatestProducts().subscribe((productos) => {
      this.productosRecientes = productos;
    });
  }

  goToShopWithRecent(): void {
    this.router.navigate(['/shop'], { queryParams: { sortByRecent: 'true' } });
  }

  addToCart(product: Product): void {
    this.cartService.addProduct(product);
  }
}