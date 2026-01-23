import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule],
  template: `
    <div class="flex items-center justify-center" [style.padding]="padding">
      <mat-spinner [diameter]="diameter"></mat-spinner>
      @if (message) {
        <p class="ml-4 text-gray-600">{{ message }}</p>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class LoadingSpinnerComponent {
  @Input() diameter = 50;
  @Input() message = '';
  @Input() padding = '2rem';
}
