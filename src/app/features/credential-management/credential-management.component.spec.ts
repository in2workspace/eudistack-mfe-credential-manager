import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CredentialManagementComponent } from './credential-management.component';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router, ActivatedRoute, RouterModule, convertToParamMap, ParamMap } from '@angular/router';
import { CredentialProcedureService } from 'src/app/core/services/credential-procedure.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { RoleType } from 'src/app/core/models/enums/auth-rol-type.enum';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { provideHttpClient } from '@angular/common/http';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { CredentialActionsService } from '../credential-details/services/credential-actions.service';
import { CredentialDetailsDrawerComponent, CredentialDetailsDrawerData } from '../credential-details/credential-details-drawer/credential-details-drawer.component';
import { LifeCycleStatusService } from 'src/app/shared/services/life-cycle-status.service';
import { CredentialFilter, CredentialProcedureWithClass } from 'src/app/core/models/entity/lear-credential-management';
import { CredentialProcedureBasicInfo, CredentialProceduresResponse } from 'src/app/core/models/dto/credential-procedures-response.dto';
import { signal } from '@angular/core';

describe('CredentialManagementComponent', () => {
  let queryParamMap$: BehaviorSubject<ParamMap>;
  let component: CredentialManagementComponent;
  let fixture: ComponentFixture<CredentialManagementComponent>;
  let credentialProcedureService: CredentialProcedureService;
  let credentialProcedureSpy: jest.SpyInstance;
  let authService: jest.Mocked<any>;
  let router: Router;
  let statusService: LifeCycleStatusService;

  beforeEach(async () => {
    queryParamMap$ = new BehaviorSubject(convertToParamMap({}));
    authService = {
      getMandator: () => of(null),
      getName: () => of('Name'),
      getToken: () => of('token'),
      logout: () => of(void 0),
      hasPower: () => true,
      hasAdminOrganizationIdentifier: jest.fn().mockReturnValue(true),
      getUserRole: jest.fn().mockReturnValue(RoleType.TENANT_ADMIN),
      roleType: signal(RoleType.TENANT_ADMIN),
      tenantType: signal('multi_org'),
    } as jest.Mocked<any>;

    await TestBed.configureTestingModule({
      imports: [
        NoopAnimationsModule,
        MatTableModule,
        MatPaginatorModule,
        RouterModule.forRoot([]),
        TranslateModule.forRoot({}),
        CredentialManagementComponent, // standalone
      ],
      providers: [
        CredentialProcedureService,
        TranslateService,
        { provide: AuthService, useValue: authService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => '1' }, queryParamMap: convertToParamMap({}) },
            queryParamMap: queryParamMap$.asObservable(),
          },
        },
        provideHttpClient(),
      ],
    }).compileComponents();

    credentialProcedureService = TestBed.inject(CredentialProcedureService);
    credentialProcedureSpy = jest.spyOn(credentialProcedureService, 'fetchCredentialProcedures');
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate');
    statusService = TestBed.inject(LifeCycleStatusService);
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CredentialManagementComponent);
    component = fixture.componentInstance;
    // avoid error in ngOnInit
    credentialProcedureSpy.mockReturnValue(of({ credential_procedures: [] } as CredentialProceduresResponse));
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.resetAllMocks();
    TestBed.resetTestingModule();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should return true for isAdminOrganizationIdentifier and canWrite when roleType is TENANT_ADMIN', () => {
    authService.roleType.set(RoleType.TENANT_ADMIN);
    expect(component.isAdminOrganizationIdentifier()).toBe(true);
    expect(component.canWrite()).toBe(true);
  });

  it('should return false for canWrite and isAdminOrganizationIdentifier when roleType is SYSADMIN_READONLY', () => {
    authService.roleType.set(RoleType.SYSADMIN_READONLY);
    expect(component.canWrite()).toBe(false);
    expect(component.isAdminOrganizationIdentifier()).toBe(false);
  });

  it('should return false for isAdminOrganizationIdentifier and true for canWrite when roleType is LEAR', () => {
    authService.roleType.set(RoleType.LEAR);
    expect(component.isAdminOrganizationIdentifier()).toBe(false);
    expect(component.canWrite()).toBe(true);
  });

  it('should call initializeCredentialTable on ngOnInit', () => {
    // Spy on the private method
    const loadSpy = jest.spyOn(component as any, 'initializeCredentialTable');
    component.ngOnInit();
    expect(loadSpy).toHaveBeenCalledTimes(1);
  });

  it('should set dataSource filter and reset paginator on search', fakeAsync(() => {
    // attach a real-ish paginator so firstPage exists
    component.dataSource['_paginator'] = { firstPage: jest.fn() } as any;
    const paginatorSpy = jest.spyOn(component.dataSource.paginator!, 'firstPage');

    component['searchSubject'].next('FOO');
    tick(500); // debounce

    // filter is now a JSON-serialized CredentialFilter
    const parsed: CredentialFilter = JSON.parse(component.dataSource.filter);
    expect(parsed.subject).toBe('FOO'); // raw trimmed value; predicate lowercases on eval
    expect(parsed.statuses).toEqual([]);
    expect(paginatorSpy).toHaveBeenCalled();
  }));

  it('should set dataSource filter and not reset paginator if paginator is undefined', fakeAsync(() => {
    // force paginator undefined
    jest.spyOn(component.dataSource, 'paginator', 'get').mockReturnValue(null);
    const paginator = component.dataSource.paginator;
    component['searchSubject'].next('BAR');
    tick(500); // debounce

    const parsed: CredentialFilter = JSON.parse(component.dataSource.filter);
    expect(parsed.subject).toBe('BAR'); // raw trimmed value; predicate lowercases on eval
    expect(paginator).toBeNull(); // no error nor firstPage call expected
  }));

  it('should run all setup functions inside ngAfterViewInit', () => {
    const filterPredicateSpy = jest.spyOn(component as any, 'setFilterPredicate');
    const searchSubSpy = jest.spyOn(component as any, 'setStringSearchSubscription');

    component.ngAfterViewInit();

    // setFilterPredicate no longer takes a filter argument (compound predicate)
    expect(filterPredicateSpy).toHaveBeenCalledTimes(1);
    expect(searchSubSpy).toHaveBeenCalledTimes(1);
  });

  it('should configure sortingDataAccessor correctly (status, subject, updated, credential_type, organization_identifier)', () => {
    (component as any).setDataSortingAccessor();
    const mockItem: any = {
      credential_procedure: {
        procedure_id: 'id-proc',
        status: 'WITHDRAWN',
        subject: 'Subject Test',
        updated: '2024-10-20',
        credential_type: 'Type Test',
        organization_identifier: 'ORG-ABC-123'
      },
    };
    expect(component.dataSource.sortingDataAccessor(mockItem, 'status')).toBe('draft');
    expect(component.dataSource.sortingDataAccessor(mockItem, 'subject')).toBe('subject test');
    expect(component.dataSource.sortingDataAccessor(mockItem, 'updated')).toBe(Date.parse('2024-10-20'));
    expect(component.dataSource.sortingDataAccessor(mockItem, 'credential_type')).toBe('type test');
    expect(component.dataSource.sortingDataAccessor(mockItem, 'organization_identifier')).toBe('org-abc-123');
    expect(component.dataSource.sortingDataAccessor(mockItem, 'unknown')).toBe('');
  });

  it('should configure compound filterPredicate after ngAfterViewInit', () => {
    component.ngAfterViewInit(); // sets compound predicate
    const mockItem: any = {
      credential_procedure: { subject: 'My Fancy Subject', status: 'VALID', organization_identifier: 'ORG-1', credential_type: 'type-a' }
    };
    // subject match, no other filters
    const filterAll = JSON.stringify({ subject: 'fancy', organizations: [], types: [], statuses: [] });
    expect(component.dataSource.filterPredicate!(mockItem, filterAll)).toBe(true);
    // subject no match
    const filterNoSubject = JSON.stringify({ subject: 'xyz', organizations: [], types: [], statuses: [] });
    expect(component.dataSource.filterPredicate!(mockItem, filterNoSubject)).toBe(false);
    // status match (OR-within-facet), no subject filter
    const filterStatus = JSON.stringify({ subject: '', organizations: [], types: [], statuses: ['VALID', 'DRAFT'] });
    expect(component.dataSource.filterPredicate!(mockItem, filterStatus)).toBe(true);
    // status no match
    const filterStatusNo = JSON.stringify({ subject: '', organizations: [], types: [], statuses: ['REVOKED'] });
    expect(component.dataSource.filterPredicate!(mockItem, filterStatusNo)).toBe(false);
    // organization + type facets, AND-across-facets
    const filterOrgType = JSON.stringify({ subject: '', organizations: ['ORG-1'], types: ['type-a'], statuses: [] });
    expect(component.dataSource.filterPredicate!(mockItem, filterOrgType)).toBe(true);
    const filterOrgNoMatch = JSON.stringify({ subject: '', organizations: ['ORG-2'], types: [], statuses: [] });
    expect(component.dataSource.filterPredicate!(mockItem, filterOrgNoMatch)).toBe(false);
  });

  it('should call searchSubject.next with input value when onSearchStringChange is triggered', () => {
    const nextSpy = jest.spyOn(component['searchSubject'], 'next');
    const event = { target: { value: 'searchTerm' } } as unknown as Event;

    component.onSearchStringChange(event);

    expect(nextSpy).toHaveBeenCalledWith('searchTerm');
  });


  it('should call searchSubject.next with the correct filter value', () => {
    const event = { target: { value: 'searchTerm'} } as any;
    const nextSpy = jest.spyOn(component['searchSubject'], 'next');
    component.onSearchStringChange(event);
    expect(nextSpy).toHaveBeenCalledWith('searchTerm');
  });

  it('should load credential data and update dataSource', fakeAsync(() => {
    const mockProc: CredentialProcedureBasicInfo = {
      credential_procedure: {
        procedure_id: 'id1',
        subject: 'S1',
        status: 'DRAFT',
        updated: '2025-07-01',
        credential_type: 'LEAR_CREDENTIAL_EMPLOYEE',
        email: 'email',
        organization_identifier: 'VATES-000000',
        created_at: '2025-01-01T00:00:00Z',
        expires_at: '2026-01-01T00:00:00Z',
      },
    };
    const mockResponse = { credential_procedures: [mockProc] } as CredentialProceduresResponse;
    credentialProcedureSpy.mockReturnValue(of(mockResponse));
    const withClass: CredentialProcedureWithClass[] = [{ ...mockProc, statusClass: 'status-active' }];
    const statusSpy = jest.spyOn(statusService, 'addStatusClass').mockReturnValue(withClass);
    const cdSpy = jest.spyOn(component['cd'], 'detectChanges');

    component['initializeCredentialTable']();
    tick();

    expect(credentialProcedureSpy).toHaveBeenCalled();
    expect(statusSpy).toHaveBeenCalledWith(mockResponse.credential_procedures);
    expect(component.dataSource.data).toEqual(withClass);
    expect(cdSpy).toHaveBeenCalled();
    expect(component.dataSource.paginator).toBeDefined();
    expect(component.dataSource.sort).toBeDefined();
    expect(component.dataSource.sortingDataAccessor).toBeDefined();
  }));

  it('should log an error if fetchCredentialProcedures fails', fakeAsync(() => {
    const error = new Error('oops');
    credentialProcedureSpy.mockReturnValue(throwError(() => error));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    component['initializeCredentialTable']();
    tick();

    expect(consoleSpy).toHaveBeenCalledWith('Error fetching credentials for table', error);
    consoleSpy.mockRestore();
  }));

  it('should set searchLabel and searchPlaceholder according to filter config', () => {
  // Call private method with "subject"
  (component as any).setFilterLabelAndPlaceholder('subject');
  const subjectConfig = component['filtersMap']['subject']!; // subject always exists
  expect(component.searchLabel).toBe(subjectConfig.translationLabel);
  expect(component.searchPlaceholder).toBe(subjectConfig.placeholderTranslationLabel);
});

