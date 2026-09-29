import { AfterViewInit, Component, ViewChild, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Custom numbered-page pagination bar (US — credential-management dashboard,
 * "paginació" round). Angular Material's own MatPaginator UI has no numbered
 * page buttons or ellipsis — only prev/next arrows, a page-size select and a
 * "X-Y of Z" label — so there is no way to get this look from Material alone.
 *
 * Instead of reimplementing pagination state/slicing (which MatTableDataSource
 * already does correctly, including keeping it in sync with sort), this owns a
 * real (CSS-hidden) `MatPaginator` internally and wires it to the caller's
 * `dataSource` itself in ngAfterViewInit — the caller only ever sees this
 * component. That instance IS the source of truth for pageIndex/pageSize/length.
 * Every control here mutates it and re-emits its `page` event, the same event
 * MatTableDataSource listens to — so navigating from this UI re-slices/
 * re-renders the table exactly like the native paginator would.
 *
 * The hidden MatPaginator used to live in the parent's own (already large)
 * template, as a sibling passed in by reference. That measurably destabilized
 * unrelated bindings elsewhere in that template (verified live, not just in
 * theory — the Type/Status filter buttons rendered with empty labels, and at
 * one point the whole table rendered with zero rows, both while this component
 * or its paginator sibling sat unconditionally in that template). Moving the
 * paginator inside this component's own, much smaller template removed the
 * problem in practice. That is not a confirmed root cause — just the fix that
 * held up under repeated verification — so keep this self-contained rather
 * than hoisting the paginator back out.
 *
 * Default (non-OnPush) change detection is relied on deliberately: reading
 * `paginator.pageIndex` etc. directly in the template — rather than through a
 * `computed()`, which only reacts to *signal* reads and would not notice a
 * plain property mutation on the paginator — re-evaluates on every app-wide CD
 * tick, which already happens after every click/event in this tree.
 */
@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule, MatPaginatorModule, MatIconModule, MatFormFieldModule, MatSelectModule, TranslatePipe],
  template: `
    <mat-paginator
      class="paginator-engine"
      [pageSize]="defaultPageSize()"
      [pageSizeOptions]="pageSizeOptions()">
    </mat-paginator>

    <div class="pagination-bar">
      <div class="pagination-left">
        <button
          type="button"
          class="pagination-nav-btn"
          [disabled]="!hasPrevious()"
          [attr.aria-label]="'pagination.back' | translate"
          (click)="previous()">
          <mat-icon>arrow_back</mat-icon>
          {{ 'pagination.back' | translate }}
        </button>

        <button
          *ngFor="let page of pageWindow(); trackBy: trackByPage"
          type="button"
          class="pagination-page-btn"
          [class.pagination-page-btn--active]="page === currentPageNumber()"
          [attr.aria-current]="page === currentPageNumber() ? 'page' : null"
          (click)="goToPage(page)">
          {{ page }}
        </button>

        <ng-container *ngIf="hasLastPageButton()">
          <button *ngIf="showEllipsis()" type="button" class="pagination-ellipsis" disabled aria-hidden="true">&hellip;</button>
          <button
            type="button"
            class="pagination-page-btn"
            [class.pagination-page-btn--active]="totalPages() === currentPageNumber()"
            [attr.aria-current]="totalPages() === currentPageNumber() ? 'page' : null"
            (click)="goToPage(totalPages())">
            {{ totalPages() }}
          </button>
        </ng-container>

        <button
          type="button"
          class="pagination-nav-btn"
          [disabled]="!hasNext()"
          [attr.aria-label]="'pagination.next' | translate"
          (click)="next()">
          {{ 'pagination.next' | translate }}
          <mat-icon>arrow_forward</mat-icon>
        </button>
      </div>

      <div class="pagination-right">
        <span class="pagination-per-page-label">{{ 'pagination.resultsPerPage' | translate }}</span>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="pagination-page-size-field">
          <mat-select [value]="paginatorRef.pageSize" panelClass="accent-scope rounded-scope" (selectionChange)="onPageSizeChange($event.value)">
            <mat-option *ngFor="let size of pageSizeOptions(); trackBy: trackBySize" [value]="size">{{ size }}</mat-option>
          </mat-select>
        </mat-form-field>
      </div>
    </div>
  `,
  styles: [`
    .paginator-engine {
      display: none;
    }

    .pagination-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      width: 100%;
      box-sizing: border-box;
    }

    .pagination-left {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .pagination-right {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }

    .pagination-per-page-label {
      color: var(--text-secondary, #6B7280);
      font-size: 0.875rem;
      white-space: nowrap;
    }

    .pagination-page-size-field {
      width: 72px;
      font-size: 0.875rem;
      --mat-form-field-container-height: 32px;
      --mat-form-field-container-vertical-padding: 4px;
      --mdc-outlined-text-field-outline-color: var(--primary-accent);
      --mdc-outlined-text-field-hover-outline-color: var(--primary-accent);
      --mdc-outlined-text-field-focus-outline-color: var(--primary-accent);
      --mat-select-enabled-arrow-color: var(--primary-accent);
      --mat-select-focused-arrow-color: var(--primary-accent);
    }

    .pagination-nav-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      height: 32px;
      padding: 0 10px;
      border: 1px solid var(--primary-accent);
      background: var(--color-white);
      color: var(--primary-accent);
      font: inherit;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      border-radius: var(--radius-lg, 16px);

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      &:hover:not(:disabled) {
        background: var(--primary-15);
      }

      &:disabled {
        border-color: var(--border-default, #D1D5DB);
        color: var(--text-disabled, #9CA3AF);
        cursor: default;
      }

      &:focus-visible {
        outline: 2px solid var(--primary-accent);
        outline-offset: 2px;
      }
    }

    .pagination-page-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 32px;
      height: 32px;
      padding: 0 4px;
      border: none;
      border-radius: var(--radius-lg, 16px);
      background: var(--color-white);
      color: var(--text-primary, #1A1A2E);
      font: inherit;
      font-size: 0.875rem;
      cursor: pointer;

      &:hover:not(&--active) {
        background: var(--primary-50);
      }

      // Text stays --text-primary: --primary-accent on --primary-100 is only ~4.1:1.
      &--active {
        background: var(--primary-100);
        font-weight: 600;
      }

      &:focus-visible {
        outline: 2px solid var(--primary-accent);
        outline-offset: 2px;
      }
    }

    .pagination-ellipsis {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 32px;
      height: 32px;
      border: none;
      background: transparent;
      color: var(--text-disabled, #9CA3AF);
      font: inherit;
      cursor: default;
    }

    @media (width < 590px) {
      .pagination-bar {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
      }

      .pagination-right {
        justify-content: flex-end;
      }

      .pagination-left {
        justify-content: center;
      }
    }
  `],
})
export class PaginationComponent implements AfterViewInit {
  @ViewChild(MatPaginator, { static: true }) protected paginatorRef!: MatPaginator;

