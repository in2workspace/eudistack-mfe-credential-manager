import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ArchivedCredentialsComponent } from './archived-credentials.component';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { CredentialProcedureService } from 'src/app/core/services/credential-procedure.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { provideHttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { LifeCycleStatusService } from 'src/app/shared/services/life-cycle-status.service';
import { CredentialProcedureWithClass } from 'src/app/core/models/entity/lear-credential-management';
import { CredentialProcedureBasicInfo, CredentialProceduresResponse } from 'src/app/core/models/dto/credential-procedures-response.dto';
import { ElementRef } from '@angular/core';

// helper to mock search input
function createMockInput(initialValue = '') {
  const el = document.createElement('input');
  el.value = initialValue;
  const focusSpy = jest.spyOn(el, 'focus').mockImplementation(() => {});
  const selectSpy = jest.spyOn(el, 'select').mockImplementation(() => {});
  return { el, focusSpy, selectSpy };
}

// helper to build a CredentialProcedureBasicInfo fixture
function makeProc(id: string, status: string): CredentialProcedureBasicInfo {
  return {
    credential_procedure: {
      procedure_id: id,
      subject: `Subject ${id}`,
      status: status as any,
      updated: '2025-01-01',
      credential_type: 'LEAR_CREDENTIAL_EMPLOYEE',
      email: 'a@b.com',
      organization_identifier: 'VATES-000000',
    },
  };
}

