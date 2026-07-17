import { AfterViewInit, ChangeDetectorRef, Component, DestroyRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { MatTableDataSource, MatTable, MatColumnDef, MatHeaderCellDef, MatHeaderCell, MatCellDef, MatCell, MatHeaderRowDef, MatHeaderRow, MatRowDef, MatRow } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort, MatSortHeader } from '@angular/material/sort';
import { Router } from '@angular/router';
import { CredentialProcedureService } from 'src/app/core/services/credential-procedure.service';
import { CredentialProcedureBasicInfo, CredentialProceduresResponse } from 'src/app/core/models/dto/credential-procedures-response.dto';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { NgClass, DatePipe } from '@angular/common';
import { MatButton, MatButtonModule } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { debounceTime, Subject, take } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { MatIcon } from '@angular/material/icon';
import { CredentialProcedureWithClass, Filter, FilterConfig } from 'src/app/core/models/entity/lear-credential-management';
import { LifeCycleStatusService } from 'src/app/shared/services/life-cycle-status.service';
import { SubjectComponent } from '../components/subject-component/subject-component.component';
import { FormsModule } from '@angular/forms';
import { CREDENTIAL_MANAGEMENT_SEARCH_PLACEHOLDER_SUBJECT, CREDENTIAL_MANAGEMENT_SUBJECT } from 'src/app/core/constants/translations.constants';
import { CapitalizePipe } from 'src/app/shared/pipes/capitalize.pipe';
import { SkeletonLoaderComponent } from 'src/app/shared/components/skeleton-loader/skeleton-loader.component';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-archived-credentials',
  templateUrl: './archived-credentials.component.html',
  styleUrls: ['./archived-credentials.component.scss'],
  imports: [
    FormsModule,
    MatTabsModule,
    RouterLink,
    RouterLinkActive,
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
  ],
  animations: [
    trigger('openClose', [
      state('open', style({ width: '200px', opacity: 1 })),
      state('closed', style({ width: '0px', opacity: 0 })),
      transition('open => closed', [animate('0.2s')]),
      transition('closed => open', [animate('0.2s')]),
    ]),
  ],
})
export class ArchivedCredentialsComponent implements OnInit, AfterViewInit {
  @ViewChild(MatPaginator) public paginator!: MatPaginator;
  @ViewChild(MatSort) public sort!: MatSort;
  @ViewChild('searchInput') public searchInput!: ElementRef<HTMLInputElement>;

  public displayedColumns: string[] = ['subject', 'organization_identifier', 'credential_type', 'updated', 'status'];
  public dataSource = new MatTableDataSource<CredentialProcedureWithClass>();
  public isLoading = true;
  public hideSearchBar: boolean = true;
  public searchLabel = CREDENTIAL_MANAGEMENT_SUBJECT;
  public searchPlaceholder = CREDENTIAL_MANAGEMENT_SEARCH_PLACEHOLDER_SUBJECT;

