import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardCondition } from '@la-grieta/shared';

@Component({
  selector: 'app-condition-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      [class]="badgeClasses"
      [attr.aria-label]="'Card condition: ' + getConditionLabel()"
      role="status"
    >
      {{ getConditionLabel() }}
    </span>
  `,
  styles: [`
    :host {
      display: inline-block;
    }
  `]
})
export class ConditionBadgeComponent {
  @Input() condition!: string;
  @Input() size: 'sm' | 'md' | 'lg' = 'md';

  get badgeClasses(): string {
    const baseClasses = 'inline-flex items-center justify-center font-semibold rounded-full uppercase';
    const sizeClasses = this.getSizeClasses();
    const colorClasses = this.getConditionClasses();

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

  private getConditionClasses(): string {
    switch (this.condition) {
      case CardCondition.MINT:
        return 'bg-emerald-500 text-white';
      case CardCondition.NEAR_MINT:
        return 'bg-green-500 text-white';
      case CardCondition.EXCELLENT:
        return 'bg-blue-500 text-white';
      case CardCondition.GOOD:
        return 'bg-yellow-500 text-white';
      case CardCondition.PLAYED:
        return 'bg-orange-500 text-white';
      case CardCondition.POOR:
        return 'bg-red-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  }

  getConditionLabel(): string {
    switch (this.condition) {
      case CardCondition.MINT:
        return 'Mint';
      case CardCondition.NEAR_MINT:
        return 'Near Mint';
      case CardCondition.EXCELLENT:
        return 'Excellent';
      case CardCondition.GOOD:
        return 'Good';
      case CardCondition.PLAYED:
        return 'Played';
      case CardCondition.POOR:
        return 'Poor';
      default:
        return 'Unknown';
    }
  }
}
