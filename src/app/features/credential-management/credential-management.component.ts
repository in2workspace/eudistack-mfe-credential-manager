import { CREDENTIAL_MANAGEMENT_SEARCH_PLACEHOLDER_SUBJECT } from './../../core/constants/translations.constants';
import { AfterViewInit, ChangeDetectorRef, Component, OnInit, inject, ViewChild, DestroyRef, ElementRef, NgZone, computed, signal } from '@angular/core';
import { MatTableDataSource, MatTable, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatCellDef, MatCell, MatHeaderRowDef, MatHeaderRow, MatRowDef, MatRow } from '@angular/material/table';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import {
  CredentialDetailsDrawerComponent,
  CredentialDetailsDrawerData,
} from '../credential-details/credential-details-drawer/credential-details-drawer.component';
import { CredentialActionsService } from '../credential-details/services/credential-actions.service';
import { CredentialProcedureService } from 'src/app/core/services/credential-procedure.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { MatSort, MatSortHeader, Sort, SortDirection } from '@angular/material/sort';
import { MatSelectModule } from '@angular/material/select';
import { CredentialProcedureBasicInfo, CredentialProceduresResponse } from "../../core/models/dto/credential-procedures-response.dto";
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MatButton, MatButtonModule } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime, distinctUntilChanged, map, Subject, take } from 'rxjs';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatIcon } from '@angular/material/icon';
import { CredentialFilter, CredentialProcedureWithClass, FILTERABLE_STATUSES, Filter, FilterConfig, FilterOption } from 'src/app/core/models/entity/lear-credential-management';
import { LifeCycleStatusService } from 'src/app/shared/services/life-cycle-status.service';
import { RoleType } from 'src/app/core/models/enums/auth-rol-type.enum';
import { getCredentialTypeFamilyKey, getCredentialTypeFamilyLabelKey } from 'src/app/core/helpers/credential-type-family';

import { SubjectComponent } from './components/subject-component/subject-component.component';
import { FormsModule } from '@angular/forms';
import { CREDENTIAL_MANAGEMENT_SUBJECT } from 'src/app/core/constants/translations.constants';
import { CapitalizePipe } from 'src/app/shared/pipes/capitalize.pipe';
import { LocalizedDatePipe } from 'src/app/shared/pipes/localized-date.pipe';
import { SkeletonLoaderComponent } from 'src/app/shared/components/skeleton-loader/skeleton-loader.component';
import { FilterDropdownComponent } from 'src/app/shared/components/filter-dropdown/filter-dropdown.component';
import { PaginationComponent } from 'src/app/shared/components/pagination/pagination.component';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SortByOption = 'recentlyIssued' | 'recentlyUpdated' | 'expiringSoon' | 'expiringLater';

/** Maps each SortByOption to the matSort column id + direction it drives. */
const SORT_BY_OPTIONS: Record<SortByOption, { active: string; direction: SortDirection }> = {
  recentlyIssued: { active: 'issued', direction: 'desc' },
  recentlyUpdated: { active: 'updated', direction: 'desc' },
  expiringSoon: { active: 'expires', direction: 'asc' },
  expiringLater: { active: 'expires', direction: 'desc' },
};

@Component({
    selector: 'app-credential-management',
    templateUrl: './credential-management.component.html',
    styleUrls: ['./credential-management.component.scss'],
    imports: [
        FormsModule,
        MatButton,
        MatButtonModule,
        MatTable,
        MatSort,
        MatColumnDef,
        MatFormField,
        MatHeaderCellDef,
        MatHeaderCell,
        MatIcon,
        MatInputModule,
        MatLabel,
        MatSortHeader,
        MatCellDef,
        MatCell,
        MatHeaderRowDef,
        MatHeaderRow,
        MatRowDef,
        MatRow,
        MatTooltipModule,
        MatSelectModule,
        LocalizedDatePipe,
        SubjectComponent,
        TranslatePipe,
        CapitalizePipe,
        SkeletonLoaderComponent,
        FilterDropdownComponent,
        PaginationComponent,
        RouterLink,
    ],
})
export class CredentialManagementComponent implements OnInit, AfterViewInit {
  @ViewChild(MatSort) public sort!: MatSort;
  @ViewChild('searchInput') public searchInput!: ElementRef<HTMLInputElement>;
  public dataSource = new MatTableDataSource<CredentialProcedureWithClass>();
  public searchLabel = CREDENTIAL_MANAGEMENT_SUBJECT;
  public searchPlaceholder = CREDENTIAL_MANAGEMENT_SEARCH_PLACEHOLDER_SUBJECT;
  public isLoading = true;

