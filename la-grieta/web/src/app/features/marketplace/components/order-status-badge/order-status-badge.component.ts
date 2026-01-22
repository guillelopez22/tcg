import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderStatus } from '@la-grieta/shared';

@Component({
  selector: 'lg-order-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      [class]="badgeClasses"
      [attr.aria-label]="'Order status: ' + getStatusLabel()"
      role="status"
    >
      {{ getStatusLabel() }}
    </span>
  `,
  styles: [`
    :host {
      display: inline-block;
    }
  `]
})
export class OrderStatusBadgeComponent {
  @Input() status!: string;
  @Input() size: 'sm' | 'md' | 'lg' = 'md';

  get badgeClasses(): string {
    const baseClasses = 'inline-flex items-center justify-center font-semibold rounded-full uppercase';
    const sizeClasses = this.getSizeClasses();
    const colorClasses = this.getStatusClasses();

    return `${baseClasses} ${sizeClasses} ${colorClasses}`;
  }

  private getSizeClasses(): string {
    switch (this.size) {
      case 'sm':
        return 'px-2 py-0.5 text-xs';
      case 'lg':
        return 'px-4 py-2 text-base';
      case 'md':
      default:
        return 'px-3 py-1 text-sm';
    }
  }

  private getStatusClasses(): string {
    switch (this.status) {
      case OrderStatus.PENDING_PAYMENT:
        return 'bg-yellow-500 text-white';
      case OrderStatus.PAYMENT_HELD:
        return 'bg-blue-500 text-white';
      case OrderStatus.SHIPPED:
        return 'bg-purple-500 text-white';
      case OrderStatus.DELIVERED:
        return 'bg-green-500 text-white';
      case OrderStatus.COMPLETED:
        return 'bg-emerald-600 text-white';
      case OrderStatus.CANCELLED:
        return 'bg-red-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  }

  getStatusLabel(): string {
    switch (this.status) {
      case OrderStatus.PENDING_PAYMENT:
        return 'Pending Payment';
      case OrderStatus.PAYMENT_HELD:
        return 'Payment Held';
      case OrderStatus.SHIPPED:
        return 'Shipped';
      case OrderStatus.DELIVERED:
        return 'Delivered';
      case OrderStatus.COMPLETED:
        return 'Completed';
      case OrderStatus.CANCELLED:
        return 'Cancelled';
      default:
        return 'Unknown';
    }
  }
}
