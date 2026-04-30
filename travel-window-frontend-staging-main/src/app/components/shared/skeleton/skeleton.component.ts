import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="animate-pulse" [ngClass]="containerClass">
      <div class="bg-gray-200 rounded" [ngClass]="shapeClass"></div>
    </div>
  `,
  styles: [`
    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: .5;
      }
    }
    .animate-pulse {
      animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
  `]
})
export class SkeletonComponent {
  @Input() width: string = '100%';
  @Input() height: string = '1rem';
  @Input() shape: 'rect' | 'circle' = 'rect';
  @Input() containerClass: string = '';

  get shapeClass(): string {
    const base = this.shape === 'circle' ? 'rounded-full' : 'rounded';
    return `${base} bg-gray-200`;
  }
}

@Component({
  selector: 'app-skeleton-card',
  standalone: true,
  imports: [CommonModule, SkeletonComponent],
  template: `
    <div class="card animate-pulse">
      <div class="space-y-3">
        <div class="h-4 bg-gray-200 rounded w-3/4"></div>
        <div class="h-8 bg-gray-200 rounded w-1/2"></div>
      </div>
    </div>
  `
})
export class SkeletonCardComponent {}

@Component({
  selector: 'app-skeleton-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th *ngFor="let col of columns" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              <div class="h-4 bg-gray-200 rounded w-20"></div>
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr *ngFor="let row of rows" class="animate-pulse">
            <td *ngFor="let col of columns" class="px-6 py-4 whitespace-nowrap">
              <div class="h-4 bg-gray-200 rounded" [style.width]="col.width || '60%'"></div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `
})
export class SkeletonTableComponent {
  @Input() columns: number = 5;
  @Input() rows: number = 5;
}
