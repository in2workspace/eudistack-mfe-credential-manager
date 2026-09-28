import { CREDENTIAL_MANAGEMENT_SEARCH_PLACEHOLDER_SUBJECT } from './../../core/constants/translations.constants';
import { AfterViewInit, ChangeDetectorRef, Component, OnInit, inject, ViewChild, DestroyRef, ElementRef, computed, signal } from '@angular/core';
import { MatTableDataSource, MatTable, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatCellDef, MatCell, MatHeaderRowDef, MatHeaderRow, MatRowDef, MatRow } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { Router } from '@angular/router';
import { CredentialProcedureService } from 'src/app/core/services/credential-procedure.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { MatSort, MatSortHeader } from '@angular/material/sort';
import { CredentialProcedureBasicInfo, CredentialProceduresResponse } from "../../core/models/dto/credential-procedures-response.dto";
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { NgClass, DatePipe } from '@angular/common';
import { MatButton, MatButtonModule } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime, Subject, take } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIcon } from '@angular/material/icon';
import { CredentialFilter, CredentialProcedureWithClass, FILTERABLE_STATUSES, Filter, FilterConfig, FilterOption } from 'src/app/core/models/entity/lear-credential-management';
import { LifeCycleStatusService } from 'src/app/shared/services/life-cycle-status.service';
import { RoleType } from 'src/app/core/models/enums/auth-rol-type.enum';

import { SubjectComponent } from './components/subject-component/subject-component.component';
import { FormsModule } from '@angular/forms';
import { CREDENTIAL_MANAGEMENT_SUBJECT } from 'src/app/core/constants/translations.constants';
import { CapitalizePipe } from 'src/app/shared/pipes/capitalize.pipe';
import { SkeletonLoaderComponent } from 'src/app/shared/components/skeleton-loader/skeleton-loader.component';
import { FilterDropdownComponent } from 'src/app/shared/components/filter-dropdown/filter-dropdown.component';
import { RouterLink } from '@angular/router';



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
        NgClass,
        MatTooltipModule,
        MatPaginator,
        DatePipe,
        SubjectComponent,
        TranslatePipe,
        CapitalizePipe,
        SkeletonLoaderComponent,
        FilterDropdownComponent,
        RouterLink,
    ],
})
export class CredentialManagementComponent implements OnInit, AfterViewInit {
  @ViewChild(MatPaginator) public paginator!: MatPaginator;
  @ViewChild(MatSort) public sort!: MatSort;
  @ViewChild('searchInput') public searchInput!: ElementRef<HTMLInputElement>;
  public dataSource = new MatTableDataSource<CredentialProcedureWithClass>();
  public searchLabel = CREDENTIAL_MANAGEMENT_SUBJECT;
  public searchPlaceholder = CREDENTIAL_MANAGEMENT_SEARCH_PLACEHOLDER_SUBJECT;
  public isLoading = true;

  /** True when the initial credential load failed (ES-02). Prevents showing empty-state as "no matches". */
  public hasLoadError: boolean = false;

  /** Read-only list of statuses shown in the status filter dropdown (excludes ARCHIVED). */
  public readonly filterableStatuses = FILTERABLE_STATUSES;

  /** Total rows currently matching the compound filter — drives the "X results" line. */
  public readonly resultsCount = signal(0);

  /** Selections applied to each multi-checkbox filter facet (AC-2.1/2.3). */
  public selectedOrganizations = signal<string[]>([]);
  public selectedTypes = signal<string[]>([]);
  public selectedStatuses = signal<string[]>([]);

  /**
   * Options for the Organization / Type filter dropdowns, derived from the loaded
   * dataset after render (AC-2.2: "recol·lecció de noms... pot ser posterior a la
   * càrrega, per evitar afegir temps de càrrega"). Status options are the static
   * filterableStatuses list instead — no need to wait for data.
   */
  public readonly organizationOptions = signal<FilterOption[]>([]);
  public readonly typeOptions = signal<FilterOption[]>([]);
  public readonly statusOptions = computed<FilterOption[]>(() =>
    this.filterableStatuses.map(status => ({
      value: status,
      label: this.translate.instant(`credentialDetails.${status}`),
    }))
  );

  // computed
  public readonly canWrite = computed(() => this.authService.roleType() !== RoleType.SYSADMIN_READONLY);
  public readonly isAdminOrganizationIdentifier = computed(() =>
    this.authService.roleType() === RoleType.TENANT_ADMIN && this.authService.tenantType() === 'multi_org'
  );
  /** Single-organization tenants have nothing to filter/group by org — column and filter are hidden (AC — tenant-type gating). */
  public readonly isSimpleTenant = computed(() => this.authService.tenantType() === 'simple');

