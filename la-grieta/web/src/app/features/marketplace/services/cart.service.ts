import { Injectable, signal, computed, effect } from '@angular/core';
import { Listing } from '@la-grieta/shared';

export interface CartItem {
  listing: Listing;
  addedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private readonly STORAGE_KEY = 'la_grieta_cart';

  // Angular Signals for cart state
  private cartItemsSignal = signal<CartItem[]>([]);
  private isOpenSignal = signal<boolean>(false);

  // Public readonly signals
  readonly cartItems = this.cartItemsSignal.asReadonly();
  readonly isOpen = this.isOpenSignal.asReadonly();

  // Computed values
  readonly itemCount = computed(() => this.cartItemsSignal().length);
  readonly hasItems = computed(() => this.cartItemsSignal().length > 0);
  readonly subtotal = computed(() => {
    return this.cartItemsSignal().reduce((sum, item) => {
      return sum + (item.listing.price || item.listing.buyNowPrice || 0);
    }, 0);
  });

  constructor() {
    // Load cart from localStorage on initialization
    this.loadCartFromStorage();

    // Persist cart to localStorage whenever it changes
    effect(() => {
      this.saveCartToStorage();
    });
  }

  /**
   * Add listing to cart
   */
  addToCart(listing: Listing): void {
    const existing = this.cartItemsSignal().find(item => item.listing.id === listing.id);

    if (existing) {
      // Already in cart, just open the sidebar
      this.openCart();
      return;
    }

    const newItem: CartItem = {
      listing,
      addedAt: new Date()
    };

    this.cartItemsSignal.update(items => [...items, newItem]);
    this.openCart();
  }

  /**
   * Remove listing from cart
   */
  removeFromCart(listingId: string): void {
    this.cartItemsSignal.update(items =>
      items.filter(item => item.listing.id !== listingId)
    );
  }

  /**
   * Clear entire cart
   */
  clearCart(): void {
    this.cartItemsSignal.set([]);
  }

  /**
   * Check if listing is in cart
   */
  isInCart(listingId: string): boolean {
    return this.cartItemsSignal().some(item => item.listing.id === listingId);
  }

  /**
   * Open cart sidebar
   */
  openCart(): void {
    this.isOpenSignal.set(true);
  }

  /**
   * Close cart sidebar
   */
  closeCart(): void {
    this.isOpenSignal.set(false);
  }

  /**
   * Toggle cart sidebar
   */
  toggleCart(): void {
    this.isOpenSignal.update(isOpen => !isOpen);
  }

  /**
   * Load cart from localStorage
   */
  private loadCartFromStorage(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const items = JSON.parse(stored) as CartItem[];
        // Convert date strings back to Date objects
        items.forEach(item => {
          item.addedAt = new Date(item.addedAt);
        });
        this.cartItemsSignal.set(items);
      }
    } catch (error) {
      console.error('Failed to load cart from storage:', error);
      this.cartItemsSignal.set([]);
    }
  }

  /**
   * Save cart to localStorage
   */
  private saveCartToStorage(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      const items = this.cartItemsSignal();
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error('Failed to save cart to storage:', error);
    }
  }
}
