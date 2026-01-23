import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { CollectionWithCount } from '@la-grieta/shared';

@Component({
  selector: 'app-collection-card',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule
  ],
  template: `
    <mat-card
      class="h-full cursor-pointer hover:shadow-lg transition-shadow duration-200 relative"
      [routerLink]="['/collections', collection.id]"
    >
      <!-- Menu Button (absolute positioned) -->
      <button
        mat-icon-button
        class="!absolute top-2 right-2 z-10"
        [matMenuTriggerFor]="menu"
        (click)="$event.stopPropagation(); $event.preventDefault()"
        aria-label="Collection options"
      >
        <mat-icon>more_vert</mat-icon>
      </button>

      <mat-card-content class="!p-6">
        <!-- Collection Icon -->
        <div class="flex justify-center mb-4">
          <div class="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
            <mat-icon class="!text-[2rem] text-primary">collections_bookmark</mat-icon>
          </div>
        </div>

        <!-- Collection Name -->
        <h3 class="text-xl font-card font-bold text-gray-900 mb-2 text-center truncate">
          {{ collection.name }}
        </h3>

        <!-- Description -->
        @if (collection.description) {
          <p class="text-sm text-gray-600 text-center mb-4 line-clamp-2 min-h-[2.5rem]">
            {{ collection.description }}
          </p>
        } @else {
          <p class="text-sm text-gray-400 text-center mb-4 italic min-h-[2.5rem]">
            No description
          </p>
        }

        <!-- Stats -->
        <div class="border-t pt-4 flex justify-around">
          <div class="text-center">
            <p class="text-2xl font-mono font-bold text-primary">
              {{ collection.itemCount }}
            </p>
            <p class="text-xs text-gray-600">
              {{ collection.itemCount === 1 ? 'Card' : 'Cards' }}
            </p>
          </div>
          <div class="text-center">
            <mat-icon class="text-gray-400">calendar_today</mat-icon>
            <p class="text-xs text-gray-600 mt-1">
              {{ formatDate(collection.createdAt) }}
            </p>
          </div>
        </div>
      </mat-card-content>
    </mat-card>

    <!-- Context Menu -->
    <mat-menu #menu="matMenu">
      <button mat-menu-item (click)="onEdit()">
        <mat-icon>edit</mat-icon>
        <span>Edit</span>
      </button>
      <button mat-menu-item (click)="onDelete()" class="text-red-600">
        <mat-icon class="text-red-600">delete</mat-icon>
        <span>Delete</span>
      </button>
    </mat-menu>
  `,
  styles: []
})
export class CollectionCardComponent {
  @Input() collection!: CollectionWithCount;
  @Output() edit = new EventEmitter<CollectionWithCount>();
  @Output() delete = new EventEmitter<CollectionWithCount>();

  formatDate(date: Date): string {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  onEdit(): void {
    this.edit.emit(this.collection);
  }

  onDelete(): void {
    this.delete.emit(this.collection);
  }
}
