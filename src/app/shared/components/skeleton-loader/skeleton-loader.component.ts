import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-skeleton-loader',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="skeleton-wrapper" [ngStyle]="{'width': width, 'height': height}">
      <div class="skeleton" [ngClass]="variant"></div>
    </div>
  `,
  styles: [`
    .skeleton-wrapper {
      overflow: hidden;
    }
    .skeleton {
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, var(--surface-muted, #E8ECF1) 25%, var(--surface-card, #fff) 50%, var(--surface-muted, #E8ECF1) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: var(--radius-md, 8px);
    }
    .skeleton.text {
      border-radius: var(--radius-sm, 4px);
      height: 14px;
      margin-bottom: 8px;
    }
    .skeleton.circle {
      border-radius: 50%;
    }
    .skeleton.button {
      border-radius: var(--radius-md, 8px);
      height: 36px;
      width: 120px;
    }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .skeleton { animation: none; opacity: 0.7; }
    }
  `]
})
export class SkeletonLoaderComponent {
  @Input() width = '100%';
  @Input() height = '20px';
  @Input() variant: 'text' | 'circle' | 'button' | '' = '';
}