  public readonly displayedColumns = computed<string[]>(() => {
    const columns: string[] = [];
    if (this.hasTenantColumn()) columns.push('tenant');
    if (!this.isSimpleTenant()) columns.push('organization_identifier');
    columns.push('subject', 'credential_type', 'status', 'issued', 'expires', 'updated', 'action');
    return columns;
  });

  /**
   * True when any filter is active — the three checkbox-dropdowns or the
   * subject search box. Drives whether "Clear all" is enabled: a lone search
   * term with no dropdown filter selected is still a filter worth clearing.
   */
  public readonly hasActiveFilters = computed(() =>
    this.currentSubjectFilter().length > 0 ||
    this.selectedOrganizations().length > 0 ||
    this.selectedTypes().length > 0 ||
    this.selectedStatuses().length > 0
  );

  /** Snapshot of the full dataset after load — used to distinguish "no credentials" from "no matches". */
  private originData: CredentialProcedureWithClass[] = [];

  private readonly hasTenantColumn = signal(false);

  /** Current (debounced, applied) subject search text — kept in sync by applyCompoundFilter(). */
  private readonly currentSubjectFilter = signal('');

  private readonly authService = inject(AuthService);
  private readonly credentialProcedureService = inject(CredentialProcedureService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly statusService = inject(LifeCycleStatusService);
  private readonly cd = inject(ChangeDetectorRef);
  private readonly translate = inject(TranslateService);
  private readonly searchSubject = new Subject<string>();

  /** FilterConfig map for text-search filters only. Type/status/organization use the checkbox dropdowns. */
  private readonly filtersMap: Partial<Record<Filter, FilterConfig>> = {
    subject: {
      filterName: "subject",
      translationLabel: CREDENTIAL_MANAGEMENT_SUBJECT,
      placeholderTranslationLabel: CREDENTIAL_MANAGEMENT_SEARCH_PLACEHOLDER_SUBJECT
    }
   } as const;

  /** True when the load failed — show error state (ES-02). */
  public get isLoadError(): boolean {
    return this.hasLoadError;
  }

  /** True when the source dataset has no credentials at all (EC-01). */
  public get isEmptyOrigin(): boolean {
    return !this.hasLoadError && this.originData.length === 0;
  }

  /** True when filters are active but produce no matches, yet there IS data (AC-04). */
  public get isEmptyFiltered(): boolean {
    return (
      !this.hasLoadError &&
      this.originData.length > 0 &&
      this.dataSource.filteredData.length === 0
    );
  }

  public ngOnInit() {
    // Installs the compound filter predicate (which hides ARCHIVED by default)
    // before data loads — with a synchronous data source (e.g. a mock used for
    // local testing) initializeCredentialTable()'s subscribe callback would
    // otherwise run before ngAfterViewInit() ever sets it, leaving the
    // MatTableDataSource's default predicate (which never hides anything) in
    // place. setFilter('subject') is idempotent, so ngAfterViewInit() calling
    // it again is harmless.
    this.setFilter('subject');
    this.initializeCredentialTable();
  }

  public ngAfterViewInit(): void {
    this.setFilter("subject");
    this.setStringSearchSubscription();
  }

  public navigateToCreateCredential(): void {
    this.router.navigate(['/organization/credentials/create']);
  }

  public navigateToCreateCredentialOnBehalf(): void {
    const route = this.isAdminOrganizationIdentifier()
      ? ['/organization/credentials/create-on-behalf']
      : ['/organization/credentials/create'];

    this.router.navigate(route);
  }

  public navigateToCredentialDetails(credential_procedures: CredentialProcedureBasicInfo): void {
    this.router.navigate([
      '/organization/credentials/details',
      credential_procedures.credential_procedure?.procedure_id
    ]);
  }

  public getStatusIcon(status: string): string {
    return this.statusService.getStatusIcon(status);
  }

  public onSearchStringChange(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.searchSubject.next(filterValue);
  }

  public getCredentialTypeLabel(credentialType: string): string {
    switch (this.getTypeFamilyKey(credentialType)) {
      case 'EMPLOYEE': return this.translate.instant('credentialManagement.typeFamily.employee');
      case 'MACHINE': return this.translate.instant('credentialManagement.typeFamily.machine');
      case 'LABEL': return this.translate.instant('credentialManagement.typeFamily.label');
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

  /** Handler for the Organization checkbox-dropdown (Confirm-gated, AC-2.2). */
  public onOrganizationFilterChange(values: string[]): void {
    this.selectedOrganizations.set(values);
    this.reapplyDropdownFilters();
  }

  /** Handler for the Credential type checkbox-dropdown (live filtering, AC-2.3). */
  public onTypeFilterChange(values: string[]): void {
    this.selectedTypes.set(values);
    this.reapplyDropdownFilters();
  }

  /** Handler for the Credential status checkbox-dropdown (live filtering, AC-2.3). */
  public onStatusFilterChange(values: string[]): void {
    this.selectedStatuses.set(values);
    this.reapplyDropdownFilters();
  }

  /** "Clear all" — resets subject search and the three checkbox-dropdown filters (AC-2.1). */
  public clearFilters(): void {
    this.selectedOrganizations.set([]);
    this.selectedTypes.set([]);
    this.selectedStatuses.set([]);
    this.searchSubject.next('');
    if (this.searchInput?.nativeElement) {
      this.searchInput.nativeElement.value = '';
    }
    this.applyCompoundFilter('');

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  private initializeCredentialTable(): void {
    this.isLoading = true;
    this.hasLoadError = false;
    this.credentialProcedureService.fetchCredentialProcedures()
    .pipe(take(1))
    .subscribe({
      next: (data: CredentialProceduresResponse) => {
        // No separate Archived view — every status (including ARCHIVED) loads
        // into the same table; the filter predicate hides ARCHIVED by default.
        const withClass = this.statusService.addStatusClass(data.credential_procedures);
        this.dataSource.data = withClass;
        this.originData = withClass;

        // Show tenant column when cross-tenant data is present (platform admin view)
        this.hasTenantColumn.set(data.credential_procedures.some(p => !!p.credential_procedure.tenant));
        this.computeFilterOptions(withClass);

        // Explicitly (re)applies the compound filter against the freshly loaded
        // data — setting dataSource.data alone does not reliably re-run
        // filteredData, so without this, "hide ARCHIVED by default" would only
        // take effect once the user first touches a filter control.
        this.applyCompoundFilter(this.currentSubjectFilter());

        this.isLoading = false;
        this.cd.detectChanges();
        this.dataSource.paginator = this.paginator;
        this.setDataSortingAccessor();
        this.dataSource.sort = this.sort;
      },
      error: (error) => {
        console.error('Error fetching credentials for table', error);
        this.isLoading = false;
        this.hasLoadError = true;
      }
    });
  }

  /**
   * Derives the Organization/Type filter dropdown options from the already-loaded
   * dataset (AC-2.2) — runs after the table has rendered, never blocking initial load.
   */
  private computeFilterOptions(rows: CredentialProcedureWithClass[]): void {
    const organizations = new Map<string, string>();
    const types = new Map<string, string>();

    for (const row of rows) {
      const procedure = row.credential_procedure;
      if (procedure?.organization_identifier && !organizations.has(procedure.organization_identifier)) {
        organizations.set(procedure.organization_identifier, procedure.organization_identifier);
      }
      if (procedure?.credential_type) {
        const familyKey = this.getTypeFamilyKey(procedure.credential_type);
        if (!types.has(familyKey)) {
          types.set(familyKey, this.getCredentialTypeLabel(procedure.credential_type));
        }
      }
    }

    this.organizationOptions.set(
      [...organizations.entries()]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label))
    );
    this.typeOptions.set(
      [...types.entries()]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label))
    );
  }

