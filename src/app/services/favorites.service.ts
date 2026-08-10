import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FavoritesService {
  private readonly storageKey = 'favoriteProductIds';
  private readonly favorites = new Set<string>();
  private readonly totalFavoritesSubject = new BehaviorSubject<number>(0);

  totalFavorites$ = this.totalFavoritesSubject.asObservable();

  constructor() {
    this.loadFromStorage();
    this.emitTotal();
  }

  isFavorite(productId: string | number | null | undefined): boolean {
    const normalized = this.normalizeId(productId);
    return normalized ? this.favorites.has(normalized) : false;
  }

  toggleFavorite(productId: string | number | null | undefined): boolean {
    const normalized = this.normalizeId(productId);
    if (!normalized) {
      return false;
    }

    if (this.favorites.has(normalized)) {
      this.favorites.delete(normalized);
    } else {
      this.favorites.add(normalized);
    }

    this.persist();
    this.emitTotal();
    return this.favorites.has(normalized);
  }

  private normalizeId(productId: string | number | null | undefined): string {
    if (productId === null || productId === undefined) return '';
    return String(productId).trim();
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        parsed.forEach((id) => {
          const normalized = this.normalizeId(id);
          if (normalized) {
            this.favorites.add(normalized);
          }
        });
      }
    } catch {
      // Ignore malformed localStorage payload and continue with empty favorites.
    }
  }

  private persist(): void {
    localStorage.setItem(this.storageKey, JSON.stringify(Array.from(this.favorites)));
  }

  private emitTotal(): void {
    this.totalFavoritesSubject.next(this.favorites.size);
  }
}
