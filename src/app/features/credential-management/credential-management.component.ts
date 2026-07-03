import { CREDENTIAL_MANAGEMENT_SEARCH_PLACEHOLDER_SUBJECT } from './../../core/constants/translations.constants';
import { AfterViewInit, ChangeDetectorRef, Component, OnInit, inject, ViewChild, DestroyRef, ElementRef, computed } from '@angular/core';
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
import { debounceTime, Subject, take } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { MatIcon } from '@angular/material/icon';
import { CredentialFilter, CredentialProcedureWithClass, FILTERABLE_STATUSES, Filter, FilterConfig } from 'src/app/core/models/entity/lear-credential-management';
import { LifeCycleStatusService } from 'src/app/shared/services/life-cycle-status.service';
import { RoleType } from 'src/app/core/models/enums/auth-rol-type.enum';

import { SubjectComponent } from './components/subject-component/subject-component.component';
import { FormsModule } from '@angular/forms';
import { CREDENTIAL_MANAGEMENT_SUBJECT } from 'src/app/core/constants/translations.constants';
import { CapitalizePipe } from 'src/app/shared/pipes/capitalize.pipe';
import { SkeletonLoaderComponent } from 'src/app/shared/components/skeleton-loader/skeleton-loader.component';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';



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
        MatPaginator,
        DatePipe,
        SubjectComponent,
        TranslatePipe,
        CapitalizePipe,
        SkeletonLoaderComponent,
        RouterLink,
        RouterLinkActive,
        MatTabsModule,
        MatSelectModule
    ],
    animations: [
        trigger('openClose', [
            state('open', style({
                width: '200px',
                opacity: 1,
            })),
            state('closed', style({
                width: '0px',
                opacity: 0,
            })),
            transition('open => closed', [animate('0.2s')]),
            transition('closed => open', [animate('0.2s')]),
        ]),
    ]
})
export class CredentialManagementComponent implements OnInit, AfterViewInit {
  @ViewChild(MatPaginator) public paginator!: MatPaginator;
  @ViewChild(MatSort) public sort!: MatSort;
  @ViewChild('searchInput') public searchInput!: ElementRef<HTMLInputElement>;
  public displayedColumns: string[] = ['subject', 'organization_identifier', 'credential_type', 'updated', 'status'];
  public dataSource = new MatTableDataSource<CredentialProcedureWithClass>();
  public isSearchByOrganizationFilterChecked = false;
  public searchLabel = CREDENTIAL_MANAGEMENT_SUBJECT;
  public searchPlaceholder = CREDENTIAL_MANAGEMENT_SEARCH_PLACEHOLDER_SUBJECT;
  public isLoading = true;

  /** Status value currently selected in the status filter control. Empty string means "All". */
  public selectedStatus: string = '';

  /** True when the initial credential load failed (ES-02). Prevents showing empty-state as "no matches". */
  public hasLoadError: boolean = false;

  /** Read-only list of statuses shown in the filter dropdown (excludes ARCHIVED). */
  public readonly filterableStatuses = FILTERABLE_STATUSES;

  /** Snapshot of the full dataset after load — used to distinguish "no credentials" from "no matches". */
  private originData: CredentialProcedureWithClass[] = [];

  public hideSearchBar: boolean = true;

  // computed
  public readonly canWrite = computed(() => this.authService.roleType() !== RoleType.SYSADMIN_READONLY);
  public readonly isAdminOrganizationIdentifier = computed(() =>
    this.authService.roleType() === RoleType.TENANT_ADMIN && this.authService.tenantType() === 'multi_org'
  );

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

