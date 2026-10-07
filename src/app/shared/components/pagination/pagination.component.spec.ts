import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatTableDataSource } from '@angular/material/table';
import { PageEvent } from '@angular/material/paginator';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PaginationComponent } from './pagination.component';

describe('PaginationComponent', () => {
  let fixture: ComponentFixture<PaginationComponent>;
  let dataSource: MatTableDataSource<number>;
  let events: PageEvent[];

  // MatTableDataSource updates paginator.length in a microtask, so settle it with real timers.
  async function setup(itemCount: number, inputs: Record<string, unknown> = {}): Promise<void> {
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), NoopAnimationsModule, PaginationComponent],
    });

    dataSource = new MatTableDataSource<number>(Array.from({ length: itemCount }, (_, i) => i));
    fixture = TestBed.createComponent(PaginationComponent);
    fixture.componentRef.setInput('dataSource', dataSource);
    Object.entries(inputs).forEach(([key, value]) => fixture.componentRef.setInput(key, value));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    events = [];
    dataSource.paginator!.page.subscribe(e => events.push(e));
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function pageButtons(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.pagination-page-btn'));
  }

  function pageLabels(): string[] {
    return pageButtons().map(b => b.textContent!.trim());
  }

  function activePage(): string | undefined {
    return fixture.nativeElement.querySelector('.pagination-page-btn--active')?.textContent.trim();
  }

  function navButtons(): [HTMLButtonElement, HTMLButtonElement] {
    const buttons = fixture.nativeElement.querySelectorAll('.pagination-nav-btn');
    return [buttons[0], buttons[1]];
  }

  /** Page numbers and ellipses ('…'), in the order they are shown. */
  function slotLabels(): string[] {
    return Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.pagination-page-btn, .pagination-ellipsis'))
      .map(el => el.textContent!.trim());
  }

  function ellipsis(): HTMLElement | null {
    return fixture.nativeElement.querySelector('.pagination-ellipsis');
  }

  async function clickPage(label: string): Promise<void> {
    pageButtons().find(b => b.textContent!.trim() === label)!.click();
    await settle();
  }

  it('wires its internal paginator to the data source', async () => {
    await setup(25);

    expect(dataSource.paginator).toBeTruthy();
    expect(dataSource.paginator!).toHaveLength(25);
    expect(dataSource.connect().value).toEqual(Array.from({ length: 10 }, (_, i) => i));
  });

  it('renders a single page for an empty data source, with both nav buttons disabled', async () => {
    await setup(0);

    expect(pageLabels()).toEqual(['1']);
    expect(activePage()).toBe('1');
    const [back, next] = navButtons();
    expect(back.disabled).toBe(true);
    expect(next.disabled).toBe(true);
    expect(ellipsis()).toBeNull();
  });

  it('shows every page when there are 8 or fewer', async () => {
    await setup(80);

    expect(slotLabels()).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
    expect(ellipsis()).toBeNull();
  });

  it('near the start, shows the first 6 pages, an ellipsis and the last page', async () => {
    await setup(200);

    expect(slotLabels()).toEqual(['1', '2', '3', '4', '5', '6', '…', '20']);
    expect(pageButtons()[0].getAttribute('aria-current')).toBe('page');
    expect(pageButtons()[1].getAttribute('aria-current')).toBeNull();
  });

  it('in the middle, shows an ellipsis on both sides of the pages around the current one', async () => {
    await setup(200);

    await clickPage('6');
    expect(slotLabels()).toEqual(['1', '…', '5', '6', '7', '8', '…', '20']);
    expect(activePage()).toBe('6');
  });

  it('near the end, shows the first page, an ellipsis and the last 6 pages', async () => {
    await setup(200);

    await clickPage('20');
    expect(slotLabels()).toEqual(['1', '…', '15', '16', '17', '18', '19', '20']);
    expect(activePage()).toBe('20');
    expect(pageButtons()[6].getAttribute('aria-current')).toBe('page');
    expect(navButtons()[1].disabled).toBe(true);
  });

  it.each([9, 10, 11, 20])('keeps 8 slots on every page of %i, with the current page and its neighbours visible', async (total) => {
    await setup(total * 10);
    const next = navButtons()[1];

    for (let current = 1; current <= total; current++) {
      const slots = slotLabels();
      const pages = slots.filter(s => s !== '…').map(Number);
      expect(slots).toHaveLength(8);
      expect(pages[0]).toBe(1);
      expect(pages.at(-1)).toBe(total);
      expect(activePage()).toBe(String(current));
      for (const neighbour of [current - 1, current + 1].filter(p => p >= 1 && p <= total)) {
        expect(pages).toContain(neighbour);
      }
      // An ellipsis never stands for a single page.
      slots.forEach((slot, i) => {
        if (slot === '…') expect(Number(slots[i + 1]) - Number(slots[i - 1])).toBeGreaterThan(2);
      });

      next.click();
      await settle();
    }
  });

  it('navigates with next and back, emitting page events', async () => {
    await setup(25);
    const [back, next] = navButtons();

    next.click();
    await settle();
    expect(activePage()).toBe('2');
    expect(back.disabled).toBe(false);
    expect(dataSource.connect().value[0]).toBe(10);

    back.click();
    await settle();
    expect(activePage()).toBe('1');

    expect(events).toEqual([
      { previousPageIndex: 0, pageIndex: 1, pageSize: 10, length: 25 },
      { previousPageIndex: 1, pageIndex: 0, pageSize: 10, length: 25 },
    ]);
  });

  it('ignores next/back calls at the edges', async () => {
    await setup(5);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const component = fixture.componentInstance as any;

    component.previous();
    component.next();

    expect(events).toEqual([]);
  });

  it('keeps the first visible row when the page size changes', async () => {
    await setup(100);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const component = fixture.componentInstance as any;
    await clickPage('3');
    events = [];

    component.onPageSizeChange(20);
    await settle();

    expect(events).toEqual([{ previousPageIndex: 2, pageIndex: 1, pageSize: 20, length: 100 }]);
    expect(activePage()).toBe('2');
    expect(pageLabels()).toEqual(['1', '2', '3', '4', '5']);
  });

  it('honours custom page size inputs', async () => {
    await setup(30, { pageSizeOptions: [5, 15], defaultPageSize: 5 });

    expect(dataSource.paginator!.pageSize).toBe(5);
    expect(dataSource.paginator!.pageSizeOptions).toEqual([5, 15]);
    expect(pageLabels()).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('names the navigation landmark, every page button and the page-size select', async () => {
    await setup(100);
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      pagination: { label: 'Pagination', page: 'Page {{page}}', resultsPerPage: 'Results per page' },
    });
    translate.use('en');
    await settle();

    expect(fixture.nativeElement.querySelector('nav')?.getAttribute('aria-label')).toBe('Pagination');
    expect(pageButtons().map(b => b.getAttribute('aria-label')))
      .toEqual(['Page 1', 'Page 2', 'Page 3', 'Page 4', 'Page 5', 'Page 6', 'Page 10']);
    expect(fixture.nativeElement.querySelector('.pagination-page-size-field mat-select')?.getAttribute('aria-label')).toBe('Results per page');
  });
});
