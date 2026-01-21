import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

export interface EmptyStateAction {
  label: string;
  icon?: string;
  primary?: boolean;
}

@Component({
  selector: 'lg-empty-state',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  template: `
    <div class="flex flex-col items-center justify-center py-16 px-4">
      <!-- Icon -->
      @if (icon) {
        <div class="w-24 h-24 mb-6 text-gray-300">
          <mat-icon class="!w-full !h-full !text-[96px]">{{ icon }}</mat-icon>
        </div>
      }

      <!-- Heading -->
      <h2 class="text-2xl font-heading font-semibold text-gray-900 mb-3 text-center">
        {{ heading }}
      </h2>

      <!-- Description -->
      @if (description) {
        <p class="text-base text-gray-600 text-center max-w-md mb-6">
          {{ description }}
        </p>
      }

      <!-- Primary Action -->
      @if (primaryAction) {
        <button
          mat-raised-button
          color="primary"
          class="!px-8 !py-3"
          (click)="onPrimaryAction()"
        >
          @if (primaryAction.icon) {
            <mat-icon class="mr-2">{{ primaryAction.icon }}</mat-icon>
          }
          {{ primaryAction.label }}
        </button>
      }

      <!-- Secondary Info Cards (Optional) -->
      @if (showInfoCards) {
        <div class="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
          <div class="text-center p-4">
            <mat-icon class="text-primary mb-2">inventory_2</mat-icon>
            <p class="text-sm text-gray-700 font-medium">Organize Cards</p>
            <p class="text-xs text-gray-500">Group by theme or strategy</p>
          </div>
          <div class="text-center p-4">
            <mat-icon class="text-primary mb-2">insights</mat-icon>
            <p class="text-sm text-gray-700 font-medium">Track Value</p>
            <p class="text-xs text-gray-500">Monitor market worth</p>
          </div>
          <div class="text-center p-4">
            <mat-icon class="text-primary mb-2">stars</mat-icon>
            <p class="text-sm text-gray-700 font-medium">Showcase Rares</p>
            <p class="text-xs text-gray-500">Highlight your best cards</p>
          </div>
        </div>
      }
    </div>
  `,
  styles: []
})
export class EmptyStateComponent {
  @Input() icon = 'collections_bookmark';
  @Input() heading = 'No items found';
  @Input() description?: string;
  @Input() primaryAction?: EmptyStateAction;
  @Input() showInfoCards = false;

  @Output() primaryActionClick = new EventEmitter<void>();

  onPrimaryAction(): void {
    this.primaryActionClick.emit();
  }
}
