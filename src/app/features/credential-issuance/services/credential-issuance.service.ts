import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { computed, inject, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup } from '@angular/forms';
import { CredentialProcedureService } from 'src/app/core/services/credential-procedure.service';
import { IssuanceDelivery, IssuanceGrantType, IssuanceLEARCredentialRequestDto, IssuanceResponseDto } from 'src/app/core/models/dto/lear-credential-issuance-request.dto';
import { IssuanceRequestFactoryService } from './issuance-request-factory.service';
import { catchError, EMPTY, from, map, Observable, of, startWith, switchMap, tap, timeout } from 'rxjs';
import { IssuanceSchemaBuilder } from './issuance-schema-builders/issuance-schema-builder';
import { CredentialFormatOption, CredentialIssuanceViewModelField, CredentialIssuanceViewModelSchemaWithId, DELIVERY_OPTIONS, DeliveryOption, FORMAT_LABEL_MAP, GRANT_TYPE_OPTIONS, GrantTypeOption, IssuanceCredentialType, IssuanceRawCredentialPayload, IssuanceStaticViewModel, IssuanceViewModelsTuple } from 'src/app/core/models/entity/lear-credential-issuance';
import { ExtendedValidatorFn, ValidatorEntry } from 'src/app/core/models/entity/validator-types';
import { ALL_VALIDATORS_FACTORY_MAP, ValidatorName } from 'src/app/shared/validators/credential-issuance/all-validators';
import { MatSelect } from '@angular/material/select';
import { TranslateService } from '@ngx-translate/core';
import { CanDeactivateType } from 'src/app/core/guards/can-component-deactivate.guard';
import { DialogComponent } from 'src/app/shared/components/dialog/dialog-component/dialog.component';
import { ConditionalConfirmDialogData, DialogData } from 'src/app/shared/components/dialog/dialog-data';
import { ConditionalConfirmDialogComponent } from 'src/app/shared/components/dialog/conditional-confirm-dialog/conditional-confirm-dialog.component';
import { DialogWrapperService } from 'src/app/shared/components/dialog/dialog-wrapper/dialog-wrapper.service';
import { CredentialOfferDialogComponent, CredentialOfferDialogData } from 'src/app/shared/components/dialog/credential-offer-dialog/credential-offer-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { CredentialIssuerMetadataService } from 'src/app/core/services/credential-issuer-metadata.service';
import { ClaimDefinitionDto } from 'src/app/core/models/dto/credential-issuer-metadata.dto';


@Injectable() //provided in Issuance Component
export class CredentialIssuanceService {

  // ES-05: without this limit, an Issuer that doesn't respond leaves the async dialog in a
  // loading state indefinitely. Generous value against the NFR-S-EUD71-01 threshold, which
  // is still pending definition by the team (proposed starting point: p95 < 2 s).
  private static readonly ISSUANCE_REQUEST_TIMEOUT_MS = 30_000;

  // CREDENTIAL TYPE SELECTOR
  // AD-1: derived from the tenant-filtered metadata (CredentialIssuerMetadataService). With no
  // metadata => empty list (fail-closed, EC-01/EC-04). Only recomputed when loadMetadata()
  // resolves, because getIssuableCredentialTypes() reads an internal signal of the metadata service.
  public readonly credentialTypesArr$ = computed<IssuanceCredentialType[]>(
    () => this.metadataService.getIssuableCredentialTypes()
  );

  // EC-04 vs EC-01: same empty list, different message. Resolved by the template (T3).
  public readonly isCatalogUnavailable$ = computed<boolean>(
    () => this.metadataService.hasMetadataLoadFailed()
  );
  public selectedCredentialType$ = signal<IssuanceCredentialType|undefined>(undefined);

  // FORMAT SELECTOR
  // Options derived from the metadata endpoint; falls back to jwt_vc_json if metadata not loaded yet
  public availableFormats$ = computed<CredentialFormatOption[]>(() => {
    const type = this.selectedCredentialType$();
    if (!type) return [];
    const configs = this.metadataService.findConfigurationsForType(type);
    if (configs.length === 0) {
      return [{ configId: type, format: 'jwt_vc_json', labelKey: FORMAT_LABEL_MAP['jwt_vc_json']! }];
    }
    return configs.map(({ configId, format }) => ({
      configId,
      format: format as CredentialFormatOption['format'],
      labelKey: FORMAT_LABEL_MAP[format as CredentialFormatOption['format']] ?? format,
      disabled: format === 'mso_mdoc'
    }));
  });

  // Explicitly selected format option; auto-selects first non-disabled when null
  public selectedFormatOption$ = signal<CredentialFormatOption | null>(null);

