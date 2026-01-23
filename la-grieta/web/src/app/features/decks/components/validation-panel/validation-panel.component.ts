import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DeckValidationResult } from '@la-grieta/shared';

@Component({
  selector: 'app-validation-panel',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="rounded-lg border p-4"
         [class]="panelClasses">
      <!-- Header -->
      <div class="flex items-center gap-2 mb-3">
        <mat-icon [class]="iconClasses">{{ statusIcon }}</mat-icon>
        <h3 class="font-heading font-bold">{{ statusTitle }}</h3>
      </div>

      @if (validation) {
        @if (validation.isValid) {
          <p class="text-sm text-green-700">
            Your deck meets all Riftbound tournament requirements!
          </p>
        } @else {
          <div class="space-y-2">
            @for (error of validation.errors; track error.rule) {
              <div class="flex items-start gap-2 text-sm">
                <mat-icon class="!text-base text-red-500 mt-0.5">error</mat-icon>
                <div>
                  <p class="font-medium text-red-800">{{ error.message }}</p>
                  @if (error.details) {
                    <p class="text-red-600 text-xs mt-0.5">{{ formatDetails(error.details) }}</p>
                  }
                </div>
              </div>
            }
          </div>
        }
      } @else {
        <p class="text-sm text-gray-600">
          Add cards to your deck to see validation status
        </p>
      }
    </div>
  `,
  styles: []
})
export class ValidationPanelComponent {
  @Input() validation: DeckValidationResult | null = null;

  get panelClasses(): string {
    if (!this.validation) {
      return 'border-gray-200 bg-gray-50';
    }
    return this.validation.isValid
      ? 'border-green-200 bg-green-50'
      : 'border-red-200 bg-red-50';
  }

  get iconClasses(): string {
    if (!this.validation) {
      return 'text-gray-400';
    }
    return this.validation.isValid ? 'text-green-600' : 'text-red-600';
  }

  get statusIcon(): string {
    if (!this.validation) {
      return 'help_outline';
    }
    return this.validation.isValid ? 'check_circle' : 'warning';
  }

  get statusTitle(): string {
    if (!this.validation) {
      return 'Deck Validation';
    }
    return this.validation.isValid ? 'Deck Valid' : 'Deck Invalid';
  }

  formatDetails(details: any): string {
    if (typeof details === 'string') return details;
    if (typeof details === 'object') {
      return Object.entries(details)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
    }
    return String(details);
  }
}
