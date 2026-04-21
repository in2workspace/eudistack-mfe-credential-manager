import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { TenantNotFoundComponent } from './tenant-not-found.component';

describe('TenantNotFoundComponent', () => {
  let fixture: ComponentFixture<TenantNotFoundComponent>;
  let component: TenantNotFoundComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TenantNotFoundComponent, TranslateModule.forRoot()],
    }).compileComponents();

    fixture = TestBed.createComponent(TenantNotFoundComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('deriva la URL de fallback del host actual', () => {
    expect(component.fallbackUrl).toContain('/issuer/home');
    expect(component.fallbackUrl).toMatch(/^https?:\/\//);
  });

  it('goToFallback redirigeix a la URL de fallback', () => {
    const hrefSetter = jest.fn();
    Object.defineProperty(window, 'location', {
      value: { get href() { return ''; }, set href(v: string) { hrefSetter(v); } },
      writable: true,
    });

    component.goToFallback();
    expect(hrefSetter).toHaveBeenCalledWith(component.fallbackUrl);
  });
});