  public effectiveFormatOption$ = computed<CredentialFormatOption | null>(() => {
    const sel = this.selectedFormatOption$();
    if (sel) return sel;
    const avail = this.availableFormats$();
    return avail.find(f => !f.disabled) ?? avail[0] ?? null;
  });

  // GRANT TYPE SELECTOR
  public readonly grantTypeOptions: Readonly<GrantTypeOption[]> = GRANT_TYPE_OPTIONS;
  public selectedGrantType$ = signal<GrantTypeOption>(GRANT_TYPE_OPTIONS[0]);

  // DELIVERY SELECTOR
  public readonly deliveryOptions: Readonly<DeliveryOption[]> = DELIVERY_OPTIONS;
  public selectedDelivery$ = signal<DeliveryOption>(DELIVERY_OPTIONS[0]);

  // AD-2: claims come from the config that will actually be sent to the backend
  // (effectiveFormatOption.configId), not from the type: two formats of the same
  // type can declare different definitions.
  public selectedConfigClaims$ = computed<readonly ClaimDefinitionDto[] | undefined>(() => {
    const configId = this.effectiveFormatOption$()?.configId;
    if (!configId) return undefined;
    return this.metadataService.getConfigurationById(configId)?.credential_metadata?.claims;
  });

  // BUILD SCHEMAS FROM CREDENTIAL TYPE
  public credentialViewModels$ = computed<IssuanceViewModelsTuple | null>(() =>
    this.selectedCredentialType$()
    ? this.issuanceViewModelsBuilder(this.selectedCredentialType$()!, this.onBehalf$(), this.selectedConfigClaims$())
    : null
  );

  // SIDE (STATIC CREDENTIAL DATA)
  public staticData$ = computed<IssuanceStaticViewModel | null>(() => {
    const schema = this.credentialViewModels$();
    const staticData = schema?.[1] ?? null;
    return staticData && Object.keys(staticData).length > 0
    ? staticData
    : null;
  });


  // MAIN (FORM SCHEMA AND FORM GROUP)
  public credentialFormSchema$ = computed<CredentialIssuanceViewModelSchemaWithId | null>(() => {
    const schema = this.credentialViewModels$();
    return schema ?
    schema[0] :
    null
  });

  public form$ = computed<FormGroup>(() => {
    return this.credentialFormSchema$()
      ? this.formBuilder(this.credentialFormSchema$()!, this.onBehalf$())
      : new FormGroup({})
  });

  public formValue$ = toSignal(
    toObservable(this.form$).pipe(
      switchMap(f => f.valueChanges.pipe(startWith(f.getRawValue())))
    ),
    { initialValue: this.form$().getRawValue() }
  ) as Signal<Record<string, any>>;

  public isFormValid$ = toSignal(
    toObservable(this.form$).pipe(
      switchMap(f => f.statusChanges.pipe(startWith(f.status))),
      map((status) => status === 'VALID')
    ),
    { initialValue: this.form$().valid }
  );

  // OTHER STATES
  public onBehalf$ = signal<boolean>(false);
  // avoids "canLeave alert" after submitting and being redirected to home
  public hasSubmitted$ = signal<boolean>(false);

  // alert messages that are displayed above the submit button
  public bottomAlertMessages$: WritableSignal<string[]> = signal([]);

  private readonly credentialRequestFactory = inject(IssuanceRequestFactoryService);
  private readonly credentialProcedureService = inject(CredentialProcedureService);
  private readonly dialog = inject(DialogWrapperService);
  private readonly matDialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly schemaBuilder = inject(IssuanceSchemaBuilder);
  private readonly translate = inject(TranslateService);
  private readonly metadataService = inject(CredentialIssuerMetadataService);

  constructor() {
    // Load credential configurations once so format options are available,
    // and, since EUD-71, also the list of issuable types (AD-1).
    this.metadataService.loadMetadata()
      .pipe(takeUntilDestroyed())
      .subscribe();
  }

  public updateSelectedType(selectedCredentialType: IssuanceCredentialType, select: MatSelect) {
    const currentType = this.selectedCredentialType$();
    const hasChangedType = currentType !== undefined && currentType !== selectedCredentialType
    if (hasChangedType && !this.canLeave()) {
      const alertMsg = this.translate.instant("credentialIssuance.changeCredentialAlert");
      const shouldChange = globalThis.confirm(alertMsg);

      if (!shouldChange) {
        select.value = currentType;
        return;
      }
    }
    this.selectedCredentialType$.set(selectedCredentialType);
    this.selectedFormatOption$.set(null); // reset format when type changes
  }

  public updateSelectedFormat(option: CredentialFormatOption): void {
    this.selectedFormatOption$.set(option);
  }