  /** The MatTableDataSource this pagination bar drives — wired internally on init. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public readonly dataSource = input.required<MatTableDataSource<any>>();
  public readonly pageSizeOptions = input<number[]>([10, 20, 50]);
  public readonly defaultPageSize = input<number>(10);

  public ngAfterViewInit(): void {
    this.dataSource().paginator = this.paginatorRef;
  }

  protected totalPages(): number {
    const { length, pageSize } = this.paginatorRef;
    return Math.max(1, Math.ceil(length / pageSize));
  }

  protected currentPageNumber(): number {
    return this.paginatorRef.pageIndex + 1;
  }

  protected hasPrevious(): boolean {
    return this.paginatorRef.pageIndex > 0;
  }

  protected hasNext(): boolean {
    return this.paginatorRef.pageIndex < this.totalPages() - 1;
  }

  /**
   * Sliding window of up to 6 numbered pages. Page 1 always stays the first
   * button — only the remaining slots slide as the current page moves.
   */
  protected pageWindow(): number[] {
    const total = this.totalPages();
    const maxNumbered = 6;

    if (total <= maxNumbered) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const slidingCount = maxNumbered - 1;
    const current = this.currentPageNumber();
    let start = current - Math.floor(slidingCount / 2) + 1;
    start = Math.max(2, start);
    start = Math.min(start, total - slidingCount);

    return [1, ...Array.from({ length: slidingCount }, (_, i) => start + i)];
  }

  /** True whenever the last page isn't already part of the numbered window — it gets its own button. */
  protected hasLastPageButton(): boolean {
    return this.totalPages() > 6;
  }

  /** True only when a real gap separates the window from the last page — never for an adjacent one. */
  protected showEllipsis(): boolean {
    const window = this.pageWindow();
    return this.hasLastPageButton() && window[window.length - 1] < this.totalPages() - 1;
  }

  protected trackByPage(_index: number, page: number): number {
    return page;
  }

  protected trackBySize(_index: number, size: number): number {
    return size;
  }

  protected previous(): void {
    if (this.hasPrevious()) this.goToPage(this.currentPageNumber() - 1);
  }

  protected next(): void {
    if (this.hasNext()) this.goToPage(this.currentPageNumber() + 1);
  }

  protected goToPage(page: number): void {
    const previousPageIndex = this.paginatorRef.pageIndex;
    this.paginatorRef.pageIndex = page - 1;
    this.emitPageEvent(previousPageIndex);
  }

  protected onPageSizeChange(newPageSize: number): void {
    const previousPageIndex = this.paginatorRef.pageIndex;
    const startIndex = this.paginatorRef.pageIndex * this.paginatorRef.pageSize;
    this.paginatorRef.pageSize = newPageSize;
    this.paginatorRef.pageIndex = Math.floor(startIndex / newPageSize) || 0;
    this.emitPageEvent(previousPageIndex);
  }

  /** Mirrors what MatPaginator's own nextPage()/previousPage()/_changePageSize() do internally. */
  private emitPageEvent(previousPageIndex: number): void {
    const event: PageEvent = {
      previousPageIndex,
      pageIndex: this.paginatorRef.pageIndex,
      pageSize: this.paginatorRef.pageSize,
      length: this.paginatorRef.length,
    };
    this.paginatorRef.page.emit(event);
  }
}
