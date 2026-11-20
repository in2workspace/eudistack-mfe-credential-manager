import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuditAccessDeniedComponent } from './audit-access-denied.component';

describe('AuditAccessDeniedComponent', () => {
  let fixture: ComponentFixture<AuditAccessDeniedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuditAccessDeniedComponent, TranslateModule.forRoot()],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(AuditAccessDeniedComponent);
    fixture.detectChanges();
  });

  it('tells the auditor there is no access, and whom to ask', () => {
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('h1')?.textContent).toContain('audit.denied.title');
    expect(element.querySelector('#audit-denied-message')?.textContent).toContain('audit.denied.message');
  });

  it('offers a way back to the start page', () => {
    const home = fixture.nativeElement.querySelector('#audit-denied-home') as HTMLAnchorElement;

    expect(home.getAttribute('href')).toBe('/home');
    expect(home.textContent).toContain('audit.denied.home');
  });
});