it('groups every employee credential_type — legacy or current — under one "Employee" label', () => {
  const translate = TestBed.inject(TranslateService);
  jest.spyOn(translate, 'instant').mockImplementation((key: string | string[]) => {
    if (key === 'credentialManagement.typeFamily.employee') return 'Employee';
    return key;
  });

  expect(component.getCredentialTypeLabel('learcredential.employee.w3c.4')).toBe('Employee');
  expect(component.getCredentialTypeLabel('learcredential.employee.sd.1')).toBe('Employee');
  expect(component.getCredentialTypeLabel('LEARCredentialEmployee')).toBe('Employee'); // legacy v2/v3 bare DOME name
});

it('groups every machine credential_type — legacy or current — under one "Machine" label', () => {
  const translate = TestBed.inject(TranslateService);
  jest.spyOn(translate, 'instant').mockImplementation((key: string | string[]) => {
    if (key === 'credentialManagement.typeFamily.machine') return 'Machine';
    return key;
  });

  expect(component.getCredentialTypeLabel('learcredential.machine.w3c.3')).toBe('Machine');
  expect(component.getCredentialTypeLabel('LEARCredentialMachine')).toBe('Machine'); // legacy v1/v2 bare DOME name
});

it('groups every label credential_type — legacy or current — under one "Label Credential" label', () => {
  const translate = TestBed.inject(TranslateService);
  jest.spyOn(translate, 'instant').mockImplementation((key: string | string[]) => {
    if (key === 'credentialManagement.typeFamily.label') return 'Label Credential';
    return key;
  });

  expect(component.getCredentialTypeLabel('gx.labelcredential.w3c.2')).toBe('Label Credential');
  expect(component.getCredentialTypeLabel('gx:LabelCredential')).toBe('Label Credential'); // legacy v1
});

it('should return direct translated credential type when key exists (types outside the employee/machine/label families)', () => {
  const translate = TestBed.inject(TranslateService);
  jest.spyOn(translate, 'instant').mockImplementation((key: string | string[]) => {
    if (key === 'credentialManagement.doctorid.sd.1') {
      return 'Doctor ID';
    }
    return key;
  });

  expect(component.getCredentialTypeLabel('doctorid.sd.1')).toBe('Doctor ID');
});

it('should fallback to .1 translation when current version key is missing (types outside the employee/machine/label families)', () => {
  const translate = TestBed.inject(TranslateService);
  jest.spyOn(translate, 'instant').mockImplementation((key: string | string[]) => {
    if (key === 'credentialManagement.doctorid.sd.1') {
      return 'Doctor ID';
    }
    return key;
  });

  // No exact key for "doctorid.sd.2" — falls back to the ".1" version key
  expect(component.getCredentialTypeLabel('doctorid.sd.2')).toBe('Doctor ID');
});

