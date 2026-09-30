import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { of, Subject } from 'rxjs';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { TranslateModule } from '@ngx-translate/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { LoaderService } from 'src/app/shared/services/loader.service';
import { EvaluatedExtendedDetailsField } from 'src/app/core/models/entity/lear-credential-details';
import { LifeCycleStatus } from 'src/app/core/models/entity/lear-credential';
import { StatusClass } from 'src/app/core/models/entity/lear-credential-management';
import { CredentialDetailsService } from '../services/credential-details.service';
import { CredentialActionsService } from '../services/credential-actions.service';
import { CredentialDetailsDrawerComponent } from './credential-details-drawer.component';

describe('CredentialDetailsDrawerComponent', () => {
  let fixture: ComponentFixture<CredentialDetailsDrawerComponent>;
  let component: CredentialDetailsDrawerComponent;
  let dialogRef: { close: jest.Mock };
  let actionCompleted$: Subject<void>;

  let lifecycle$: WritableSignal<LifeCycleStatus | undefined>;
  let credential$: WritableSignal<Record<string, unknown> | undefined>;
  let mainModel$: WritableSignal<EvaluatedExtendedDetailsField[] | undefined>;
  let sideModel$: WritableSignal<EvaluatedExtendedDetailsField[] | undefined>;
  let showSide$: WritableSignal<boolean>;
  let showSign$: WritableSignal<boolean>;
  let showRevoke$: WritableSignal<boolean>;
  let showWithdraw$: WritableSignal<boolean>;
  let showArchive$: WritableSignal<boolean>;

  let detailsService: Record<string, unknown>;

  async function createComponent(
    data: { procedureId: string; lastUpdated?: string } = { procedureId: 'the-id' }
  ): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [
        CredentialDetailsDrawerComponent,
        HttpClientTestingModule,
        RouterTestingModule,
        TranslateModule.forRoot(),
      ],
      providers: [
        provideNoopAnimations(),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: CredentialActionsService, useValue: { actionCompleted$ } },
        { provide: LoaderService, useValue: { isLoading$: of(false) } },
      ],
    })
      .overrideComponent(CredentialDetailsDrawerComponent, {
        set: { providers: [{ provide: CredentialDetailsService, useValue: detailsService }] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(CredentialDetailsDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    dialogRef = { close: jest.fn() };
    actionCompleted$ = new Subject<void>();

    lifecycle$ = signal<LifeCycleStatus | undefined>('VALID');
    credential$ = signal<Record<string, unknown> | undefined>({
      issuer: { id: 'did:elsi:issuer', organization: 'Engineering S.p.A.' },
    });
    mainModel$ = signal<EvaluatedExtendedDetailsField[] | undefined>([
      { key: 'mandator', type: 'group', value: [{ key: 'organization', type: 'key-value', value: 'Engineering S.p.A.' }] },
    ] as EvaluatedExtendedDetailsField[]);
    sideModel$ = signal<EvaluatedExtendedDetailsField[] | undefined>([]);
    showSide$ = signal(false);
    showSign$ = signal(false);
    showRevoke$ = signal(false);
    showWithdraw$ = signal(false);
    showArchive$ = signal(false);

    detailsService = {
      credential$,
      credentialValidFrom$: signal('2025-01-01'),
      credentialValidUntil$: signal('2025-12-31'),
      credentialDisplayName$: signal('Employee'),
      lifeCycleStatus$: lifecycle$,
      lifeCycleStatusClass$: signal<StatusClass | undefined>('status-valid'),
      email$: signal('andrea.romano@engineering.it'),
      mainViewModel$: mainModel$,
      sideViewModel$: sideModel$,
      showSideTemplateCard$: showSide$,
      showSignCredentialButton$: showSign$,
      showRevokeCredentialButton$: showRevoke$,
      enableRevokeCredentialButton$: signal(true),
      showWithdrawCredentialButton$: showWithdraw$,
      showArchiveCredentialButton$: showArchive$,
      setProcedureId: jest.fn(),
      loadCredentialModels: jest.fn(),
      openSignCredentialDialog: jest.fn(),
      openRevokeCredentialDialog: jest.fn(),
      openWithdrawCredentialDialog: jest.fn(),
      openArchiveCredentialDialog: jest.fn(),
    };
  });

  afterEach(() => TestBed.resetTestingModule());

  it('loads the credential handed over through the dialog data', async () => {
    await createComponent({ procedureId: 'proc-42' });

    expect(detailsService['setProcedureId']).toHaveBeenCalledWith('proc-42');
    expect(detailsService['loadCredentialModels']).toHaveBeenCalled();
  });

  it('shows the validity window and the contact email the mock was missing', async () => {
    await createComponent();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('01-01-2025');
    expect(text).toContain('31-12-2025');
    expect(text).toContain('andrea.romano@engineering.it');
  });

  it('names the issuer by its common name', async () => {
    credential$.set({ issuer: { id: 'did:elsi:issuer', commonName: 'Sello Electronico', organization: 'ALTIA' } });
    await createComponent();

    expect(component.issuedBy$()).toBe('Sello Electronico');
    expect(fixture.nativeElement.querySelector('.drawer__issued-by')?.textContent)
      .toContain('Sello Electronico');
  });

  it('falls back to the organization, then to the issuer id', async () => {
    credential$.set({ issuer: { id: 'did:elsi:issuer', organization: 'ALTIA' } });
    await createComponent();
    expect(component.issuedBy$()).toBe('ALTIA');

    credential$.set({ issuer: { id: 'did:elsi:issuer' } });
    expect(component.issuedBy$()).toBe('did:elsi:issuer');
  });

  it('accepts a bare string issuer', async () => {
    credential$.set({ issuer: 'did:elsi:issuer' });
    await createComponent();

    expect(component.issuedBy$()).toBe('did:elsi:issuer');
  });

  it('omits the line when the credential carries no issuer', async () => {
    credential$.set({});
    await createComponent();

    expect(fixture.nativeElement.querySelector('.drawer__issued-by')).toBeNull();
  });

  it('renders values as labelled boxes rather than Material form fields', async () => {
    await createComponent();

    expect(fixture.nativeElement.querySelector('mat-form-field')).toBeNull();
    expect(fixture.nativeElement.querySelector('.drawer__field-label')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.drawer__field-box')?.textContent?.trim())
      .toBe('Engineering S.p.A.');
  });

  it('tints only the powers claim, never any other custom-rendered section', async () => {
    await createComponent();

    expect(component.isPowersSection({ key: 'power', custom: {} } as never)).toBe(true);
    expect(component.isPowersSection({ key: 'gx:compliantCredentials', custom: {} } as never)).toBe(false);
    expect(component.isPowersSection({ key: 'power' } as never)).toBe(false);
  });

  it('stamps the revocation date only while the credential is revoked', async () => {
    await createComponent({ procedureId: 'the-id', lastUpdated: '2026-06-25T16:42:00Z' });

    expect(component.revokedAt$()).toBeUndefined();

    lifecycle$.set('REVOKED');
    expect(component.revokedAt$()).toBe('2026-06-25T16:42:00Z');
  });

  it('closes without a result, because refreshing the list is not its job', async () => {
    await createComponent();

    component.close();

    expect(dialogRef.close).toHaveBeenCalledWith();
  });

  it('does not close itself when an action completes', async () => {
    await createComponent();

    actionCompleted$.next();

    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('renders the issuer and credential-status sections once the credential is validated', async () => {
    showSide$.set(true);
    sideModel$.set([
      { key: 'issuer', type: 'group', value: [{ key: 'commonName', type: 'key-value', value: 'Engineering' }] },
      { key: 'credentialStatus', type: 'group', value: [{ key: 'statusListIndex', type: 'key-value', value: '42' }] },
    ] as EvaluatedExtendedDetailsField[]);
    await createComponent();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Engineering');
    expect(text).toContain('42');
  });

  it('offers Close as the primary action when the credential cannot be signed', async () => {
    await createComponent();

    expect(fixture.nativeElement.querySelector('#drawer-close-primary')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#drawer-sign')).toBeNull();
  });

  it.each([
    ['#drawer-sign', 'openSignCredentialDialog', () => showSign$.set(true)],
    ['#drawer-revoke', 'openRevokeCredentialDialog', () => showRevoke$.set(true)],
    ['#drawer-withdraw', 'openWithdrawCredentialDialog', () => showWithdraw$.set(true)],
    ['#drawer-archive', 'openArchiveCredentialDialog', () => showArchive$.set(true)],
  ])('wires %s to %s', async (selector, method, enable) => {
    enable();
    await createComponent();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector(selector);
    expect(button).toBeTruthy();
    button.click();

    expect(detailsService[method]).toHaveBeenCalled();
  });

  it('does not offer a credential-status check — that action is wallet-only', async () => {
    await createComponent();

    expect(fixture.nativeElement.querySelector('#drawer-check-status')).toBeNull();
  });
});