  /**
   * Groups every version — legacy or current — of the employee/machine/label
   * credential types under one canonical bucket, so the Type filter offers one
   * "Employee"/"Machine"/"Label Credential" option instead of one per raw
   * credential_type string (e.g. legacy "LEARCredentialEmployee" vs current
   * "learcredential.employee.w3c.4" used to show up as two separate options).
   * Anything outside these three families (doctorid, PID, ...) keeps its own
   * raw value as its bucket — one option per type, as before.
   */
  private getTypeFamilyKey(credentialType: string): string {
    if (/employee/i.test(credentialType)) return 'EMPLOYEE';
    if (/machine/i.test(credentialType)) return 'MACHINE';
    if (/label/i.test(credentialType)) return 'LABEL';
    return credentialType;
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
          return Number.isFinite(t) ? t : 0;
        }
        case 'updated': {
          const t = Date.parse(procedure?.updated ?? '');
          return Number.isFinite(t) ? t : 0;
        }
        case 'credential_type': {
          // Sorts by the displayed (grouped) label, not the raw type string, so
          // e.g. all "Employee" rows (legacy and current) sort together.
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
   * Compound filter predicate (AD-2).
   * dataSource.filter is a JSON-serialized CredentialFilter: subject is AND'd with
   * organizations/types/statuses; each of those three facets is OR-within-facet
   * (any selected value matches) and AND-across-facets. Empty string/array means
   * "no filter" for that facet — EXCEPT statuses, where an empty selection means
   * "no filter other than hiding ARCHIVED" (no separate Archived view; the user
   * opts in to seeing archived credentials by checking that status explicitly).
   * Robust against empty/undefined filter string (ES-01).
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
        ? parsed.types.includes(this.getTypeFamilyKey(procedure?.credential_type ?? ''))
        : true;

      const statusMatch = parsed.statuses?.length
        ? parsed.statuses.includes(procedure?.status)
        : procedure?.status !== 'ARCHIVED';

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