  public updateSelectedGrantType(option: GrantTypeOption): void {
    this.selectedGrantType$.set(option);
  }

  public updateSelectedDelivery(option: DeliveryOption): void {
    this.selectedDelivery$.set(option);
  }

  // if the message is new, add it; otherwise, delete it
  // this is called by some custom form child components
  public updateAlertMessages(messages: string[]): void{
    const currentMessages = this.bottomAlertMessages$();

    const updatedMessages = [...currentMessages];

    for (const message of messages) {
      const index = updatedMessages.indexOf(message);
      if (index !== -1) {
        updatedMessages.splice(index, 1);
      } else {
        updatedMessages.push(message);
      }
    }
    this.bottomAlertMessages$.set(updatedMessages);
}

  public canLeave(): boolean{
    const dataHasBeenUpdated = this.form$().dirty;
    return this.hasSubmitted$() || !dataHasBeenUpdated;
  }

  public canDeactivate(): CanDeactivateType {
      const canLeave = this.canLeave();
      if(canLeave) return canLeave;
      return this.openLeaveConfirm();
  }

  public openLeaveConfirm(): boolean{
    const alertMsg = this.translate.instant("credentialIssuance.unloadAlert");
    const confirm = globalThis.confirm(alertMsg);
    return confirm;
  }

  // this is the default dialog to confirm the form submission
  public openSubmitDialog() {
    const dialogData: DialogData = {
      title: this.translate.instant("credentialIssuance.create-confirm-dialog.title"),
      message: this.translate.instant("credentialIssuance.create-confirm-dialog.message"),
      confirmationType: 'async',
      status: 'default',
      loadingData: {
        title: this.translate.instant("credentialIssuance.creating-credential"),
        message: ''
      }
    };

    this.dialog.openDialogWithCallback(DialogComponent, dialogData, this.submitAsCallback);
  }

  // LEARCredentialMachine needs a dialog with a checkbox to confirm
  public openLEARCredentialMachineSubmitDialog(){
    const dialogData: ConditionalConfirmDialogData = {
          title: this.translate.instant("credentialIssuance.create-confirm-dialog.title"),
          message: this.translate.instant("credentialIssuance.create-confirm-dialog.message"),
          checkboxLabel: this.translate.instant("credentialIssuance.create-confirm-dialog.checkboxLabel"),
          belowText: this.translate.instant("credentialIssuance.create-confirm-dialog.belowText"),
          status: 'default',
          confirmationType: 'async',
          loadingData: {
            title: this.translate.instant("credentialIssuance.creating-credential"),
            message: ''
          }
        };


    this.dialog.openDialogWithCallback(ConditionalConfirmDialogComponent, dialogData, this.submitAsCallback);
  }

  private issuanceViewModelsBuilder(
    credType: "learcredential.employee" | "learcredential.machine",
    onBehalf: boolean,
    claims?: readonly ClaimDefinitionDto[]
  ): IssuanceViewModelsTuple{
    return this.schemaBuilder.formSchemasBuilder(credType, onBehalf, claims);
  }

  private formBuilder(
  schema: CredentialIssuanceViewModelField[],
  onBehalf: boolean
): FormGroup {
  const controls: Record<string, AbstractControl> = {};

  for (const field of schema) {
    if (
      field.type === 'group' &&
      !onBehalf &&
      (field.display === 'pref_side' || field.display === 'side')
    ) {
      continue;
    }

    switch (field.type) {
      case 'control': {
        const validators = (field.validators ?? [])
          .map(this.getValidatorFn)
          .filter((v): v is ExtendedValidatorFn => !!v);

        const initialValue = field.staticValueGetter?.() ?? null;

        controls[field.key] = new FormControl(initialValue, { validators });
        break;
      }

      case 'group': {
        const childSchema = field.groupFields ?? [];
        controls[field.key] = this.formBuilder(childSchema, onBehalf);
        break;
      }

    }
  }

  return new FormGroup(controls);
}

  private readonly submitAsCallback = (): Observable<any> => {
      return this.submitCredentialPayload();
  };