  private readonly credentialProcedureService = inject(CredentialProcedureService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly statusService = inject(LifeCycleStatusService);
  private readonly cd = inject(ChangeDetectorRef);
  private readonly translate = inject(TranslateService);
  private readonly searchSubject = new Subject<string>();

  /** FilterConfig map for text-search filters only (archived view has no status filter dropdown). */
  private readonly filtersMap: Partial<Record<Filter, FilterConfig>> = {
    subject: {
      filterName: 'subject',
      translationLabel: CREDENTIAL_MANAGEMENT_SUBJECT,
      placeholderTranslationLabel: CREDENTIAL_MANAGEMENT_SEARCH_PLACEHOLDER_SUBJECT,
    },
  } as const;

  public ngOnInit(): void {
    this.initializeArchivedTable();
  }

  public ngAfterViewInit(): void {
    this.setFilter('subject');
    this.setStringSearchSubscription();
  }

  public onRowClick(row: CredentialProcedureBasicInfo): void {
    this.router.navigate([
      '/organization/credentials/details',
      row.credential_procedure?.procedure_id,
    ]);
  }

  public toggleSearchBar(): void {
    this.hideSearchBar = !this.hideSearchBar;
    const searchInputNativeEl = this.searchInput.nativeElement;

    if (this.hideSearchBar) {
      this.searchSubject.next('');
      searchInputNativeEl.value = '';
      if (this.dataSource.paginator) {
        this.dataSource.paginator.firstPage();
      }
    } else {
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
    if (translated !== prefixedKey) return translated;

    const fallbackVersionKey = prefixedKey.replace(/\.\d+$/, '.1');
    const fallbackVersionTranslated = this.translate.instant(fallbackVersionKey);
    if (fallbackVersionTranslated !== fallbackVersionKey) return fallbackVersionTranslated;

    const fallbackWithoutVersionKey = prefixedKey.replace(/\.\d+$/, '');
    const fallbackWithoutVersionTranslated = this.translate.instant(fallbackWithoutVersionKey);
    if (fallbackWithoutVersionTranslated !== fallbackWithoutVersionKey) return fallbackWithoutVersionTranslated;

    return credentialType;
  }

  private initializeArchivedTable(): void {
    this.isLoading = true;
    this.credentialProcedureService.fetchCredentialProcedures()
      .pipe(take(1))
      .subscribe({
        next: (data: CredentialProceduresResponse) => {
          const archivedCredentials = data.credential_procedures.filter(
            (p) => p.credential_procedure.status === 'ARCHIVED'
          );
          this.dataSource.data = this.statusService.addStatusClass(archivedCredentials);

          const hasTenantData = data.credential_procedures.some((p) => !!p.credential_procedure.tenant);
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
          console.error('Error fetching archived credentials', error);
          this.isLoading = false;
        },
      });
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

  private setDataSortingAccessor(): void {
    this.dataSource.sortingDataAccessor = (item: CredentialProcedureBasicInfo, property: string) => {
      const procedure = item.credential_procedure;
      const procedureId = procedure?.procedure_id;
      switch (property) {
        case 'status':
          return this.getSafeLowerCaseValue(procedure?.status, 'status', procedureId);
        case 'subject':
          return this.getSafeLowerCaseValue(procedure?.subject, 'subject', procedureId);
        case 'updated': {
          const t = Date.parse(procedure?.updated ?? '');
          return Number.isFinite(t) ? t : 0;
        }
        case 'credential_type':
          return this.getSafeLowerCaseValue(procedure?.credential_type, 'credential_type', procedureId);
        case 'organization_identifier':
          return this.getSafeLowerCaseValue(procedure?.organization_identifier, 'organization_identifier', procedureId);
        case 'tenant':
          return this.getSafeLowerCaseValue(procedure?.tenant, 'tenant', procedureId);
        default:
          return '';
      }
    };
  }

  private setFilter(filter: Filter): void {
    this.setFilterLabelAndPlaceholder(filter);
    this.setFilterPredicate(filter);
  }

  private setFilterPredicate(filter: Filter): void {
    this.dataSource.filterPredicate = (data: CredentialProcedureBasicInfo, filterString: string) => {
      const searchString = filterString.trim().toLowerCase();
      const procedure = data.credential_procedure;
      const value = this.getSafeLowerCaseValue(procedure?.[filter], filter, procedure?.procedure_id);
      return value.includes(searchString);
    };
  }

  private setFilterLabelAndPlaceholder(filter: Filter): void {
    const filterConfig: FilterConfig | undefined = this.filtersMap[filter];
    if (!filterConfig) return;
    this.searchLabel = filterConfig.translationLabel;
    this.searchPlaceholder = filterConfig.placeholderTranslationLabel;
  }

  private setStringSearchSubscription(): void {
    this.searchSubject
      .pipe(debounceTime(500), takeUntilDestroyed(this.destroyRef))
      .subscribe((searchValue) => {
        this.dataSource.filter = searchValue.trim().toLowerCase();
        if (this.dataSource.paginator) {
          this.dataSource.paginator.firstPage();
        }
      });
  }
}
