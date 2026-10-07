import { AfterViewInit, Component, input, viewChild } from '@angular/core';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';

/** Positions in the bar between Back and Next, ellipses included. */
const MAX_SLOTS = 8;

/** A page number, or the ellipsis before / after the pages around the current one. */
type PageSlot = number | 'gap-start' | 'gap-end';

function pageRange(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

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
  /** The MatTableDataSource this pagination bar drives — wired internally on init. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public readonly dataSource = input.required<MatTableDataSource<any>>();
  public readonly pageSizeOptions = input<number[]>([10, 20, 50]);
  public readonly defaultPageSize = input<number>(10);

  protected readonly paginator = viewChild.required(MatPaginator);

  public ngAfterViewInit(): void {
    this.dataSource().paginator = this.paginator();
  }

  protected totalPages(): number {
    const { length, pageSize } = this.paginator();
    return Math.max(1, Math.ceil(length / pageSize));
  }

  protected currentPageNumber(): number {
    return this.paginator().pageIndex + 1;
  }

  protected hasPrevious(): boolean {
    return this.paginator().pageIndex > 0;
  }

  protected hasNext(): boolean {
    return this.paginator().pageIndex < this.totalPages() - 1;
  }

  /**
   * Page buttons and ellipses, always MAX_SLOTS of them once there are more pages than that,
   * so the bar never changes width while paging. The first and last pages are always shown,
   * the current page always has a neighbour on each side, and an ellipsis always stands for
   * two or more pages (a single hidden page is shown instead).
   *   near the start: 1 2 3 4 5 6 … 20
   *   in the middle:  1 … 5 6 7 8 … 20
   *   near the end:   1 … 15 16 17 18 19 20
   */
  protected pageSlots(): PageSlot[] {
    const total = this.totalPages();
    if (total <= MAX_SLOTS) return pageRange(1, total);

    const current = this.currentPageNumber();
    const edgeCount = MAX_SLOTS - 2;
    if (current <= edgeCount - 2) {
      return [...pageRange(1, edgeCount), 'gap-end', total];
    }
    if (current >= total - edgeCount + 2) {
      return [1, 'gap-start', ...pageRange(total - edgeCount + 1, total)];
    }
    const middleStart = current - 1;
    return [1, 'gap-start', ...pageRange(middleStart, middleStart + MAX_SLOTS - 5), 'gap-end', total];
  }

  protected previous(): void {
    if (this.hasPrevious()) this.goToPage(this.currentPageNumber() - 1);
  }

  protected next(): void {
    if (this.hasNext()) this.goToPage(this.currentPageNumber() + 1);
  }

  protected goToPage(page: number): void {
    const previousPageIndex = this.paginator().pageIndex;
    this.paginator().pageIndex = page - 1;
    this.emitPageEvent(previousPageIndex);
  }

  protected onPageSizeChange(newPageSize: number): void {
    const previousPageIndex = this.paginator().pageIndex;
    const startIndex = this.paginator().pageIndex * this.paginator().pageSize;
    this.paginator().pageSize = newPageSize;
    this.paginator().pageIndex = Math.floor(startIndex / newPageSize) || 0;
    this.emitPageEvent(previousPageIndex);
  }

  /** Mirrors what MatPaginator's own nextPage()/previousPage()/_changePageSize() do internally. */
  private emitPageEvent(previousPageIndex: number): void {
    const event: PageEvent = {
      previousPageIndex,
      pageIndex: this.paginator().pageIndex,
      pageSize: this.paginator().pageSize,
      length: this.paginator().length,
    };
    this.paginator().page.emit(event);
  }
}
