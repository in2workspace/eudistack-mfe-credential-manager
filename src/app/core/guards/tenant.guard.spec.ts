import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { tenantGuard } from './tenant.guard';
import { TenantService } from '../services/tenant.service';

describe('tenantGuard', () => {
  let routerMock: jest.Mocked<Pick<Router, 'createUrlTree'>>;
  let tenantServiceMock: { tenant: jest.Mock };
  const fakeUrlTree = {} as UrlTree;

  beforeEach(() => {
    routerMock = {
      createUrlTree: jest.fn().mockReturnValue(fakeUrlTree),
    };
    tenantServiceMock = {
      tenant: jest.fn().mockReturnValue(''),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: routerMock },
        { provide: TenantService, useValue: tenantServiceMock },
      ],
    });
  });

  function runGuard(): boolean | UrlTree {
    return TestBed.runInInjectionContext(() => tenantGuard(null as any, null as any)) as boolean | UrlTree;
  }

  it('retorna true per un tenant conegut', () => {
    tenantServiceMock.tenant.mockReturnValue('dome');
    expect(runGuard()).toBe(true);
    expect(routerMock.createUrlTree).not.toHaveBeenCalled();
  });

  it('retorna UrlTree a /tenant-not-found per un tenant desconegut', () => {
    tenantServiceMock.tenant.mockReturnValue('');
    const result = runGuard();
    expect(result).toBe(fakeUrlTree);
    expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/tenant-not-found']);
  });

  it('accepta localhost per desenvolupament', () => {
    tenantServiceMock.tenant.mockReturnValue('localhost');
    expect(runGuard()).toBe(true);
  });
});