  /** True when the initial credential load failed (ES-02). Prevents showing empty-state as "no matches". */
  public hasLoadError: boolean = false;

  /** Read-only list of statuses shown in the status filter dropdown. */
  public readonly filterableStatuses = FILTERABLE_STATUSES;

  /** Total rows currently matching the compound filter — drives the "X results" line. */
  public readonly resultsCount = signal(0);

  /**
   * Currently selected "Sort by" option, kept in sync with the table's MatSort.
   * null when the table is sorted by a header in a way no option describes — the
   * selector then shows its "Custom" placeholder.
   */
  public readonly sortOption = signal<SortByOption | null>('recentlyUpdated');
  protected readonly sortByOptions = Object.keys(SORT_BY_OPTIONS) as SortByOption[];

  /** Selections applied to each multi-checkbox filter facet (AC-2.1/2.3). */
  public selectedOrganizations = signal<string[]>([]);
  public selectedTypes = signal<string[]>([]);
  public selectedStatuses = signal<string[]>([]);

  public readonly organizationOptions = signal<FilterOption[]>([]);
  public readonly typeOptions = computed<FilterOption[]>(() => {
    this.currentLang();
    return [...this.credentialTypesByFamily().entries()]
      .map(([value, credentialType]) => ({ value, label: this.getCredentialTypeLabel(credentialType) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });
  public readonly statusOptions = computed<FilterOption[]>(() => {
    this.currentLang();
    return this.filterableStatuses.map(status => ({
      value: status,
      label: this.toSentenceCase(this.translate.instant(`credentialDetails.${status}`)),
    }));
  });

  // computed
  public readonly canWrite = computed(() => this.authService.roleType() !== RoleType.SYSADMIN_READONLY);
  public readonly isAdminOrganizationIdentifier = computed(() =>
    this.authService.roleType() === RoleType.TENANT_ADMIN && this.authService.tenantType() === 'multi_org'
  );

  public readonly displayedColumns = computed<string[]>(() => {
    const columns: string[] = [];
    if (this.hasTenantColumn()) columns.push('tenant');
    columns.push('organization_identifier', 'subject','credential_type', 'status', 'issued', 'expires', 'updated', 'action');
    return columns;
  });

  public readonly hasActiveFilters = computed(() =>
    this.selectedOrganizations().length > 0 ||
    this.selectedTypes().length > 0 ||
    this.selectedStatuses().length > 0
  );

  protected readonly hasTenantColumn = signal(false);

  /**
   * Current subject search text, trimmed — set on every keystroke (drives the
   * search clear button) and kept in sync by applyCompoundFilter().
   */
  protected readonly currentSubjectFilter = signal('');

  /** Snapshot of the full dataset after load — used to distinguish "no credentials" from "no matches". */
  private readonly originData = signal<CredentialProcedureWithClass[]>([]);

  private drawerRef?: MatDialogRef<CredentialDetailsDrawerComponent>;

  private readonly authService = inject(AuthService);
  private readonly credentialProcedureService = inject(CredentialProcedureService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly credentialActions = inject(CredentialActionsService);
  private readonly statusService = inject(LifeCycleStatusService);
  private readonly cd = inject(ChangeDetectorRef);
  private readonly translate = inject(TranslateService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly searchSubject = new Subject<string>();
  private readonly currentLang = toSignal(
    this.translate.onLangChange.pipe(map(event => event.lang)),
    { initialValue: this.translate.currentLang }
  );
  private readonly credentialTypesByFamily = signal(new Map<string, string>());

  /** FilterConfig map for text-search filters only. Type/status/organization use the checkbox dropdowns. */
  private readonly filtersMap: Partial<Record<Filter, FilterConfig>> = {
    subject: {
      filterName: "subject",
      translationLabel: CREDENTIAL_MANAGEMENT_SUBJECT,
      placeholderTranslationLabel: CREDENTIAL_MANAGEMENT_SEARCH_PLACEHOLDER_SUBJECT
    }
   } as const;

 public get isLoadError(): boolean {
    return this.hasLoadError;
  }

 public get isEmptyOrigin(): boolean {
    return !this.hasLoadError && this.originData().length === 0;
  }

 public get isEmptyFiltered(): boolean {
    return (
      !this.hasLoadError &&
      this.originData().length > 0 &&
      this.dataSource.filteredData.length === 0
    );
  }

  public ngOnInit() {
    // Installs the compound filter predicate before data loads — with a
    // synchronous data source (e.g. a mock used for local testing)
    // initializeCredentialTable()'s subscribe callback would otherwise run
    // before ngAfterViewInit() ever sets it, leaving MatTableDataSource's
    // default predicate (which can't read the serialized CredentialFilter) in
    // place. setFilter('subject') is idempotent, so ngAfterViewInit() calling
    // it again is harmless.
    this.setFilter('subject');
    this.initializeCredentialTable();
    this.syncDrawerWithUrl();
    this.refreshOnCredentialAction();
  }

  public ngAfterViewInit(): void {
    this.setFilter("subject");
    this.setStringSearchSubscription();
    this.pinTableHeaderOnScroll();
  }

  public navigateToCreateCredential(): void {
    void this.router.navigate(['/organization/credentials/create']);
  }

  public navigateToCreateCredentialOnBehalf(): void {
    const route = this.isAdminOrganizationIdentifier()
      ? ['/organization/credentials/create-on-behalf']
      : ['/organization/credentials/create'];

    void this.router.navigate(route);
  }

  public openCredentialDetails(credential_procedures: CredentialProcedureBasicInfo): void {
    const id = credential_procedures.credential_procedure?.procedure_id;
    if (!id) return;

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { id },
      queryParamsHandling: 'merge',
    });
  }

  private refreshOnCredentialAction(): void {
    this.credentialActions.actionCompleted$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.initializeCredentialTable());
  }

  private syncDrawerWithUrl(): void {
    this.route.queryParamMap
      .pipe(
        map(params => params.get('id')),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(id => (id ? this.openDrawer(id) : this.closeDrawer()));
  }

  private openDrawer(procedureId: string): void {
    if (this.drawerRef) return;
    if (!UUID_PATTERN.test(procedureId)) {
      this.clearDrawerQueryParam();
      return;
    }

    const data: CredentialDetailsDrawerData = {
      procedureId,
      lastUpdated: computed(() => this.findLastUpdated(procedureId)),
    };

    this.drawerRef = this.dialog.open<CredentialDetailsDrawerComponent, CredentialDetailsDrawerData>(
      CredentialDetailsDrawerComponent,
      {
        data,
        autoFocus: false,
        ariaLabelledBy: 'drawer-title',
        width: 'min(560px, 100vw)',
        maxHeight: '100vh',
        panelClass: 'credential-details-drawer',
      }
    );

    this.drawerRef
      .afterClosed()
      .pipe(take(1))
      .subscribe(() => {
        this.drawerRef = undefined;
        this.clearDrawerQueryParam();
      });
  }

  private closeDrawer(): void {
    this.drawerRef?.close();
  }

  private clearDrawerQueryParam(): void {
    if (!this.route.snapshot.queryParamMap.get('id')) return;

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { id: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private findLastUpdated(procedureId: string): string | undefined {
    return this.originData().find(row => row.credential_procedure?.procedure_id === procedureId)
      ?.credential_procedure?.updated;
  }

  public getStatusIcon(status: string): string {
    return this.statusService.getStatusIcon(status);
  }

  public onSearchStringChange(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.currentSubjectFilter.set(filterValue.trim());
    this.searchSubject.next(filterValue);
  }

  public getCredentialTypeLabel(credentialType: string): string {
    const familyLabelKey = getCredentialTypeFamilyLabelKey(credentialType);
    if (familyLabelKey) {
      return this.translate.instant(familyLabelKey);
    }

    const prefixedKey = `credentialManagement.${credentialType}`;
    const translated = this.translate.instant(prefixedKey);
    if (translated !== prefixedKey) {
      return translated;
    }

    const fallbackVersionKey = prefixedKey.replace(/\.\d+$/, '.1');
    const fallbackVersionTranslated = this.translate.instant(fallbackVersionKey);
    if (fallbackVersionTranslated !== fallbackVersionKey) {
      return fallbackVersionTranslated;
    }

    const fallbackWithoutVersionKey = prefixedKey.replace(/\.\d+$/, '');
    const fallbackWithoutVersionTranslated = this.translate.instant(fallbackWithoutVersionKey);
    if (fallbackWithoutVersionTranslated !== fallbackWithoutVersionKey) {
      return fallbackWithoutVersionTranslated;
    }

    return credentialType;
  }

  public onOrganizationFilterChange(values: string[]): void {
    this.selectedOrganizations.set(values);
    this.reapplyDropdownFilters();
  }

 public onTypeFilterChange(values: string[]): void {
    this.selectedTypes.set(values);
    this.reapplyDropdownFilters();
  }

  public onStatusFilterChange(values: string[]): void {
    this.selectedStatuses.set(values);
    this.reapplyDropdownFilters();
  }

  /**
   * Handler for the "Sort by" selector next to the results count. Drives the
   * same MatSort the column headers use — emitting sortChange() is what
   * MatTableDataSource listens to re-sort, and MatSortHeader listens to it too,
   * so the arrow on the corresponding column header updates to match.
   */
  public onSortOptionChange(option: SortByOption): void {
    this.sortOption.set(option);
    const { active, direction } = SORT_BY_OPTIONS[option];
    this.applySort(active, direction);
  }

  private applySort(active: string, direction: SortDirection): void {
    this.sort.active = active;
    this.sort.direction = direction;
    this.sort.sortChange.emit({ active, direction });
  }

  /** Mirrors any table sort change (header click or selector) back into the "Sort by" selector. */
  public onTableSortChange({ active, direction }: Sort): void {
    const match = (Object.keys(SORT_BY_OPTIONS) as SortByOption[]).find(option =>
      SORT_BY_OPTIONS[option].active === active && SORT_BY_OPTIONS[option].direction === direction
    );
    this.sortOption.set(match ?? null);
  }

  public clearDropdownFilters(): void {
    this.selectedOrganizations.set([]);
    this.selectedTypes.set([]);
    this.selectedStatuses.set([]);
    this.reapplyDropdownFilters();
  }

  public clearSearch(): void {
    this.searchSubject.next('');
    if (this.searchInput?.nativeElement) {
      this.searchInput.nativeElement.value = '';
    }
    this.applyCompoundFilter('');

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

 public clearFilters(): void {
    this.selectedOrganizations.set([]);
    this.selectedTypes.set([]);
    this.selectedStatuses.set([]);
    this.clearSearch();
  }

  private initializeCredentialTable(): void {
    const previousSort = this.sort?.active && this.sort.direction
      ? { active: this.sort.active, direction: this.sort.direction }
      : undefined;
    this.isLoading = true;
    this.hasLoadError = false;
    this.credentialProcedureService.fetchCredentialProcedures()
    .pipe(take(1))
    .subscribe({
      next: (data: CredentialProceduresResponse) => {
        const withClass = this.statusService.addStatusClass(data.credential_procedures);
        this.dataSource.data = withClass;
        this.originData.set(withClass);

        // Show tenant column when cross-tenant data is present (platform admin view)
        this.hasTenantColumn.set(data.credential_procedures.some(p => !!p.credential_procedure.tenant));
        this.computeFilterOptions(withClass);

        // Explicitly (re)applies the compound filter against the freshly loaded
        // data — setting dataSource.data alone does not reliably re-run
        // filteredData, so without this, the table and the results count would
        // only match the current filters once the user first touches a control.
        this.applyCompoundFilter(this.currentSubjectFilter());

        this.isLoading = false;
        this.cd.detectChanges();
        // dataSource.paginator is wired by PaginationComponent itself (it owns
        // the real MatPaginator internally now — see its doc comment).
        this.setDataSortingAccessor();
        this.dataSource.sort = this.sort;
        if (previousSort) {
          this.applySort(previousSort.active, previousSort.direction);
        }
      },
      error: (error) => {
        console.error('Error fetching credentials for table', error);
        this.isLoading = false;
        this.hasLoadError = true;
      }
    });
  }

  private computeFilterOptions(rows: CredentialProcedureWithClass[]): void {
    const organizations = new Map<string, string>();
    const typesByFamily = new Map<string, string>();

    for (const row of rows) {
      const procedure = row.credential_procedure;
      if (procedure?.organization_identifier && !organizations.has(procedure.organization_identifier)) {
        organizations.set(procedure.organization_identifier, procedure.organization_identifier);
      }
      if (procedure?.credential_type) {
        const familyKey = getCredentialTypeFamilyKey(procedure.credential_type);
        if (!typesByFamily.has(familyKey)) {
          typesByFamily.set(familyKey, procedure.credential_type);
        }
      }
    }

    this.organizationOptions.set(
      [...organizations.entries()]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label))
    );
    this.credentialTypesByFamily.set(typesByFamily);
  }

  /**
   * Safely lowercases a credential procedure field value.
   * Returns '' and logs a console.error when the value is missing or not a string,
   * so filtering/sorting never crashes on records with absent fields (e.g. subject
   * missing on LEAR_CREDENTIAL_MACHINE procedures).
   */
  private getSafeLowerCaseValue(value: unknown, fieldName: string, procedureId?: string): string {
    if (typeof value !== 'string') {
      console.error('Invalid credential procedure field value', {
        fieldName,
        procedureId,
        value,
        valueType: typeof value
      });
      return '';
    }

    return value.toLowerCase();
  }

  private updatedTime(item: CredentialProcedureBasicInfo): number {
    const t = Date.parse(item.credential_procedure?.updated ?? '');
    return Number.isFinite(t) ? t : 0;
  }

  /** "TO SIGN" → "To sign". Status translations are uppercase for the details-page pill. */
  private toSentenceCase(text: string): string {
    const lower = text.toLocaleLowerCase();
    return lower.charAt(0).toLocaleUpperCase() + lower.slice(1);
  }

  private setDataSortingAccessor(): void{
    this.dataSource.sortingDataAccessor = (item: CredentialProcedureBasicInfo, property: string) => {
      const procedure = item.credential_procedure;
      const procedureId = procedure?.procedure_id;
      switch (property) {
        case 'status': {
          const status = this.getSafeLowerCaseValue(procedure?.status, 'status', procedureId);
          return status === 'withdrawn' ? 'draft' : status;
        }
        case 'subject': {
          return this.getSafeLowerCaseValue(procedure?.subject, 'subject', procedureId);
        }
        case 'issued': {
          const t = Date.parse(procedure?.issued_at ?? '');
          return Number.isFinite(t) ? t : 0;
        }
        case 'expires': {
          const t = Date.parse(procedure?.expires_at ?? '');
          return Number.isFinite(t) ? t : Infinity;
        }
        case 'updated': {
          return this.updatedTime(item);
        }
        case 'credential_type': {
          if (typeof procedure?.credential_type !== 'string') {
            return this.getSafeLowerCaseValue(procedure?.credential_type, 'credential_type', procedureId);
          }
          return this.getCredentialTypeLabel(procedure.credential_type).toLowerCase();
        }
        case 'organization_identifier': {
          return this.getSafeLowerCaseValue(procedure?.organization_identifier, 'organization_identifier', procedureId);
        }
        case 'tenant': {
          return this.getSafeLowerCaseValue(procedure?.tenant, 'tenant', procedureId);
        }
        default:
          return '';
      }
    };
  }

  private setFilter(filter: Filter): void{
    this.setFilterLabelAndPlaceholder(filter);
    this.setFilterPredicate();
  }

  /**
   * Compound filter predicate
   * dataSource.filter is a JSON-serialized CredentialFilter: subject is AND'd with
   * organizations/types/statuses; each of those three facets is OR-within-facet
   * (any selected value matches) and AND-across-facets. Empty string/array means
   * "no filter" for that facet.
   */
  private setFilterPredicate(): void{
    this.dataSource.filterPredicate = (data: CredentialProcedureBasicInfo, filterString: string) => {
      const empty: CredentialFilter = { subject: '', organizations: [], types: [], statuses: [] };
      let parsed: CredentialFilter = empty;
      try {
        parsed = filterString ? JSON.parse(filterString) : empty;
      } catch {
        // Malformed filter string — treat as no filter
      }

      const procedure = data.credential_procedure;

      const subjectMatch = parsed.subject
        ? this.getSafeLowerCaseValue(procedure?.subject, 'subject', procedure?.procedure_id)
            .includes(parsed.subject.trim().toLowerCase())
        : true;

      const orgMatch = parsed.organizations?.length
        ? parsed.organizations.includes(procedure?.organization_identifier)
        : true;

      const typeMatch = parsed.types?.length
        ? parsed.types.includes(getCredentialTypeFamilyKey(procedure?.credential_type ?? ''))
        : true;

      const statusMatch = parsed.statuses?.length
        ? parsed.statuses.includes(procedure?.status)
        : true;

      return subjectMatch && orgMatch && typeMatch && statusMatch;
    };
  }

  /** Builds and sets the serialized CredentialFilter on the dataSource from current facet state. */
  private applyCompoundFilter(subject: string): void {
    const trimmedSubject = subject.trim();
    const filter: CredentialFilter = {
      subject: trimmedSubject,
      organizations: this.selectedOrganizations(),
      types: this.selectedTypes(),
      statuses: this.selectedStatuses(),
    };
    this.dataSource.filter = JSON.stringify(filter);
    this.currentSubjectFilter.set(trimmedSubject);
    this.resultsCount.set(this.dataSource.filteredData.length);
  }

  private reapplyDropdownFilters(): void {
    this.applyCompoundFilter(this.currentSubjectFilter());
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  private setFilterLabelAndPlaceholder(filter: Filter): void{
    const filterConfig: FilterConfig | undefined = this.filtersMap[filter];
    if (!filterConfig) return;
    this.searchLabel = filterConfig.translationLabel;
    this.searchPlaceholder = filterConfig.placeholderTranslationLabel;
  }

  /**
   * Keeps the table header in sight while the page scrolls past the table.
   * Not matHeaderRowDef's sticky: true — the card scrolls horizontally, which
   * makes it the header's scroll container, so a CSS sticky header would never
   * stick to the page. Listens in the capture phase to catch the scroll of
   * whichever element scrolls the page (window or a shell container), and runs
   * outside the zone so scrolling never triggers change detection.
   */
  private pinTableHeaderOnScroll(): void {
    let frame = 0;
    const schedule = () => {
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          this.pinTableHeader();
        });
      }
    };

    // The page also changes height without scrolling (paging, filtering), which
    // can leave the header below a now shorter table.
    const resizeObserver = new ResizeObserver(schedule);

    this.zone.runOutsideAngular(() => {
      document.addEventListener('scroll', schedule, { capture: true, passive: true });
      window.addEventListener('resize', schedule, { passive: true });
      resizeObserver.observe(this.host.nativeElement);
    });
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('scroll', schedule, { capture: true });
      window.removeEventListener('resize', schedule);
      resizeObserver.disconnect();
      cancelAnimationFrame(frame);
    });
  }