it('should subscribe to searchSubject and update dataSource.filter (and call firstPage if paginator exists)', fakeAsync(() => {
  // Attach paginator mock with firstPage spy
  component.dataSource['_paginator'] = { firstPage: jest.fn() } as any;
  const firstPageSpy = jest.spyOn(component.dataSource.paginator!, 'firstPage');

  // Manually call the private subscription setup
  (component as any).setStringSearchSubscription();

  // Emit value into searchSubject
  component['searchSubject'].next('  Foo  ');
  tick(500); // simulate debounceTime(500)

  // filter is now a JSON-serialized CredentialFilter
  const parsed: CredentialFilter = JSON.parse(component.dataSource.filter);
  expect(parsed.subject).toBe('Foo'); // trimmed (not lowercased at JSON level, predicate lowercases on eval)
  expect(firstPageSpy).toHaveBeenCalled();
}));

it('should update filter even if paginator is undefined', fakeAsync(() => {
  // Ensure paginator is undefined
  jest.spyOn(component.dataSource, 'paginator', 'get').mockReturnValue(null);

  (component as any).setStringSearchSubscription();

  component['searchSubject'].next('Bar');
  tick(500);

  const parsed: CredentialFilter = JSON.parse(component.dataSource.filter);
  expect(parsed.subject).toBe('Bar');
  // no error and no paginator call
}));

  describe('ARCHIVED handling — no separate view, filtered like any other status', () => {
    const makeProc = (id: string, status: string): CredentialProcedureBasicInfo => ({
      credential_procedure: {
        procedure_id: id,
        subject: `Subject ${id}`,
        status: status as any,
        updated: '2025-01-01',
        credential_type: 'LEAR_CREDENTIAL_EMPLOYEE',
        email: 'a@b.com',
        organization_identifier: 'VATES-000000',
        created_at: '2025-01-01T00:00:00Z',
        expires_at: '2026-01-01T00:00:00Z',
      },
    });

    it('loads ARCHIVED credentials into dataSource.data (no separate view/exclusion)', fakeAsync(() => {
      const archivedProc = makeProc('arch-1', 'ARCHIVED');
      const withClass: CredentialProcedureWithClass[] = [{ ...archivedProc, statusClass: 'status-archived' }];
      const mockResponse = { credential_procedures: [archivedProc] } as CredentialProceduresResponse;
      credentialProcedureSpy.mockReturnValue(of(mockResponse));
      jest.spyOn(statusService, 'addStatusClass').mockReturnValue(withClass);

      component['initializeCredentialTable']();
      tick();

      expect(component.dataSource.data).toEqual(withClass);
    }));

    it('passes ARCHIVED items to addStatusClass together with every other status', fakeAsync(() => {
      const archivedProc = makeProc('arch-2', 'ARCHIVED');
      const validProc = makeProc('valid-1', 'VALID');
      const withdrawnProc = makeProc('withdrawn-1', 'WITHDRAWN');
      const statusSpy = jest.spyOn(statusService, 'addStatusClass').mockReturnValue([]);

      const mockResponse = {
        credential_procedures: [archivedProc, validProc, withdrawnProc],
      } as CredentialProceduresResponse;
      credentialProcedureSpy.mockReturnValue(of(mockResponse));

      component['initializeCredentialTable']();
      tick();

      expect(statusSpy).toHaveBeenCalledWith([archivedProc, validProc, withdrawnProc]);
    }));

    it('shows ARCHIVED rows in filteredData when no status is selected', fakeAsync(() => {
      const archivedProc = makeProc('arch-3', 'ARCHIVED');
      const validProc = makeProc('valid-2', 'VALID');
      const withClass: CredentialProcedureWithClass[] = [
        { ...archivedProc, statusClass: 'status-archived' },
        { ...validProc, statusClass: 'status-valid' },
      ];
      jest.spyOn(statusService, 'addStatusClass').mockReturnValue(withClass);
      credentialProcedureSpy.mockReturnValue(of({ credential_procedures: [archivedProc, validProc] } as CredentialProceduresResponse));

      // Goes through the real ngOnInit (predicate installed, then data loaded,
      // then the compound filter explicitly (re)applied against it) rather than
      // calling initializeCredentialTable() directly, to exercise the actual
      // production ordering.
      component.ngOnInit();
      tick();

      expect(component.dataSource.filteredData).toEqual(withClass);
    }));

    it('hides ARCHIVED rows when only other statuses are selected', fakeAsync(() => {
      const archivedProc = makeProc('arch-5', 'ARCHIVED');
      const validProc = makeProc('valid-4', 'VALID');
      const withClass: CredentialProcedureWithClass[] = [
        { ...archivedProc, statusClass: 'status-archived' },
        { ...validProc, statusClass: 'status-valid' },
      ];
      jest.spyOn(statusService, 'addStatusClass').mockReturnValue(withClass);
      credentialProcedureSpy.mockReturnValue(of({ credential_procedures: [archivedProc, validProc] } as CredentialProceduresResponse));

      component['initializeCredentialTable']();
      tick();
      component.ngAfterViewInit();

      component.onStatusFilterChange(['VALID']);

      expect(component.dataSource.filteredData).toEqual([{ ...validProc, statusClass: 'status-valid' }]);
    }));

    it('shows only ARCHIVED rows when ARCHIVED is the selected status', fakeAsync(() => {
      const archivedProc = makeProc('arch-4', 'ARCHIVED');
      const validProc = makeProc('valid-3', 'VALID');
      const withClass: CredentialProcedureWithClass[] = [
        { ...archivedProc, statusClass: 'status-archived' },
        { ...validProc, statusClass: 'status-valid' },
      ];
      jest.spyOn(statusService, 'addStatusClass').mockReturnValue(withClass);
      credentialProcedureSpy.mockReturnValue(of({ credential_procedures: [archivedProc, validProc] } as CredentialProceduresResponse));

      component['initializeCredentialTable']();
      tick();
      component.ngAfterViewInit();

      component.onStatusFilterChange(['ARCHIVED']);

      expect(component.dataSource.filteredData).toEqual([{ ...archivedProc, statusClass: 'status-archived' }]);
    }));
  });

  // ---------------------------------------------------------------------------
  // T6 — Compound filter predicate (AC-01, AC-03, AC-05, EC-02, EC-05, ES-01)
  // ---------------------------------------------------------------------------
  describe('T6 — Compound filter predicate', () => {
    /** Factory: creates a minimal CredentialProcedureWithClass fixture. */
    const makeItem = (
      subject: string,
      status: string,
      id = 'id-1'
    ): CredentialProcedureWithClass => ({
      credential_procedure: {
        procedure_id: id,
        subject,
        status: status as any,
        updated: '2025-01-01',
        credential_type: 'LEAR_CREDENTIAL_EMPLOYEE',
        email: 'a@b.com',
        organization_identifier: 'VATES-000000',
        created_at: '2025-01-01T00:00:00Z',
        expires_at: '2026-01-01T00:00:00Z',
      },
      statusClass: `status-${status.toLowerCase()}`,
    });

    beforeEach(() => {
      // Seed datasource with a representative set of credentials
      component['originData'].set([
        makeItem('Alice Smith', 'VALID', 'id-1'),
        makeItem('Bob Jones', 'REVOKED', 'id-2'),
        makeItem('Carol White', 'VALID', 'id-3'),
        makeItem('Dan Brown', 'EXPIRED', 'id-4'),
      ]);
      component.dataSource.data = [...component['originData']()];
      component.ngAfterViewInit(); // sets compound filterPredicate
    });

    // AC-01: filter by status reduces filteredData to only matching rows
    it('AC-01: filtering by status VALID shows only VALID credentials', () => {
      component.onStatusFilterChange(['VALID']);

      const filtered = component.dataSource.filteredData;
      expect(filtered.length).toBe(2);
      filtered.forEach(item =>
        expect(item.credential_procedure.status).toBe('VALID')
      );
    });

    it('AC-01: filtering by status REVOKED shows only REVOKED credentials', () => {
      component.onStatusFilterChange(['REVOKED']);

      const filtered = component.dataSource.filteredData;
      expect(filtered.length).toBe(1);
      expect(filtered[0].credential_procedure.status).toBe('REVOKED');
    });

    it('AC-01: clearing the status selection (empty array) shows all credentials', () => {
      component.onStatusFilterChange(['VALID']);  // first apply a filter
      component.onStatusFilterChange([]);          // then clear it

      expect(component.dataSource.filteredData.length).toBe(4);
    });

    // AC-03: subject + status + sort applied together (AND combination)
    it('AC-03: subject and status filters are evaluated in AND', () => {
      // Apply subject filter via searchSubject
      component.selectedStatuses.set(['VALID']);
      component['applyCompoundFilter']('Alice');

      const filtered = component.dataSource.filteredData;
      expect(filtered.length).toBe(1);
      expect(filtered[0].credential_procedure.subject).toBe('Alice Smith');
      expect(filtered[0].credential_procedure.status).toBe('VALID');
    });

    it('AC-03: subject match + wrong status → no results', () => {
      component.selectedStatuses.set(['REVOKED']);
      component['applyCompoundFilter']('Alice');

      expect(component.dataSource.filteredData.length).toBe(0);
    });

    // AC-05: clearing filter restores the full dataset and resets paginator
    it('AC-05: clearFilters restores full dataset and resets paginator', fakeAsync(() => {
      component.dataSource['_paginator'] = { firstPage: jest.fn() } as any;
      const firstPageSpy = jest.spyOn(component.dataSource.paginator!, 'firstPage');

      component.onStatusFilterChange(['REVOKED']); // narrow dataset
      component.clearFilters();
      tick(500); // debounce for searchSubject.next('')

      const parsed: CredentialFilter = JSON.parse(component.dataSource.filter);
      expect(parsed.subject).toBe('');
      expect(parsed.statuses).toEqual([]);
      expect(component.selectedStatuses()).toEqual([]);
      expect(component.dataSource.filteredData.length).toBe(4);
      expect(firstPageSpy).toHaveBeenCalled();
    }));

    // "Clear all" only covers the three checkbox-dropdown facets: the search box
    // has its own clear button — see hasActiveFilters().
    it('hasActiveFilters ignores a lone subject search', fakeAsync(() => {
      component['searchSubject'].next('Alice');
      tick(500);

      expect(component.hasActiveFilters()).toBe(false);
    }));

    it('clearDropdownFilters() resets the dropdown facets but keeps the subject search', fakeAsync(() => {
      component['searchSubject'].next('Alice');
      tick(500);
      component.onStatusFilterChange(['VALID']);
      expect(component.hasActiveFilters()).toBe(true);

      component.clearDropdownFilters();

      const parsed: CredentialFilter = JSON.parse(component.dataSource.filter);
      expect(parsed.statuses).toEqual([]);
      expect(parsed.subject).toBe('Alice');
      expect(component.hasActiveFilters()).toBe(false);
    }));

    it('clearSearch() empties the subject search at once but keeps the dropdown facets', () => {
      component.onStatusFilterChange(['VALID']);
      component.onSearchStringChange({ target: { value: 'Alice' } } as unknown as Event);

      component.clearSearch();

      const parsed: CredentialFilter = JSON.parse(component.dataSource.filter);
      expect(parsed.subject).toBe('');
      expect(parsed.statuses).toEqual(['VALID']);
    });

    it('clearFilters() resets both the subject search and the dropdown facets', fakeAsync(() => {
      component['searchSubject'].next('Alice');
      tick(500);
      component.onStatusFilterChange(['VALID']);

      component.clearFilters();
      tick(500);

      const parsed: CredentialFilter = JSON.parse(component.dataSource.filter);
      expect(parsed.subject).toBe('');
      expect(parsed.statuses).toEqual([]);
      expect(component.hasActiveFilters()).toBe(false);
    }));

    // The actual filtering still debounces (500ms), but the clear button must
    // show up as soon as there's text in the box.
    it('shows the search clear button immediately on keystroke and hides it once cleared', () => {
      component.isLoading = false;
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('#search-clear')).toBeNull();

      component.onSearchStringChange({ target: { value: 'Ali' } } as unknown as Event);
      fixture.detectChanges();
      const clearBtn = compiled.querySelector<HTMLButtonElement>('#search-clear');
      expect(clearBtn).toBeTruthy();

      clearBtn!.click();
      fixture.detectChanges();
      expect(compiled.querySelector('#search-clear')).toBeNull();
      expect(JSON.parse(component.dataSource.filter).subject).toBe('');
    });

    // EC-02: filter leaves exactly one result (no empty state, no error)
    it('EC-02: filter that matches exactly one credential shows one row', () => {
      component.onStatusFilterChange(['EXPIRED']);

      expect(component.dataSource.filteredData.length).toBe(1);
      expect(component.isEmptyFiltered).toBe(false);
      expect(component.isEmptyOrigin).toBe(false);
      expect(component.isLoadError).toBe(false);
    });

    // EC-05: clearing only one filter keeps the other active
    it('EC-05: clearing status filter keeps subject filter active', fakeAsync(() => {
      // Set both filters
      component.selectedStatuses.set(['VALID']);
      component['applyCompoundFilter']('Alice');
      expect(component.dataSource.filteredData.length).toBe(1);

      // Clear only status; subject stays
      component.onStatusFilterChange([]);
      tick(0);

      // Now only subject='alice' is active → matches 'Alice Smith'
      const filtered = component.dataSource.filteredData;
      expect(filtered.length).toBe(1);
      expect(filtered[0].credential_procedure.subject).toBe('Alice Smith');
    }));

    it('EC-05: clearing subject filter keeps status filter active', fakeAsync(() => {
      // Set both filters
      component.selectedStatuses.set(['VALID']);
      component['applyCompoundFilter']('Alice');
      expect(component.dataSource.filteredData.length).toBe(1);

      // Clear only subject; status stays
      component['applyCompoundFilter']('');
      tick(0);

      // All VALID credentials visible
      const filtered = component.dataSource.filteredData;
      expect(filtered.length).toBe(2);
      filtered.forEach(item =>
        expect(item.credential_procedure.status).toBe('VALID')
      );
    }));

    // ES-01: empty / whitespace / special-char input treated as literal (no filter)
    it('ES-01: empty subject string does not filter (treats as no-filter)', () => {
      component['applyCompoundFilter']('');

      expect(component.dataSource.filteredData.length).toBe(4);
    });

    it('ES-01: whitespace-only subject treated as empty (no filter)', fakeAsync(() => {
      component.dataSource['_paginator'] = { firstPage: jest.fn() } as any;
      component['searchSubject'].next('   ');
      tick(500);

      // subject after trim is '', so no filtering
      expect(component.dataSource.filteredData.length).toBe(4);
    }));

    it('ES-01: special characters in subject are treated as literal text (no regex injection)', () => {
      // Input with regex special chars — should not throw and should not match anything
      component['applyCompoundFilter']('(.*)');

      // None of our fixture subjects contain '(.*)' literally → 0 results
      expect(component.dataSource.filteredData.length).toBe(0);
    });

    it('ES-01: malformed/empty dataSource.filter string does not break predicate', () => {
      component.ngAfterViewInit();
      const predicate = component.dataSource.filterPredicate!;
      const item = makeItem('Alice Smith', 'VALID');

      // Empty filter string → treated as no-filter → matches everything
      expect(predicate(item as any, '')).toBe(true);
      // Malformed JSON → treated as no-filter → matches everything
      expect(predicate(item as any, 'not-valid-json')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // T7 — Sorting: sortingDataAccessor asc/desc + stable order (AC-02, EC-03)
  // ---------------------------------------------------------------------------
  describe('T7 — Sorting', () => {
    /** Factory for a sortable fixture item. */
    const makeSortItem = (
      subject: string,
      status: string,
      updated: string,
      credentialType: string,
      id = 'id-sort'
    ): CredentialProcedureWithClass => ({
      credential_procedure: {
        procedure_id: id,
        subject,
        status: status as any,
        updated,
        credential_type: credentialType,
        email: 'a@b.com',
        organization_identifier: 'VATES-000000',
        created_at: '2025-01-01T00:00:00Z',
        expires_at: '2026-01-01T00:00:00Z',
      },
      statusClass: `status-${status.toLowerCase()}`,
    });

    beforeEach(() => {
      (component as any).setDataSortingAccessor();
    });

    // AC-02: sortingDataAccessor returns correct sort key for each operational column

    it('AC-02: status column uses lowercase status value', () => {
      const item = makeSortItem('Alice', 'VALID', '2025-01-01', 'type-a');
      expect(component.dataSource.sortingDataAccessor(item, 'status')).toBe('valid');
    });

    it('AC-02: status column maps WITHDRAWN → "draft" for sort (withdrawn sorts with draft)', () => {
      const item = makeSortItem('Alice', 'WITHDRAWN', '2025-01-01', 'type-a');
      expect(component.dataSource.sortingDataAccessor(item, 'status')).toBe('draft');
    });

    it('AC-02: subject column uses lowercase subject value', () => {
      const item = makeSortItem('Alice Smith', 'VALID', '2025-01-01', 'type-a');
      expect(component.dataSource.sortingDataAccessor(item, 'subject')).toBe('alice smith');
    });

    it('AC-02: updated column returns epoch timestamp (numeric)', () => {
      const date = '2025-06-15';
      const item = makeSortItem('Alice', 'VALID', date, 'type-a');
      const value = component.dataSource.sortingDataAccessor(item, 'updated');
      expect(value).toBe(Date.parse(date));
      expect(typeof value).toBe('number');
    });

    it('AC-02: updated column returns 0 for invalid date string', () => {
      const item = makeSortItem('Alice', 'VALID', 'not-a-date', 'type-a');
      expect(component.dataSource.sortingDataAccessor(item, 'updated')).toBe(0);
    });

    it('AC-02: credential_type column sorts by the displayed (grouped) label, lowercased', () => {
      const item = makeSortItem('Alice', 'VALID', '2025-01-01', 'doctorid.sd.1'); // outside employee/machine/label families
      expect(component.dataSource.sortingDataAccessor(item, 'credential_type'))
        .toBe(component.getCredentialTypeLabel('doctorid.sd.1').toLowerCase());
    });

    it('AC-02: credential_type sort groups legacy and current employee types under the same key', () => {
      const legacy = makeSortItem('Alice', 'VALID', '2025-01-01', 'LEARCredentialEmployee', 'legacy');
      const current = makeSortItem('Bob', 'VALID', '2025-01-01', 'learcredential.employee.w3c.4', 'current');
      const legacyKey = component.dataSource.sortingDataAccessor(legacy, 'credential_type');
      const currentKey = component.dataSource.sortingDataAccessor(current, 'credential_type');
      expect(legacyKey).toBe(currentKey);
    });

    it('AC-02: asc sort by updated puts older date first', () => {
      const older = makeSortItem('Alice', 'VALID', '2024-01-01', 'type-a', 'old');
      const newer = makeSortItem('Bob', 'VALID', '2025-06-01', 'type-a', 'new');
      component.dataSource.data = [newer, older]; // intentionally reversed
      component.dataSource.sort = component.sort;
      (component as any).setDataSortingAccessor();

      const asc = [older, newer].sort((a, b) => {
        const va = component.dataSource.sortingDataAccessor(a, 'updated') as number;
        const vb = component.dataSource.sortingDataAccessor(b, 'updated') as number;
        return va - vb;
      });
      expect(asc[0].credential_procedure.procedure_id).toBe('old');
      expect(asc[1].credential_procedure.procedure_id).toBe('new');
    });

    it('AC-02: desc sort by updated puts newer date first', () => {
      const older = makeSortItem('Alice', 'VALID', '2024-01-01', 'type-a', 'old');
      const newer = makeSortItem('Bob', 'VALID', '2025-06-01', 'type-a', 'new');

      const desc = [older, newer].sort((a, b) => {
        const va = component.dataSource.sortingDataAccessor(a, 'updated') as number;
        const vb = component.dataSource.sortingDataAccessor(b, 'updated') as number;
        return vb - va;
      });
      expect(desc[0].credential_procedure.procedure_id).toBe('new');
      expect(desc[1].credential_procedure.procedure_id).toBe('old');
    });

    it('AC-02: asc sort by subject produces alphabetical order', () => {
      const itemA = makeSortItem('Charlie', 'VALID', '2025-01-01', 'type', 'c');
      const itemB = makeSortItem('Alice', 'VALID', '2025-01-01', 'type', 'a');
      const itemC = makeSortItem('Bob', 'VALID', '2025-01-01', 'type', 'b');

      const asc = [itemA, itemB, itemC].sort((x, y) => {
        const vx = component.dataSource.sortingDataAccessor(x, 'subject') as string;
        const vy = component.dataSource.sortingDataAccessor(y, 'subject') as string;
        return vx < vy ? -1 : vx > vy ? 1 : 0;
      });
      expect(asc.map(i => i.credential_procedure.procedure_id)).toEqual(['a', 'b', 'c']);
    });

    it('AC-02: desc sort by subject produces reverse alphabetical order', () => {
      const itemA = makeSortItem('Charlie', 'VALID', '2025-01-01', 'type', 'c');
      const itemB = makeSortItem('Alice', 'VALID', '2025-01-01', 'type', 'a');
      const itemC = makeSortItem('Bob', 'VALID', '2025-01-01', 'type', 'b');

      const desc = [itemA, itemB, itemC].sort((x, y) => {
        const vx = component.dataSource.sortingDataAccessor(x, 'subject') as string;
        const vy = component.dataSource.sortingDataAccessor(y, 'subject') as string;
        return vx > vy ? -1 : vx < vy ? 1 : 0;
      });
      expect(desc.map(i => i.credential_procedure.procedure_id)).toEqual(['c', 'b', 'a']);
    });

    // EC-03: deterministic and stable order with tied values

    it('EC-03: WITHDRAWN and DRAFT items sort to the same key "draft" (tied group)', () => {
      const withdrawn = makeSortItem('Alice', 'WITHDRAWN', '2025-01-01', 'type', 'w');
      const draft = makeSortItem('Bob', 'DRAFT', '2025-01-01', 'type', 'd');

      const wKey = component.dataSource.sortingDataAccessor(withdrawn, 'status');
      const dKey = component.dataSource.sortingDataAccessor(draft, 'status');
      // Both map to 'draft' → they are in the same sort bucket
      expect(wKey).toBe('draft');
      expect(dKey).toBe('draft');
      expect(wKey).toBe(dKey);
    });

    it('EC-03: same updated timestamp produces 0 difference (tied, stable)', () => {
      const item1 = makeSortItem('Alice', 'VALID', '2025-06-01', 'type', 'a');
      const item2 = makeSortItem('Bob', 'VALID', '2025-06-01', 'type', 'b');

      const v1 = component.dataSource.sortingDataAccessor(item1, 'updated') as number;
      const v2 = component.dataSource.sortingDataAccessor(item2, 'updated') as number;
      expect(v1 - v2).toBe(0); // same epoch → tied → order is stable (no random swap)
    });

    it('EC-03: sorting same set twice produces the same order (deterministic)', () => {
      const items = [
        makeSortItem('Charlie', 'VALID', '2024-03-01', 'type', 'c'),
        makeSortItem('Alice', 'REVOKED', '2024-03-01', 'type', 'a'),
        makeSortItem('Bob', 'VALID', '2024-03-01', 'type', 'b'),
      ];

      const sortFn = (x: CredentialProcedureWithClass, y: CredentialProcedureWithClass) => {
        const vx = component.dataSource.sortingDataAccessor(x, 'subject') as string;
        const vy = component.dataSource.sortingDataAccessor(y, 'subject') as string;
        return vx < vy ? -1 : vx > vy ? 1 : 0;
      };

      const run1 = [...items].sort(sortFn).map(i => i.credential_procedure.procedure_id);
      const run2 = [...items].sort(sortFn).map(i => i.credential_procedure.procedure_id);
      expect(run1).toEqual(run2);
      expect(run1).toEqual(['a', 'b', 'c']);
    });
  });

  // ---------------------------------------------------------------------------
  // Missing/invalid fields — do not crash on absent subject (e.g. LEAR_CREDENTIAL_MACHINE)
  // ---------------------------------------------------------------------------
  describe('Safe field access (missing subject / fields)', () => {
    beforeEach(() => {
      (component as any).setDataSortingAccessor();
      component.ngAfterViewInit(); // sets compound filterPredicate
    });

    it('sorting: returns "" and logs console.error when subject is missing', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const item = {
        credential_procedure: {
          procedure_id: 'machine-1',
          status: 'VALID' as any,
          updated: '2025-01-01',
          credential_type: 'LEAR_CREDENTIAL_MACHINE',
          organization_identifier: 'VATES-000000',
        created_at: '2025-01-01T00:00:00Z',
        expires_at: '2026-01-01T00:00:00Z',
          // subject intentionally absent
        },
      } as any;

      expect(() => component.dataSource.sortingDataAccessor(item, 'subject')).not.toThrow();
      expect(component.dataSource.sortingDataAccessor(item, 'subject')).toBe('');
      expect(errorSpy).toHaveBeenCalledWith(
        'Invalid credential procedure field value',
        expect.objectContaining({ fieldName: 'subject', procedureId: 'machine-1', valueType: 'undefined' })
      );
      errorSpy.mockRestore();
    });

    it('sorting: returns 0 for updated when field is absent', () => {
      const item = { credential_procedure: { procedure_id: 'x' } } as any;
      expect(() => component.dataSource.sortingDataAccessor(item, 'updated')).not.toThrow();
      expect(component.dataSource.sortingDataAccessor(item, 'updated')).toBe(0);
    });

    it('filtering: does not crash and excludes record when subject is missing', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const item = {
        credential_procedure: {
          procedure_id: 'machine-1',
          status: 'VALID' as any,
          // subject intentionally absent
        },
      } as any;
      const filter = JSON.stringify({ subject: 'alice', status: '' });

      expect(() => component.dataSource.filterPredicate!(item, filter)).not.toThrow();
      expect(component.dataSource.filterPredicate!(item, filter)).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith(
        'Invalid credential procedure field value',
        expect.objectContaining({ fieldName: 'subject', procedureId: 'machine-1' })
      );
      errorSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // T8 — Empty States & Edge Cases (AC-04, EC-01, ES-02, ES-03)
  // ---------------------------------------------------------------------------
  describe('T8 — Empty States & Edge Cases', () => {
    
    it('ES-02: isLoadError is true when load fails, preventing other empty states', fakeAsync(() => {
      // Force load error
      credentialProcedureSpy.mockReturnValue(throwError(() => new Error('API down')));
      jest.spyOn(console, 'error').mockImplementation(() => {});
      component['initializeCredentialTable']();
      tick();

      expect(component.isLoadError).toBe(true);
      expect(component.isEmptyOrigin).toBe(false); // suppressed by isLoadError
      expect(component.isEmptyFiltered).toBe(false); // suppressed by isLoadError
    }));

    it('EC-01: isEmptyOrigin is true when backend returns 0 credentials', fakeAsync(() => {
      credentialProcedureSpy.mockReturnValue(of({ credential_procedures: [] } as CredentialProceduresResponse));
      component['initializeCredentialTable']();
      tick();

      expect(component.isLoadError).toBe(false);
      expect(component.isEmptyOrigin).toBe(true);
      expect(component.isEmptyFiltered).toBe(false);
    }));

    it('AC-04: isEmptyFiltered is true when origin has data but filter matches none', fakeAsync(() => {
      // 1. Load some data
      const proc = {
        credential_procedure: {
          procedure_id: '1', subject: 'Alice', status: 'VALID',
          created_at: '2025-01-01', expires_at: '2026-01-01',
          updated: '2025', credential_type: 'type', email: 'a@a', organization_identifier: 'VATES'
        }
      } as CredentialProcedureBasicInfo;
      credentialProcedureSpy.mockReturnValue(of({ credential_procedures: [proc] } as CredentialProceduresResponse));
      jest.spyOn(statusService, 'addStatusClass').mockReturnValue([{ ...proc, statusClass: 'status-valid' }]);
      
      component['initializeCredentialTable']();
      tick();
      component.ngAfterViewInit(); // setup predicate

      // Data loaded correctly
      expect(component.isEmptyOrigin).toBe(false);
      expect(component.isLoadError).toBe(false);
      expect(component.isEmptyFiltered).toBe(false);

      // 2. Apply a filter that yields 0 results
      component.onStatusFilterChange(['REVOKED']);
      
      expect(component.dataSource.filteredData.length).toBe(0);
      expect(component['originData']().length).toBe(1); // origin still has data
      
      // 3. Verify isEmptyFiltered triggers
      expect(component.isEmptyFiltered).toBe(true);
      expect(component.isEmptyOrigin).toBe(false); // not overridden
      expect(component.isLoadError).toBe(false);
    }));

    it('ES-03: an unmapped status returns "status-default" class via statusService', fakeAsync(() => {
      // This tests the interaction with the statusService for an unknown status
      const unknownProc = {
        credential_procedure: {
          procedure_id: '1', subject: 'Alice', status: 'UNKNOWN_NEW_STATUS' as any,
          created_at: '2025-01-01', expires_at: '2026-01-01',
          updated: '2025', credential_type: 'type', email: 'a@a', organization_identifier: 'VATES'
        }
      } as CredentialProcedureBasicInfo;
      
      credentialProcedureSpy.mockReturnValue(of({ credential_procedures: [unknownProc] } as CredentialProceduresResponse));
      // Call the real service to verify default fallback by restoring any previous spies
      jest.spyOn(statusService, 'addStatusClass').mockRestore();

      component['initializeCredentialTable']();
      tick();

      const processedData = component.dataSource.data;
      expect(processedData.length).toBe(1);
      expect(processedData[0].statusClass).toBe('status-default');
    }));

  });

  // ---------------------------------------------------------------------------
  // T9 — Render & Template
  // ---------------------------------------------------------------------------
  describe('T9 — Render & Template', () => {

    it('should render the skeleton loader when isLoading is true', () => {
      component.isLoading = true;
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('app-skeleton-loader')).toBeTruthy();
      // Table container should be hidden
      expect(compiled.querySelector('.table-container')).toBeFalsy();
    });

    it('should render the load error empty state when isLoadError is true', () => {
      component.isLoading = false;
      jest.spyOn(component, 'isLoadError', 'get').mockReturnValue(true);
      fixture.detectChanges();
      
      const compiled = fixture.nativeElement as HTMLElement;
      const errorState = compiled.querySelector('.empty-state--error');
      expect(errorState).toBeTruthy();
      expect(errorState?.textContent).toContain('credentialManagement.loadError.title');
    });

    it('should render the "no data" empty state when isEmptyOrigin is true', () => {
      component.isLoading = false;
      jest.spyOn(component, 'isEmptyOrigin', 'get').mockReturnValue(true);
      fixture.detectChanges();
      
      const compiled = fixture.nativeElement as HTMLElement;
      const noDataState = compiled.querySelector('#empty-state-no-credentials');
      expect(noDataState).toBeTruthy();
      expect(noDataState?.textContent).toContain('credentialManagement.emptyState.title');
    });

    it('should render the "no matches" empty state when isEmptyFiltered is true', () => {
      component.isLoading = false;
      jest.spyOn(component, 'isEmptyFiltered', 'get').mockReturnValue(true);
      fixture.detectChanges();
      
      const compiled = fixture.nativeElement as HTMLElement;
      const noMatchesState = compiled.querySelector('.empty-state--no-matches');
      expect(noMatchesState).toBeTruthy();
      expect(noMatchesState?.textContent).toContain('credentialManagement.emptyState.noMatches.title');
      
      // The "Clear filter" button should be present and call clearFilters()
      const clearBtn = noMatchesState?.querySelector('button');
      expect(clearBtn).toBeTruthy();
      const clearSpy = jest.spyOn(component, 'clearFilters');
      clearBtn?.click();
      expect(clearSpy).toHaveBeenCalled();
    });

    it('should render the Organization / Type / Status filter dropdowns in the filter bar', () => {
      component.isLoading = false;
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const filterBar = compiled.querySelector('.filter-bar');
      expect(filterBar).toBeTruthy();
      expect(filterBar?.querySelectorAll('app-filter-dropdown').length).toBe(3);

      // Every sibling instance gets its own bindings, not just the first one.
      const triggers = Array.from(filterBar!.querySelectorAll<HTMLButtonElement>('.filter-dropdown-trigger'));
      expect(triggers.map(t => t.getAttribute('aria-label'))).toEqual([
        'credentialManagement.organizationId',
        'filters.credentialType',
        'filters.credentialStatus',
      ]);

      const clearAllBtn = compiled.querySelector('#filter-bar-clear-all');
      expect(clearAllBtn).toBeTruthy();
    });

    it('should show the Organization ID column for every tenant type, simple included', () => {
      authService.tenantType.set('simple');
      expect(component.displayedColumns()).toContain('organization_identifier');

      authService.tenantType.set('multi_org');
      expect(component.displayedColumns()).toContain('organization_identifier');
    });

  });

  describe('row accessibility', () => {
    function renderRow(status: string): HTMLElement {
      component.isLoading = false;
      fixture.detectChanges();
      component.dataSource.data = [{
        credential_procedure: {
          procedure_id: 'id-a11y',
          subject: 'Alice Smith',
          status: status as any,
          updated: '2025-01-01T00:00:00Z',
          credential_type: 'LEARCredentialEmployee',
          email: 'a@b.com',
          organization_identifier: 'VATES-000000',
          created_at: '2025-01-01T00:00:00Z',
          expires_at: '2026-01-01T00:00:00Z',
        },
        statusClass: `status-${status.toLowerCase()}`,
      }];
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    it('announces the status icon to screen readers', () => {
      const icon = renderRow('REVOKED').querySelector('.status-icon')!;

      expect(icon.getAttribute('role')).toBe('img');
      expect(icon.getAttribute('aria-hidden')).toBe('false');
      expect(icon.getAttribute('aria-label')).toBe('credentialDetails.REVOKED');
    });

    it('names the view-details button after the credential subject', () => {
      const translate = TestBed.inject(TranslateService);
      translate.setTranslation('en', { credentialManagement: { viewDetailsOf: 'View details of {{subject}}' } }, true);
      translate.use('en');

      const button = renderRow('VALID').querySelector('.view-details-btn')!;

      expect(button.getAttribute('aria-label')).toBe('View details of Alice Smith');
    });

    it('labels the sort select with its visible label', () => {
      const root = renderRow('VALID');
      const label = root.querySelector('.sort-by-label')!;
      const select = root.querySelector('.sort-by-field mat-select')!;

      expect(label.id).toBe('sort-by-label');
      expect(select.getAttribute('aria-labelledby')?.split(' ')).toContain('sort-by-label');
    });
  });

  describe('Sort by ↔ table sync', () => {
    const makeProcedure = (id: string, updated: string): CredentialProcedureBasicInfo => ({
      credential_procedure: {
        procedure_id: id,
        subject: `Subject ${id}`,
        status: 'VALID' as any,
        updated,
        credential_type: 'learcredential.employee.w3c.4',
        email: 'a@b.com',
        organization_identifier: 'VATES-000000',
        created_at: '2025-01-01T00:00:00Z',
        expires_at: '2026-01-01T00:00:00Z',
      },
    });

    it('starts sorted by Updated desc, matching "Recently updated"', () => {
      credentialProcedureSpy.mockReturnValue(of({
        credential_procedures: [
          makeProcedure('old', '2024-01-01T00:00:00Z'),
          makeProcedure('new', '2025-06-01T00:00:00Z'),
        ],
      } as CredentialProceduresResponse));
      component.ngOnInit();
      fixture.detectChanges();

      expect(component.sortOption()).toBe('recentlyUpdated');
      expect(component.sort.active).toBe('updated');
      expect(component.sort.direction).toBe('desc');
      const rendered = component.dataSource.connect().value.map(r => r.credential_procedure.procedure_id);
      expect(rendered).toEqual(['new', 'old']);
    });

    it('selector drives the table sort', () => {
      component.onSortOptionChange('expiringSoon');

      expect(component.sort.active).toBe('expires');
      expect(component.sort.direction).toBe('asc');
      expect(component.sortOption()).toBe('expiringSoon');
    });

    it('header sort matching an option selects that option', () => {
      component.sort.sort({ id: 'expires', start: 'desc', disableClear: false });

      expect(component.sortOption()).toBe('expiringLater');
    });

    it('header sort matching no option clears the selector to its placeholder', () => {
      component.sort.sort({ id: 'subject', start: 'asc', disableClear: false });

      expect(component.sortOption()).toBeNull();
    });

    it('clearing the header sort clears the selector', () => {
      component.onTableSortChange({ active: 'updated', direction: '' });

      expect(component.sortOption()).toBeNull();
    });

    it('sorts credentials without an expiration date last in "Expiring soon"', () => {
      const withoutExpiration = makeProcedure('none', '2025-01-01T00:00:00Z');
      withoutExpiration.credential_procedure.expires_at = null;
      const expiring = makeProcedure('soon', '2025-01-01T00:00:00Z');
      credentialProcedureSpy.mockReturnValue(of({
        credential_procedures: [withoutExpiration, expiring],
      } as CredentialProceduresResponse));
      component.ngOnInit();
      fixture.detectChanges();

      component.onSortOptionChange('expiringSoon');

      const rendered = component.dataSource.connect().value.map(r => r.credential_procedure.procedure_id);
      expect(rendered).toEqual(['soon', 'none']);
    });

    it('keeps the selected sort after the table is rebuilt by a reload', () => {
      component.onSortOptionChange('expiringSoon');
      const sortBeforeReload = component.sort;
      const listResponse = new Subject<CredentialProceduresResponse>();
      credentialProcedureSpy.mockReturnValue(listResponse);

      TestBed.inject(CredentialActionsService).actionCompleted$.next();
      fixture.detectChanges();
      listResponse.next({ credential_procedures: [makeProcedure('a', '2025-01-01T00:00:00Z')] } as CredentialProceduresResponse);

      expect(component.sort).not.toBe(sortBeforeReload);
      expect(component.sortOption()).toBe('expiringSoon');
      expect(component.sort.active).toBe('expires');
      expect(component.sort.direction).toBe('asc');
    });
  });

  describe('filter labels', () => {
    it('follow a language change', () => {
      const translate = TestBed.inject(TranslateService);
      translate.setTranslation('en', { credentialDetails: { VALID: 'valid' } });
      translate.setTranslation('es', { credentialDetails: { VALID: 'válida' } });
      translate.use('en');
      const validLabel = () => component.statusOptions().find(option => option.value === 'VALID')?.label;
      expect(validLabel()).toBe('Valid');

      translate.use('es');

      expect(validLabel()).toBe('Válida');
    });
  });


  describe('details drawer routing', () => {
    function row(procedureId: string): CredentialProcedureBasicInfo {
      return { credential_procedure: { procedure_id: procedureId } } as CredentialProcedureBasicInfo;
    }

    it('puts the credential id on the URL instead of opening the drawer directly', () => {
      component.openCredentialDetails(row('3f1c2a9e-7b4d-4e2a-9c1f-5d6e7f8a9b0c'));

      expect(router.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ queryParams: { id: '3f1c2a9e-7b4d-4e2a-9c1f-5d6e7f8a9b0c' }, queryParamsHandling: 'merge' })
      );
    });

    it('ignores a row carrying no procedure id', () => {
      component.openCredentialDetails({ credential_procedure: {} } as CredentialProcedureBasicInfo);

      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('opens the drawer when the id appears on the URL', () => {
      const open = jest.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({
        afterClosed: () => of(undefined),
        close: jest.fn(),
      } as never);

      queryParamMap$.next(convertToParamMap({ id: '3f1c2a9e-7b4d-4e2a-9c1f-5d6e7f8a9b0c' }));

      expect(open).toHaveBeenCalledWith(
        CredentialDetailsDrawerComponent,
        expect.objectContaining({
          data: expect.objectContaining({ procedureId: '3f1c2a9e-7b4d-4e2a-9c1f-5d6e7f8a9b0c' }),
          ariaLabelledBy: 'drawer-title',
        })
      );
    });

    it('opens the drawer when the page loads with the id already on the URL', () => {
      fixture.destroy();
      const open = jest.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({
        afterClosed: () => of(undefined),
        close: jest.fn(),
      } as never);
      queryParamMap$.next(convertToParamMap({ id: '3f1c2a9e-7b4d-4e2a-9c1f-5d6e7f8a9b0c' }));

      TestBed.createComponent(CredentialManagementComponent).detectChanges();

      expect(open).toHaveBeenCalledTimes(1);
      expect(open).toHaveBeenCalledWith(
        CredentialDetailsDrawerComponent,
        expect.objectContaining({ data: expect.objectContaining({ procedureId: '3f1c2a9e-7b4d-4e2a-9c1f-5d6e7f8a9b0c' }) })
      );
    });

    it('closes the open drawer when the id leaves the URL', () => {
      const close = jest.fn();
      jest.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({
        afterClosed: () => new Subject(),
        close,
      } as never);

      queryParamMap$.next(convertToParamMap({ id: '3f1c2a9e-7b4d-4e2a-9c1f-5d6e7f8a9b0c' }));
      queryParamMap$.next(convertToParamMap({}));

      expect(close).toHaveBeenCalled();
    });

    it('ignores and clears an id that is not a UUID', () => {
      const open = jest.spyOn(TestBed.inject(MatDialog), 'open');
      (TestBed.inject(ActivatedRoute).snapshot as { queryParamMap: ParamMap }).queryParamMap = convertToParamMap({ id: '../../other' });

      queryParamMap$.next(convertToParamMap({ id: '../../other' }));

      expect(open).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ queryParams: { id: null }, replaceUrl: true })
      );
    });

    it('hands the drawer a last-updated date that follows the list once it loads', () => {
      const id = '3f1c2a9e-7b4d-4e2a-9c1f-5d6e7f8a9b0c';
      const open = jest.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({
        afterClosed: () => new Subject(),
        close: jest.fn(),
      } as never);
      const listResponse = new Subject<CredentialProceduresResponse>();
      credentialProcedureSpy.mockReturnValue(listResponse);
      component['initializeCredentialTable']();

      queryParamMap$.next(convertToParamMap({ id }));
      const data = open.mock.calls[0][1]!.data as CredentialDetailsDrawerData;
      expect(data.lastUpdated()).toBeUndefined();

      listResponse.next({
        credential_procedures: [
          { credential_procedure: { procedure_id: id, status: 'REVOKED', updated: '2026-06-25T16:42:00Z' } },
        ],
      } as CredentialProceduresResponse);

      expect(data.lastUpdated()).toBe('2026-06-25T16:42:00Z');
    });

    it('does not reopen the drawer while it is already showing the same credential', () => {
      const open = jest.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({
        afterClosed: () => new Subject(),
        close: jest.fn(),
      } as never);

      queryParamMap$.next(convertToParamMap({ id: '3f1c2a9e-7b4d-4e2a-9c1f-5d6e7f8a9b0c' }));
      queryParamMap$.next(convertToParamMap({ id: '3f1c2a9e-7b4d-4e2a-9c1f-5d6e7f8a9b0c' }));

      expect(open).toHaveBeenCalledTimes(1);
    });
  });

  describe('refresh after a credential action', () => {
    it('refetches the table when a sign / revoke / withdraw / archive completes', () => {
      credentialProcedureSpy.mockClear();

      TestBed.inject(CredentialActionsService).actionCompleted$.next();

      expect(credentialProcedureSpy).toHaveBeenCalled();
    });

    it('refetches even while the drawer is open, whatever result it closes with', () => {
      jest.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({
        afterClosed: () => of(undefined),
        close: jest.fn(),
      } as never);
      queryParamMap$.next(convertToParamMap({ id: '3f1c2a9e-7b4d-4e2a-9c1f-5d6e7f8a9b0c' }));
      credentialProcedureSpy.mockClear();

      TestBed.inject(CredentialActionsService).actionCompleted$.next();

      expect(credentialProcedureSpy).toHaveBeenCalled();
    });
  });
});
