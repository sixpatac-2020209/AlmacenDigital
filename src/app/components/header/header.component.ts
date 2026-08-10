import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { RouterModule } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { CartService } from '../../services/cart.service';
import { ProductService } from '../../services/product.service';
import { FirebaseService } from '../../services/firebase.service';
import { FavoritesService } from '../../services/favorites.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterModule, CommonModule, FormsModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit {
  isHomePage: boolean = false;
  darkMode: boolean = false;
  totalItems$: Observable<number>;
  totalFavorites$: Observable<number>;
  currentRoute: string = '';
  categorias: any[] = [];
  searchTerm: string = '';
  showAdminLogin: boolean = true;

  constructor(
    private router: Router,
    private cartService: CartService,
    private productService: ProductService,
    private firebaseService: FirebaseService,
    private favoritesService: FavoritesService
  ) {
    this.totalItems$ = this.cartService.totalItems$;
    this.totalFavorites$ = this.favoritesService.totalFavorites$;
  }

  ngOnInit() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(event => event as NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.isHomePage = event.url === '/';
      this.currentRoute = event.url;
    });

    // Check initial route
    this.isHomePage = this.router.url === '/';
    this.currentRoute = this.router.url;

    // Check dark mode
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode === 'true') {
      this.darkMode = true;
      document.body.classList.add('dark-mode');
    }

    this.loadCategorias();
  }

  loadCategorias() {
    this.firebaseService.getCategorias().subscribe(data => {
      this.categorias = data;
    });
  }

  selectCategoria(categoriaId: string | null) {
    this.router.navigate(['/shop'], { queryParams: categoriaId ? { categoria: categoriaId } : {} });
  }

  searchProductos() {
    const queryParams: any = {};
    const trimmedTerm = this.searchTerm.trim();

    if (trimmedTerm.length > 0) {
      queryParams.q = trimmedTerm;
    } else {
      queryParams.q = null;
    }

    this.router.navigate(['/shop'], {
      queryParams,
      queryParamsHandling: 'merge'
    });
  }

  toggleDarkMode() {
    this.darkMode = !this.darkMode;
    document.body.classList.toggle('dark-mode', this.darkMode);
    localStorage.setItem('darkMode', this.darkMode.toString());
  }

}