  private submitCredentialPayload(): Observable<any>{
      const formValue = this.formValue$();
      const credentialType = this.selectedCredentialType$();
      const credentialSchema = this.credentialFormSchema$();
      const formatOption = this.effectiveFormatOption$();
      if(!this.isFormValid$()){
        console.error('Invalid form values! Cannot submit.');
        return of(EMPTY);
      }
      if(!credentialType || !credentialSchema){
        console.error('SubmitCredential: type or schema missing!');
        return of(EMPTY);
      }

      const rawCredentialPayload: IssuanceRawCredentialPayload = {
        formData: formValue,
        staticData: this.staticData$(),
        onBehalf: this.onBehalf$()
      }

      const configId = formatOption?.configId ?? credentialType;
      const grantType = this.selectedGrantType$().value;
      const delivery = this.selectedDelivery$().value;
      const request = this.buildCredentialRequest(rawCredentialPayload, credentialType, configId, delivery, grantType);

      return this.sendCredentialRequest(request).pipe(
        timeout(CredentialIssuanceService.ISSUANCE_REQUEST_TIMEOUT_MS),
        tap(() => { this.hasSubmitted$.set(true); }),
        // AD-3 correction: `credential_offer_uri` is only populated by the backend for
        // DeliveryMode.UI ("Código QR"; `returnsUri=true`), never for EMAIL (`returnsUri=false`).
        // So this branch is already scoped to the QR delivery mode -- removing it (as an
        // earlier version of this Story did) broke the "Código QR" option's only purpose:
        // showing the wallet-scannable QR (CredentialOfferDialogComponent, angularx-qrcode).
        // AC-05's "no offer artifacts" is still honored for email/direct delivery, where the
        // response never carries this URI.
        switchMap((response) => {
          if (response?.credential_offer_uri) {
            return this.openCredentialOfferDialog(response.credential_offer_uri);
          }
          return this.openSuccessfulCreateDialog();
        }),
        switchMap(() => from(this.navigateToCredentials())),
        catchError((error: unknown) => this.handleIssuanceFailure(error))
      );
    }

  private navigateToCredentials(): Promise<boolean> {
    return this.router.navigate(['/organization/credentials']);
  }

  private buildCredentialRequest(
    credentialData: IssuanceRawCredentialPayload,
    credentialType: IssuanceCredentialType,
    configId: string,
    delivery: IssuanceDelivery,
    grantType: IssuanceGrantType,
  ): IssuanceLEARCredentialRequestDto {
    return this.credentialRequestFactory.createCredentialRequest(credentialData, credentialType, configId, delivery, grantType);
  }


  private getValidatorFn(entry: ValidatorEntry<ValidatorName>): ExtendedValidatorFn | null {
    const factory = ALL_VALIDATORS_FACTORY_MAP[entry.name];
    return factory ? factory(...(entry.args ?? [])) : null;
  }

  private sendCredentialRequest(credentialPayload: IssuanceLEARCredentialRequestDto): Observable<IssuanceResponseDto> {
    return this.credentialProcedureService.createProcedure(credentialPayload);
  }

  private openCredentialOfferDialog(credentialOfferUri: string): Observable<any> {
    const dialogData: CredentialOfferDialogData = { credentialOfferUri };
    const dialogRef = this.matDialog.open(CredentialOfferDialogComponent, {
      data: dialogData,
      autoFocus: false,
      width: '420px',
      panelClass: 'dialog-custom'
    });
    return dialogRef.afterClosed();
  }

  private openSuccessfulCreateDialog(): Observable<any>{
    const dialogData: DialogData = {
      title: this.translate.instant("credentialIssuance.create-success-dialog.title"),
      message: this.translate.instant("credentialIssuance.create-success-dialog.message"),
      confirmationType: 'none',
      status: 'default'
    };

    const dialogRef = this.dialog.openDialog(DialogComponent, dialogData);
    return dialogRef.afterClosed();
  }

  /**
   * AC-06 / ES-01, ES-02, ES-04, ES-05.
   * DialogWrapperService.openDialogWithCallback() only does console.error() on a callback
   * error: it releases the loader but leaves the confirmation dialog open and the Operator
   * with no failure signal at all. This closes that gap without touching the generic wrapper
   * (other flows consume it): we return an observable that COMPLETES, so the wrapper's
   * `complete` closes the confirmation dialog and the failure one stays visible.
   *
   * The form is not reset and there's no navigation: the entered data must survive for the
   * retry. `hasSubmitted$` is not touched either, since it's only set inside the success
   * path's `tap`, so the canLeave() guard keeps protecting what was written.
   */
  private handleIssuanceFailure(error: unknown): Observable<any> {
    console.error('POST /api/v1/issuances failed', error);
    this.openFailedCreateDialog();
    return EMPTY;
  }

  private openFailedCreateDialog(): Observable<any> {
    // ES-02: generic message for any cause (400/403/5xx/timeout). Distinguishing by status
    // code would leak to the Operator which configurations are enabled for their tenant.
    const dialogData: DialogData = {
      title: this.translate.instant("credentialIssuance.create-error-dialog.title"),
      message: this.translate.instant("credentialIssuance.create-error-dialog.message"),
      confirmationType: 'none',
      status: 'error'
    };

    const dialogRef = this.dialog.openDialog(DialogComponent, dialogData);
    return dialogRef.afterClosed();
  }

}
