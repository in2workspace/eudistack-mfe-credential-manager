import { AfterViewInit, Component, ViewChild, input } from '@angular/core';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Numbered pagination bar (Material's paginator has no page buttons). It drives a hidden
 * MatPaginator wired to the caller's data source, so slicing and sort stay with
 * MatTableDataSource. Keep that paginator inside this template: hoisted into the parent's
 * template it broke unrelated bindings there. The template reads the paginator's plain
 * properties, so this relies on default change detection.
 */
@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [MatPaginatorModule, MatIconModule, MatFormFieldModule, MatSelectModule, TranslatePipe],
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.scss',
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
    return this.hasLastPageButton() && (window.at(-1) ?? 0) < this.totalPages() - 1;
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