describe('ArchivedCredentialsComponent', () => {
  let component: ArchivedCredentialsComponent;
  let fixture: ComponentFixture<ArchivedCredentialsComponent>;
  let credentialProcedureService: CredentialProcedureService;
  let credentialProcedureSpy: jest.SpyInstance;
  let router: Router;
  let statusService: LifeCycleStatusService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        NoopAnimationsModule,
        MatTableModule,
        MatPaginatorModule,
        RouterModule.forRoot([]),
        TranslateModule.forRoot({}),
        ArchivedCredentialsComponent,
      ],
      providers: [
        CredentialProcedureService,
        TranslateService,
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => '1' } } },
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
    fixture = TestBed.createComponent(ArchivedCredentialsComponent);
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

  describe('ARCHIVED-only filtering in initializeArchivedTable', () => {
    it('should only load ARCHIVED credentials into dataSource', fakeAsync(() => {
      const archivedProc = makeProc('arch-1', 'ARCHIVED');
      const draftProc    = makeProc('draft-1', 'DRAFT');
      const validProc    = makeProc('valid-1', 'VALID');
      const statusSpy = jest.spyOn(statusService, 'addStatusClass').mockReturnValue([
        { ...archivedProc, statusClass: 'status-archived' } as CredentialProcedureWithClass,
      ]);

      credentialProcedureSpy.mockReturnValue(
        of({ credential_procedures: [archivedProc, draftProc, validProc] } as CredentialProceduresResponse)
      );

      component['initializeArchivedTable']();
      tick();

      expect(statusSpy).toHaveBeenCalledWith([archivedProc]);
      expect(statusSpy).not.toHaveBeenCalledWith(expect.arrayContaining([draftProc]));
      expect(statusSpy).not.toHaveBeenCalledWith(expect.arrayContaining([validProc]));
      expect(component.dataSource.data).toHaveLength(1);
    }));

    it('should exclude all non-ARCHIVED statuses (DRAFT, VALID, WITHDRAWN, REVOKED, EXPIRED)', fakeAsync(() => {
      const procs = [
        makeProc('d', 'DRAFT'),
        makeProc('v', 'VALID'),
        makeProc('w', 'WITHDRAWN'),
        makeProc('r', 'REVOKED'),
        makeProc('e', 'EXPIRED'),
      ];
      jest.spyOn(statusService, 'addStatusClass').mockReturnValue([]);
      credentialProcedureSpy.mockReturnValue(of({ credential_procedures: procs } as CredentialProceduresResponse));

      component['initializeArchivedTable']();
      tick();

      expect(component.dataSource.data).toHaveLength(0);
    }));

    it('should include multiple ARCHIVED credentials', fakeAsync(() => {
      const a1 = makeProc('a1', 'ARCHIVED');
      const a2 = makeProc('a2', 'ARCHIVED');
      const a3 = makeProc('a3', 'ARCHIVED');
      const withClass: CredentialProcedureWithClass[] = [
        { ...a1, statusClass: 'status-archived' },
        { ...a2, statusClass: 'status-archived' },
        { ...a3, statusClass: 'status-archived' },
      ];
      jest.spyOn(statusService, 'addStatusClass').mockReturnValue(withClass);
      credentialProcedureSpy.mockReturnValue(
        of({ credential_procedures: [a1, a2, a3] } as CredentialProceduresResponse)
      );

      component['initializeArchivedTable']();
      tick();

      expect(component.dataSource.data).toHaveLength(3);
      expect(component.dataSource.data).toEqual(withClass);
    }));
  });

  describe('empty state', () => {
    it('dataSource should be empty when no credentials are ARCHIVED', fakeAsync(() => {
      const procs = [makeProc('x1', 'DRAFT'), makeProc('x2', 'VALID')];
      jest.spyOn(statusService, 'addStatusClass').mockReturnValue([]);
      credentialProcedureSpy.mockReturnValue(of({ credential_procedures: procs } as CredentialProceduresResponse));

      component['initializeArchivedTable']();
      tick();

      expect(component.dataSource.data).toHaveLength(0);
    }));

    it('dataSource should be empty when API returns empty list', fakeAsync(() => {
      jest.spyOn(statusService, 'addStatusClass').mockReturnValue([]);
      credentialProcedureSpy.mockReturnValue(of({ credential_procedures: [] } as CredentialProceduresResponse));

      component['initializeArchivedTable']();
      tick();

      expect(component.dataSource.data).toHaveLength(0);
    }));
  });

  describe('onRowClick (navigation to detail)', () => {
    it('should navigate to /organization/credentials/details/:id on row click', () => {
      const proc = makeProc('nav-1', 'ARCHIVED');
      component.onRowClick(proc);
      expect(router.navigate).toHaveBeenCalledWith([
        '/organization/credentials/details',
        'nav-1',
      ]);
    });

    it('should navigate with the correct procedureId when multiple archived exist', () => {
      const proc = makeProc('nav-2', 'ARCHIVED');
      component.onRowClick(proc);
      expect(router.navigate).toHaveBeenCalledWith([
        '/organization/credentials/details',
        'nav-2',
      ]);
    });
  });

  it('should log error and set isLoading to false when fetch fails', fakeAsync(() => {
    const error = new Error('network error');
    credentialProcedureSpy.mockReturnValue(throwError(() => error));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    component['initializeArchivedTable']();
    tick();

    expect(consoleSpy).toHaveBeenCalledWith('Error fetching archived credentials', error);
    expect(component.isLoading).toBe(false);
    consoleSpy.mockRestore();
  }));

  it('should call initializeArchivedTable on ngOnInit', () => {
    const loadSpy = jest.spyOn(component as any, 'initializeArchivedTable');
    component.ngOnInit();
    expect(loadSpy).toHaveBeenCalledTimes(1);
  });

  it('should run setFilter and setStringSearchSubscription in ngAfterViewInit', () => {
    const filterSpy = jest.spyOn(component as any, 'setFilterPredicate');
    const searchSpy = jest.spyOn(component as any, 'setStringSearchSubscription');
    component.ngAfterViewInit();
    expect(filterSpy).toHaveBeenCalledWith('subject');
    expect(searchSpy).toHaveBeenCalledTimes(1);
  });

  it('should set dataSource filter and reset paginator on search', fakeAsync(() => {
    component.dataSource['_paginator'] = { firstPage: jest.fn() } as any;
    const paginatorSpy = jest.spyOn(component.dataSource.paginator!, 'firstPage');

    component['searchSubject'].next('FOO');
    tick(500);

    expect(component.dataSource.filter).toBe('foo');
    expect(paginatorSpy).toHaveBeenCalled();
  }));

  it('should focus and select input when opening the search bar', () => {
    component.hideSearchBar = true;
    const { el, focusSpy, selectSpy } = createMockInput();
    component.searchInput = new ElementRef<HTMLInputElement>(el);

    component.toggleSearchBar();

    expect(component.hideSearchBar).toBe(false);
    expect(focusSpy).toHaveBeenCalled();
    expect(selectSpy).toHaveBeenCalled();
  });

  it('should clear value and go to first page when closing the search bar', () => {
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

  it('should add tenant column when cross-tenant data is present', fakeAsync(() => {
    const archWithTenant: CredentialProcedureBasicInfo = {
      credential_procedure: {
        ...makeProc('t1', 'ARCHIVED').credential_procedure,
        tenant: 'tenant-A',
      },
    };
    jest.spyOn(statusService, 'addStatusClass').mockReturnValue([{ ...archWithTenant, statusClass: 'status-archived' }]);
    credentialProcedureSpy.mockReturnValue(
      of({ credential_procedures: [archWithTenant] } as CredentialProceduresResponse)
    );

    component['initializeArchivedTable']();
    tick();

    expect(component.displayedColumns).toContain('tenant');
    expect(component.displayedColumns[0]).toBe('tenant');
  }));
});