  private readonly authService = inject(AuthService);
  private readonly credentialProcedureService = inject(CredentialProcedureService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly statusService = inject(LifeCycleStatusService);
  private readonly cd = inject(ChangeDetectorRef);
  private readonly translate = inject(TranslateService);
  private readonly searchSubject = new Subject<string>();

  /** FilterConfig map for text-search filters only. The status filter uses a separate mat-select control. */
  private readonly filtersMap: Partial<Record<Filter, FilterConfig>> = {
    subject: {
      filterName: "subject",
      translationLabel: CREDENTIAL_MANAGEMENT_SUBJECT,
      placeholderTranslationLabel: CREDENTIAL_MANAGEMENT_SEARCH_PLACEHOLDER_SUBJECT
    }
   } as const;

  public ngOnInit() {
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

  public onRowClick(row: CredentialProcedureBasicInfo): void {
    this.navigateToCredentialDetails(row);
  }

  public navigateToCredentialDetails(credential_procedures: CredentialProcedureBasicInfo): void {
    this.router.navigate([
      '/organization/credentials/details',
      credential_procedures.credential_procedure?.procedure_id
    ]);
  }

  public toggleSearchBar(){
    this.hideSearchBar = !this.hideSearchBar;
    const searchInputNativeEl = this.searchInput.nativeElement;

    if (this.hideSearchBar) {

      this.searchSubject.next('');

      if (this.searchInput) {
        searchInputNativeEl.value = '';
      }

      if (this.dataSource.paginator) {
        this.dataSource.paginator.firstPage();
      }
    }else{
      searchInputNativeEl.focus();
      searchInputNativeEl.select();
    }
  }

  public onSearchStringChange(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.searchSubject.next(filterValue);
  }

  public getCredentialTypeLabel(credentialType: string): string {
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

  private initializeCredentialTable(): void {
    this.isLoading = true;
    this.hasLoadError = false;
    this.credentialProcedureService.fetchCredentialProcedures()
    .pipe(take(1))
    .subscribe({
      next: (data: CredentialProceduresResponse) => {
        const activeCredentials = data.credential_procedures.filter(
          p => p.credential_procedure.status !== 'ARCHIVED'
        );
        const withClass = this.statusService.addStatusClass(activeCredentials);
        this.dataSource.data = withClass;
        this.originData = withClass;

        // Show tenant column when cross-tenant data is present (platform admin view)
        const hasTenantData = data.credential_procedures.some(p => !!p.credential_procedure.tenant);
        if (hasTenantData && !this.displayedColumns.includes('tenant')) {
          this.displayedColumns = ['tenant', ...this.displayedColumns];
        }

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

  private setDataSortingAccessor(): void{
    this.dataSource.sortingDataAccessor = (item: CredentialProcedureBasicInfo, property: string) => {
      switch (property) {
        case 'status': {
          const status = item.credential_procedure.status.toLowerCase();
          return status === 'withdrawn' ? 'draft' : status;
        }
        case 'subject': {
          return item.credential_procedure.subject.toLowerCase();
        }
        case 'updated': {
          const t = Date.parse(item.credential_procedure.updated);
          return Number.isFinite(t) ? t : 0;
        }
        case 'credential_type': {
          return item.credential_procedure.credential_type.toLowerCase();
        }
        case 'organization_identifier': {
          return item.credential_procedure.organization_identifier.toLowerCase();
        }
        case 'tenant': {
          return (item.credential_procedure.tenant ?? '').toLowerCase();
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
   * dataSource.filter is a JSON-serialized CredentialFilter: { subject, status }.
   * Both fields are evaluated in AND. An empty string means "no filter" for that field.
   * Robust against empty/undefined filter string (ES-01).
   */
  private setFilterPredicate(): void{
    this.dataSource.filterPredicate = (data: CredentialProcedureBasicInfo, filterString: string) => {
      let parsed: CredentialFilter = { subject: '', status: '' };
      try {
        parsed = filterString ? JSON.parse(filterString) : { subject: '', status: '' };
      } catch {
        // Malformed filter string — treat as no filter
      }

      const subjectMatch = parsed.subject
        ? data.credential_procedure.subject.toLowerCase().includes(parsed.subject.trim().toLowerCase())
        : true;

      const statusMatch = parsed.status
        ? data.credential_procedure.status === parsed.status
        : true;

      return subjectMatch && statusMatch;
    };
  }

  /** Builds and sets the serialized CredentialFilter on the dataSource. */
  private applyCompoundFilter(subject: string, status: string): void {
    const filter: CredentialFilter = { subject: subject.trim(), status };
    this.dataSource.filter = JSON.stringify(filter);
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
        this.applyCompoundFilter(searchValue, this.selectedStatus);

        if (this.dataSource.paginator) {
          this.dataSource.paginator.firstPage();
        }
    });
  }

  /**
   * Handler for status filter control changes (AC-01, AC-03, EC-04).
   * Resets paginator to first page on each change.
   */
  public onStatusFilterChange(status: string): void {
    this.selectedStatus = status;
    const currentSubject = this.getCurrentSubjectFilter();
    this.applyCompoundFilter(currentSubject, status);

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  /**
   * Clears both filters and resets the paginator to first page (AC-05).
   */
  public clearFilters(): void {
    this.selectedStatus = '';
    this.searchSubject.next('');
    // Also clear the input element if search bar is visible
    if (!this.hideSearchBar && this.searchInput?.nativeElement) {
      this.searchInput.nativeElement.value = '';
    }
    this.applyCompoundFilter('', '');

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  /** Extracts the current subject value from the serialized dataSource.filter (safe). */
  private getCurrentSubjectFilter(): string {
    try {
      const parsed: CredentialFilter = this.dataSource.filter
        ? JSON.parse(this.dataSource.filter)
        : { subject: '', status: '' };
      return parsed.subject ?? '';
    } catch {
      return '';
    }
  }

}