  /** Moves the header down to the top of the page's scroll area, never past the table's last row. */
  private pinTableHeader(): void {
    const table = this.host.nativeElement.querySelector<HTMLElement>('.table-container table');
    const header = table?.querySelector<HTMLElement>('thead');
    if (!table || !header) return;

    const tableTop = table.getBoundingClientRect().top;
    const maxOffset = table.offsetHeight - header.offsetHeight;
    const offset = Math.min(Math.max(this.scrollAreaTop(table) - tableTop, 0), maxOffset);
    header.style.transform = offset > 0 ? `translateY(${offset}px)` : '';
  }

  /** Viewport top of the nearest ancestor that scrolls vertically (0 when it's the window). */
  private scrollAreaTop(table: HTMLElement): number {
    // Starts above the card: its own overflow-x makes it a (horizontal-only) scroll container.
    const card = table.closest('.table-container');
    for (let el = card?.parentElement; el && el !== document.body; el = el.parentElement) {
      if (/auto|scroll|overlay/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight) {
        return Math.max(el.getBoundingClientRect().top, 0);
      }
    }
    return 0;
  }

  private setStringSearchSubscription(): void{
    this.searchSubject.pipe(debounceTime(500))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((searchValue) => {
        this.applyCompoundFilter(searchValue);

        if (this.dataSource.paginator) {
          this.dataSource.paginator.firstPage();
        }
    });
  }

}
