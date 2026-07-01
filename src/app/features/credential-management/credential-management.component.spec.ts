import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CredentialManagementComponent } from './credential-management.component';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { CredentialProcedureService } from 'src/app/core/services/credential-procedure.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { RoleType } from 'src/app/core/models/enums/auth-rol-type.enum';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { provideHttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { LifeCycleStatusService } from 'src/app/shared/services/life-cycle-status.service';
import { CredentialFilter, CredentialProcedureWithClass } from 'src/app/core/models/entity/lear-credential-management';
import { CredentialProcedureBasicInfo, CredentialProceduresResponse } from 'src/app/core/models/dto/credential-procedures-response.dto';
import { ElementRef, signal } from '@angular/core';

// helper to mock search input
function createMockInput(initialValue = '') {
  const el = document.createElement('input');
  el.value = initialValue;
  const focusSpy = jest.spyOn(el, 'focus').mockImplementation(() => {});
  const selectSpy = jest.spyOn(el, 'select').mockImplementation(() => {});
  return { el, focusSpy, selectSpy };
}

describe('CredentialManagementComponent', () => {
  let component: CredentialManagementComponent;
  let fixture: ComponentFixture<CredentialManagementComponent>;
  let credentialProcedureService: CredentialProcedureService;
  let credentialProcedureSpy: jest.SpyInstance;
  let authService: jest.Mocked<any>;
  let router: Router;
  let statusService: LifeCycleStatusService;

  beforeEach(async () => {
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
            snapshot: { paramMap: { get: () => '1' } },
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
    expect(parsed.status).toBe('');
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
      credential_procedure: { subject: 'My Fancy Subject', status: 'VALID' }
    };
    // subject match, no status filter
    const filterAll = JSON.stringify({ subject: 'fancy', status: '' });
    expect(component.dataSource.filterPredicate!(mockItem, filterAll)).toBe(true);
    // subject no match
    const filterNoSubject = JSON.stringify({ subject: 'xyz', status: '' });
    expect(component.dataSource.filterPredicate!(mockItem, filterNoSubject)).toBe(false);
    // status match, no subject filter
    const filterStatus = JSON.stringify({ subject: '', status: 'VALID' });
    expect(component.dataSource.filterPredicate!(mockItem, filterStatus)).toBe(true);
    // status no match
    const filterStatusNo = JSON.stringify({ subject: '', status: 'REVOKED' });
    expect(component.dataSource.filterPredicate!(mockItem, filterStatusNo)).toBe(false);
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

  it('should focus and select input when opening the search bar', () => {
    component.hideSearchBar = true;

    const { el, focusSpy, selectSpy } = createMockInput();
    component.searchInput = new ElementRef<HTMLInputElement>(el);

    component.toggleSearchBar();

    expect(component.hideSearchBar).toBe(false);
    expect(focusSpy).toHaveBeenCalled();
    expect(selectSpy).toHaveBeenCalled();
  });

  it('should clear value, push empty filter, and go to first page when closing the search bar', () => {
    component.hideSearchBar = false;

    const { el } = createMockInput('lorem');
    component.searchInput = new ElementRef<HTMLInputElement>(el);

    component.dataSource['_paginator'] = { firstPage: jest.fn() } as any;
    const firstPageSpy = jest.spyOn(component.dataSource.paginator!, 'firstPage');

    const nextSpy = jest.spyOn(component['searchSubject'], 'next');
    component.toggleSearchBar();

    expect(component.hideSearchBar).toBe(true);
    expect(el.value).toBe('');
    expect(nextSpy).toHaveBeenCalledWith('');
    expect(firstPageSpy).toHaveBeenCalled();
  });

  it('should toggle searchbar open/close consistently', () => {
    component.hideSearchBar = true;

    component.toggleSearchBar();
    expect(component.hideSearchBar).toBeFalsy();

    component.toggleSearchBar();
    expect(component.hideSearchBar).toBeTruthy();
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

it('should return direct translated credential type when key exists', () => {
  const translate = TestBed.inject(TranslateService);
  jest.spyOn(translate, 'instant').mockImplementation((key: string | string[]) => {
    if (key === 'credentialManagement.learcredential.employee.w3c.4') {
      return 'LEAR Credential Employee v4';
    }
    return key;
  });

  expect(component.getCredentialTypeLabel('learcredential.employee.w3c.4')).toBe('LEAR Credential Employee v4');
});

it('should fallback to .1 translation when current version key is missing', () => {
  const translate = TestBed.inject(TranslateService);
  jest.spyOn(translate, 'instant').mockImplementation((key: string | string[]) => {
    if (key === 'credentialManagement.learcredential.employee.w3c.1') {
      return 'LEAR Credential Employee';
    }
    return key;
  });

  expect(component.getCredentialTypeLabel('learcredential.employee.w3c.4')).toBe('LEAR Credential Employee');
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

  describe('ARCHIVED filtering in initializeCredentialTable', () => {
    const makeProc = (id: string, status: string): CredentialProcedureBasicInfo => ({
      credential_procedure: {
        procedure_id: id,
        subject: `Subject ${id}`,
        status: status as any,
        updated: '2025-01-01',
        credential_type: 'LEAR_CREDENTIAL_EMPLOYEE',
        email: 'a@b.com',
        organization_identifier: 'VATES-000000',
      },
    });

    it('should exclude ARCHIVED credentials from dataSource', fakeAsync(() => {
      const archivedProc = makeProc('arch-1', 'ARCHIVED');
      const mockResponse = { credential_procedures: [archivedProc] } as CredentialProceduresResponse;
      credentialProcedureSpy.mockReturnValue(of(mockResponse));
      jest.spyOn(statusService, 'addStatusClass').mockReturnValue([]);

      component['initializeCredentialTable']();
      tick();

      expect(component.dataSource.data).toEqual([]);
    }));

    it('should include non-ARCHIVED credentials in dataSource', fakeAsync(() => {
      const draftProc = makeProc('draft-1', 'DRAFT');
      const withClass: CredentialProcedureWithClass[] = [{ ...draftProc, statusClass: 'status-draft' }];
      const mockResponse = { credential_procedures: [draftProc] } as CredentialProceduresResponse;
      credentialProcedureSpy.mockReturnValue(of(mockResponse));
      jest.spyOn(statusService, 'addStatusClass').mockReturnValue(withClass);

      component['initializeCredentialTable']();
      tick();

      expect(component.dataSource.data).toEqual(withClass);
    }));

    it('should only pass non-ARCHIVED items to addStatusClass', fakeAsync(() => {
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

      expect(statusSpy).toHaveBeenCalledWith([validProc, withdrawnProc]);
      expect(statusSpy).not.toHaveBeenCalledWith(expect.arrayContaining([archivedProc]));
    }));

    it('should show empty dataSource when all credentials are ARCHIVED', fakeAsync(() => {
      const procs = [makeProc('a1', 'ARCHIVED'), makeProc('a2', 'ARCHIVED'), makeProc('a3', 'ARCHIVED')];
      jest.spyOn(statusService, 'addStatusClass').mockReturnValue([]);
      credentialProcedureSpy.mockReturnValue(of({ credential_procedures: procs } as CredentialProceduresResponse));

      component['initializeCredentialTable']();
      tick();

      expect(component.dataSource.data).toHaveLength(0);
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
      },
      statusClass: `status-${status.toLowerCase()}`,
    });

    beforeEach(() => {
      // Seed datasource with a representative set of credentials
      component['originData'] = [
        makeItem('Alice Smith', 'VALID', 'id-1'),
        makeItem('Bob Jones', 'REVOKED', 'id-2'),
        makeItem('Carol White', 'VALID', 'id-3'),
        makeItem('Dan Brown', 'EXPIRED', 'id-4'),
      ];
      component.dataSource.data = [...component['originData']];
      component.ngAfterViewInit(); // sets compound filterPredicate
    });

    // AC-01: filter by status reduces filteredData to only matching rows
    it('AC-01: filtering by status VALID shows only VALID credentials', () => {
      component.onStatusFilterChange('VALID');

      const filtered = component.dataSource.filteredData;
      expect(filtered.length).toBe(2);
      filtered.forEach(item =>
        expect(item.credential_procedure.status).toBe('VALID')
      );
    });

    it('AC-01: filtering by status REVOKED shows only REVOKED credentials', () => {
      component.onStatusFilterChange('REVOKED');

      const filtered = component.dataSource.filteredData;
      expect(filtered.length).toBe(1);
      expect(filtered[0].credential_procedure.status).toBe('REVOKED');
    });

    it('AC-01: selecting empty status (All) shows all credentials', () => {
      component.onStatusFilterChange('VALID');  // first apply a filter
      component.onStatusFilterChange('');        // then clear it

      expect(component.dataSource.filteredData.length).toBe(4);
    });

    // AC-03: subject + status + sort applied together (AND combination)
    it('AC-03: subject and status filters are evaluated in AND', () => {
      // Apply subject filter via searchSubject
      component['selectedStatus'] = 'VALID';
      component['applyCompoundFilter']('Alice', 'VALID');

      const filtered = component.dataSource.filteredData;
      expect(filtered.length).toBe(1);
      expect(filtered[0].credential_procedure.subject).toBe('Alice Smith');
      expect(filtered[0].credential_procedure.status).toBe('VALID');
    });

    it('AC-03: subject match + wrong status → no results', () => {
      component['applyCompoundFilter']('Alice', 'REVOKED');

      expect(component.dataSource.filteredData.length).toBe(0);
    });

    // AC-05: clearing filter restores the full dataset and resets paginator
    it('AC-05: clearFilters restores full dataset and resets paginator', fakeAsync(() => {
      component.dataSource['_paginator'] = { firstPage: jest.fn() } as any;
      const firstPageSpy = jest.spyOn(component.dataSource.paginator!, 'firstPage');

      component.onStatusFilterChange('REVOKED'); // narrow dataset
      component.clearFilters();
      tick(500); // debounce for searchSubject.next('')

      const parsed: CredentialFilter = JSON.parse(component.dataSource.filter);
      expect(parsed.subject).toBe('');
      expect(parsed.status).toBe('');
      expect(component.selectedStatus).toBe('');
      expect(component.dataSource.filteredData.length).toBe(4);
      expect(firstPageSpy).toHaveBeenCalled();
    }));

    // EC-02: filter leaves exactly one result (no empty state, no error)
    it('EC-02: filter that matches exactly one credential shows one row', () => {
      component.onStatusFilterChange('EXPIRED');

      expect(component.dataSource.filteredData.length).toBe(1);
      expect(component.isEmptyFiltered).toBe(false);
      expect(component.isEmptyOrigin).toBe(false);
      expect(component.isLoadError).toBe(false);
    });

    // EC-05: clearing only one filter keeps the other active
    it('EC-05: clearing status filter keeps subject filter active', fakeAsync(() => {
      // Set both filters
      component['applyCompoundFilter']('Alice', 'VALID');
      expect(component.dataSource.filteredData.length).toBe(1);

      // Clear only status; subject stays
      component.onStatusFilterChange('');
      tick(0);

      // Now only subject='alice' is active → matches 'Alice Smith'
      const filtered = component.dataSource.filteredData;
      expect(filtered.length).toBe(1);
      expect(filtered[0].credential_procedure.subject).toBe('Alice Smith');
    }));

    it('EC-05: clearing subject filter keeps status filter active', fakeAsync(() => {
      // Set both filters
      component['applyCompoundFilter']('Alice', 'VALID');
      expect(component.dataSource.filteredData.length).toBe(1);

      // Clear only subject; status stays
      component['applyCompoundFilter']('', 'VALID');
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
      component['applyCompoundFilter']('', '');

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
      component['applyCompoundFilter']('(.*)', '');

      // None of our fixture subjects contain '(.*)' literally → 0 results
      expect(component.dataSource.filteredData.length).toBe(0);
    });

    it('ES-01: malformed/empty dataSource.filter string does not break predicate', () => {
      component.ngAfterViewInit();
      const predicate = component.dataSource.filterPredicate!;
      const item = makeItem('Alice Smith', 'VALID');

      // Empty filter string → treated as { subject:'', status:'' } → matches everything
      expect(predicate(item as any, '')).toBe(true);
      // Malformed JSON → treated as { subject:'', status:'' } → matches everything
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

    it('AC-02: credential_type column uses lowercase credential_type', () => {
      const item = makeSortItem('Alice', 'VALID', '2025-01-01', 'LEAR_CREDENTIAL_EMPLOYEE');
      expect(component.dataSource.sortingDataAccessor(item, 'credential_type')).toBe('lear_credential_employee');
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
      component.onStatusFilterChange('REVOKED');
      
      expect(component.dataSource.filteredData.length).toBe(0);
      expect(component['originData'].length).toBe(1); // origin still has data
      
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

    it('should render the status filter dropdown', () => {
      component.isLoading = false;
      fixture.detectChanges();
      
      const compiled = fixture.nativeElement as HTMLElement;
      const select = compiled.querySelector('mat-select#status-filter-select');
      expect(select).toBeTruthy();
      
      const label = compiled.querySelector('mat-label#status-filter-label');
      expect(label).toBeTruthy();
      expect(label?.textContent).toContain('credentialManagement.filterByStatus.label');
    });

  });

});
