import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { CollectionItem } from '@la-grieta/shared';
import { ConditionBadgeComponent } from '../condition-badge/condition-badge.component';

@Component({
  selector: 'app-collection-item-card',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    ConditionBadgeComponent
  ],
  template: `
    <mat-card class="h-full hover:shadow-lg transition-shadow duration-200">
      <mat-card-content class="!p-4">
        <!-- Card Image -->
        <div class="relative mb-3">
          @if (item.card && item.card.imageUrl) {
            <img
              [src]="item.card!.imageUrl"
              [alt]="item.card!.name"
              class="w-full h-auto rounded-md shadow-sm"
              loading="lazy"
            />
          } @else {
            <div class="w-full aspect-[2/3] bg-gray-200 rounded-md flex items-center justify-center">
              <mat-icon class="!text-[4rem] text-gray-400">image_not_supported</mat-icon>
            </div>
          }

          <!-- Quantity Badge -->
          <div class="absolute top-2 right-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded-full text-xs font-bold">
            × {{ item.quantity }}
          </div>
        </div>

        <!-- Card Name -->
        <h4 class="text-base font-card font-bold text-gray-900 mb-2 truncate">
          {{ item.card?.name || 'Unknown Card' }}
        </h4>

        <!-- Condition Badge -->
        <div class="mb-3">
          <app-condition-badge [condition]="item.condition" size="sm" />
        </div>

        <!-- Card Details -->
        <div class="text-xs text-gray-600 space-y-1 mb-3">
          @if (item.card && item.card.cardType) {
            <div class="flex items-center gap-1">
              <mat-icon class="!text-sm">category</mat-icon>
              <span class="capitalize">{{ item.card!.cardType!.toLowerCase() }}</span>
            </div>
          }
          @if (item.card && item.card.rarity) {
            <div class="flex items-center gap-1">
              <mat-icon class="!text-sm">stars</mat-icon>
              <span class="capitalize">{{ item.card!.rarity!.toLowerCase() }}</span>
            </div>
          }
          @if (item.card && item.card.marketPrice !== undefined && item.card.marketPrice !== null) {
            <div class="flex items-center gap-1">
              <mat-icon class="!text-sm">attach_money</mat-icon>
              <span class="font-mono font-semibold">{{ formatPrice(item.card!.marketPrice!) }}</span>
              <span class="text-gray-500">each</span>
            </div>
          }
        </div>

        <!-- Total Value -->
        @if (item.card && item.card.marketPrice !== undefined && item.card.marketPrice !== null) {
          <div class="border-t pt-2 mb-3">
            <div class="flex justify-between items-center">
              <span class="text-xs text-gray-600">Total Value:</span>
              <span class="text-sm font-mono font-bold text-accent">
                {{ formatPrice(item.card!.marketPrice! * item.quantity) }}
              </span>
            </div>
          </div>
        }

        <!-- Actions -->
        <div class="flex gap-2">
          <button
            mat-icon-button
            class="flex-1"
            (click)="onUpdateQuantity()"
            [attr.aria-label]="'Update quantity for ' + item.card?.name"
          >
            <mat-icon>edit</mat-icon>
          </button>
          <button
            mat-icon-button
            class="flex-1"
            (click)="onRemove()"
            [attr.aria-label]="'Remove ' + item.card?.name + ' from collection'"
          >
            <mat-icon class="text-red-600">delete</mat-icon>
          </button>
          <button
            mat-icon-button
            [matMenuTriggerFor]="menu"
            class="flex-1"
            aria-label="More options"
          >
            <mat-icon>more_vert</mat-icon>
          </button>
        </div>
      </mat-card-content>
    </mat-card>

    <!-- Context Menu -->
    <mat-menu #menu="matMenu">
      <button mat-menu-item [routerLink]="['/cards', item.cardId]">
        <mat-icon>visibility</mat-icon>
        <span>View Card Details</span>
      </button>
      <button mat-menu-item (click)="onIncrementQuantity()">
        <mat-icon>add</mat-icon>
        <span>Add One More</span>
      </button>
      <button mat-menu-item (click)="onDecrementQuantity()" [disabled]="item.quantity <= 1">
        <mat-icon>remove</mat-icon>
        <span>Remove One</span>
      </button>
      <button mat-menu-item (click)="onChangeCondition()">
        <mat-icon>grade</mat-icon>
        <span>Change Condition</span>
      </button>
    </mat-menu>
  `,
  styles: []
})
export class CollectionItemCardComponent {
  @Input() item!: CollectionItem;
  @Output() updateQuantity = new EventEmitter<CollectionItem>();
  @Output() remove = new EventEmitter<CollectionItem>();
  @Output() incrementQuantity = new EventEmitter<CollectionItem>();
  @Output() decrementQuantity = new EventEmitter<CollectionItem>();
  @Output() changeCondition = new EventEmitter<CollectionItem>();

  formatPrice(price: number | undefined): string {
    if (price === undefined || price === null) {
      return 'N/A';
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  }

  onUpdateQuantity(): void {
    this.updateQuantity.emit(this.item);
  }

  onRemove(): void {
    this.remove.emit(this.item);
  }

  onIncrementQuantity(): void {
    this.incrementQuantity.emit(this.item);
  }

  onDecrementQuantity(): void {
    this.decrementQuantity.emit(this.item);
  }

  onChangeCondition(): void {
    this.changeCondition.emit(this.item);
  }
}
