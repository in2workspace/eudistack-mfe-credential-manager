import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { computed, effect, inject, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup } from '@angular/forms';
import { CredentialProcedureService } from 'src/app/core/services/credential-procedure.service';
import { IssuanceDeliveryResultDto, IssuanceGrantType, IssuanceLEARCredentialRequestDto, IssuanceResponseDto } from 'src/app/core/models/dto/lear-credential-issuance-request.dto';
import { IssuanceRequestFactoryService } from './issuance-request-factory.service';
import { catchError, defer, EMPTY, finalize, forkJoin, from, map, Observable, of, startWith, switchMap, tap, timeout } from 'rxjs';
import { IssuanceSchemaBuilder } from './issuance-schema-builders/issuance-schema-builder';
import { parseCredentialConfigurationId } from 'src/app/core/helpers/credential-configuration-id';
import { CredentialFormatOption, CredentialIssuanceViewModelField, CredentialIssuanceViewModelSchemaWithId, DELIVERY_OPTIONS, DeliveryMode, DeliveryOption, FORMAT_LABEL_MAP, GRANT_TYPE_OPTIONS, GrantTypeOption, HolderKeyMaterial, IssuanceCredentialType, IssuanceRawCredentialPayload, IssuanceStaticViewModel, IssuanceViewModelsTuple } from 'src/app/core/models/entity/lear-credential-issuance';
import { ExtendedValidatorFn, ValidatorEntry } from 'src/app/core/models/entity/validator-types';
import { ALL_VALIDATORS_FACTORY_MAP, ValidatorName } from 'src/app/shared/validators/credential-issuance/all-validators';
import { MatSelect } from '@angular/material/select';
import { TranslateService } from '@ngx-translate/core';
import { CanDeactivateType } from 'src/app/core/guards/can-component-deactivate.guard';
import { DialogComponent } from 'src/app/shared/components/dialog/dialog-component/dialog.component';
import { DialogData } from 'src/app/shared/components/dialog/dialog-data';
import { DialogWrapperService } from 'src/app/shared/components/dialog/dialog-wrapper/dialog-wrapper.service';
import { CredentialOfferDialogComponent, CredentialOfferDialogData } from 'src/app/shared/components/dialog/credential-offer-dialog/credential-offer-dialog.component';
import { IssuanceResultDialogComponent, IssuanceResultDialogData } from 'src/app/shared/components/dialog/issuance-result-dialog/issuance-result-dialog.component';
import { KeyGeneratorService } from './key-generator.service';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { CredentialIssuerMetadataService } from 'src/app/core/services/credential-issuer-metadata.service';
import { IssuanceUiPolicyService } from 'src/app/core/services/issuance-ui-policy.service';
import { ClaimDefinitionDto } from 'src/app/core/models/dto/credential-issuer-metadata.dto';
import { UnsavedChangesService } from 'src/app/shared/services/unsaved-changes.service';

/** Issuance-specific wording for the shared "pending edits will be lost" prompt. */
const UNSAVED_ISSUANCE_ALERT_KEY = 'credentialIssuance.unloadAlert';

/**
 * Last line of defence for "one radio button per type+format".
 *
 * `findConfigurationsForType()` already keeps a single configuration per type+format lineage,
 * and the format segment of an id maps one-to-one to the declared `format` (`w3c` ->
 * `jwt_vc_json`, `sd` -> `dc+sd-jwt`, `mdoc` -> `mso_mdoc`), so under well-formed metadata
 * this is a no-op. It only bites if two different lineages ever declare the SAME format:
 * both would be labelled through FORMAT_LABEL_MAP with the same string, leaving the Operator
 * two indistinguishable controls and no way to know which one they are submitting.
 *
 * The survivor is the highest version, so the guard agrees with the rule it backs up rather
 * than depending on the order the metadata happens to declare things in; on a tie — or on ids
 * with no version, which the metadata service does not return anyway — the first wins.
 */
function oneOptionPerFormat(
  configs: readonly { configId: string; format: string }[]
): { configId: string; format: string }[] {
  const versionOf = (configId: string) => parseCredentialConfigurationId(configId)?.version ?? 0;
  const winnerByFormat = new Map<string, { configId: string; format: string }>();

  for (const config of configs) {
    const incumbent = winnerByFormat.get(config.format);
    if (!incumbent || versionOf(config.configId) > versionOf(incumbent.configId)) {
      winnerByFormat.set(config.format, config);
    }
  }
  // Map iteration follows insertion order => the metadata's declaration order is preserved.
  return [...winnerByFormat.values()];
}

@Injectable() //provided in Issuance Component
export class CredentialIssuanceService {

  // ES-05: without this limit, an Issuer that doesn't respond leaves the async dialog in a
  // loading state indefinitely. Generous value against the NFR-S-EUD71-01 threshold, which
  // is still pending definition by the team (proposed starting point: p95 < 2 s).
  private static readonly ISSUANCE_REQUEST_TIMEOUT_MS = 30_000;

  // CREDENTIAL TYPE SELECTOR
  private readonly _isLoadingCatalog$ = signal<boolean>(true);
  public readonly isLoadingCatalog$ = this._isLoadingCatalog$.asReadonly();

  // AD-1: derived from the tenant-filtered metadata (CredentialIssuerMetadataService). With no
  // metadata => empty list (fail-closed, EC-01/EC-04). Only recomputed when loadMetadata()
  // resolves, because getIssuableCredentialTypes() reads an internal signal of the metadata service.
  public readonly credentialTypesArr$ = computed<IssuanceCredentialType[]>(
    () => this.metadataService.getIssuableCredentialTypes()
  );

  // EC-04 vs EC-01: same empty list, different message. Resolved by the template (T3).
  //
  // Two sources can leave the selector empty for a reason the Operator cannot act on: the
  // issuer metadata, and the tenant's published issuance UI policy — which is fail-closed, so
  // an unusable document means "no forms", not "no restrictions". Neither is the same as a
  // policy that legitimately allows nothing, which stays on the EC-01 message.
  public readonly isCatalogUnavailable$ = computed<boolean>(
    () => this.metadataService.hasMetadataLoadFailed() || this.issuanceUiPolicy.loadFailed()
  );
  public selectedCredentialType$ = signal<IssuanceCredentialType|undefined>(undefined);

  // FORMAT SELECTOR
  // Options derived from the metadata endpoint; falls back to jwt_vc_json if metadata not loaded yet.
  //
  // findConfigurationsForType() already returns a single configuration per type+format — the
  // newest version of each — so the selector shows one radio button per format instead of one
  // per version. Picking one here means the claims read off it (selectedConfigClaims$) and the
  // configId sent on submit both belong to that newest version.
  public availableFormats$ = computed<CredentialFormatOption[]>(() => {
    const type = this.selectedCredentialType$();
    if (!type) return [];
    const configs = this.metadataService.findConfigurationsForType(type);
    if (configs.length === 0) {
      return [{ configId: type, format: 'jwt_vc_json', labelKey: FORMAT_LABEL_MAP['jwt_vc_json']! }];
    }
    return oneOptionPerFormat(configs).map(({ configId, format }) => ({
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

  /**
   * Delivery modes the Operator picked. More than one is allowed (the backend takes CSV), and
   * `email` is the default because it is the channel that always works.
   */
  public selectedDeliveryModes$ = signal<ReadonlySet<DeliveryMode>>(new Set<DeliveryMode>(['email']));

  /**
   * Which modes the selected configuration can actually be delivered through.
   *
   * `email` and `ui` always can. `direct` only when the configuration declares no cryptographic
   * binding method: declaring one means the holder key arrives through an OID4VCI wallet proof,
   * and direct delivery has neither wallet nor proof, so the backend would refuse it
   * (`CredentialProfile.directDeliveryEligible()`).
   *
   * Keyed on the configId, not on the type: two formats of one type can declare different
   * binding methods, and the configId is what the request carries.
   */
  public readonly availableDeliveryOptions$ = computed<DeliveryOption[]>(() => {
    const configId = this.effectiveFormatOption$()?.configId;
    const directEligible = !!configId && this.metadataService.isDirectDeliveryEligible(configId);
    return DELIVERY_OPTIONS.filter(option => option.value !== 'direct' || directEligible);
  });

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
      map(() => this.isSubmissionAllowed())
    ),
    { initialValue: this.isSubmissionAllowed() }
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
  private readonly issuanceUiPolicy = inject(IssuanceUiPolicyService);
  private readonly unsavedChanges = inject(UnsavedChangesService);
  private readonly keyGenerator = inject(KeyGeneratorService);

  constructor() {
    // Load credential configurations once so format options are available,
    // and, since EUD-71, also the list of issuable types (AD-1).
    //
    // Alongside them, the tenant's issuance UI policy — this is the screen that needs it, and
    // the only one. `load()` is memoized, so this is normally already resolved by the
    // warm-up main.ts starts at bootstrap; when it is not (a slow document, or a future host
    // that does not run this app's bootstrap), the wait lands here instead of in front of
    // every other screen. Both are started at once rather than chained: neither needs the
    // other's result, and the selector reads them through signals that recompute on their own.
    //
    // Until both settle the screen has nothing truthful to say about the catalogue, so it says
    // exactly that (isLoadingCatalog$) instead of letting the still-empty type list speak for it.
    forkJoin([
      defer(() => this.issuanceUiPolicy.load()),
      this.metadataService.loadMetadata(),
    ])
      .pipe(
        takeUntilDestroyed(),
        // `finalize` rather than the subscriber's `complete`: today neither source can fail the
        // stream (loadMetadata() swallows its own error, load() never rejects), so the flag
        // would fall either way — but if that ever changes, a spinner that never stops is a
        // worse outcome than the empty state it replaces.
        finalize(() => this._isLoadingCatalog$.set(false))
      )
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

  /**
   * Adds or removes one delivery mode.
   *
   * Unchecking the last remaining mode is refused rather than silently re-adding a default: an
   * issuance with no delivery mode has nowhere to go, and the checkbox of the only selected mode
   * is disabled in the template so this is a backstop, not the primary guard.
   */
  public toggleDelivery(mode: DeliveryMode, selected: boolean): void {
    const modes = new Set(this.selectedDeliveryModes$());
    if (selected) {
      modes.add(mode);
    } else {
      if (modes.size === 1) return;
      modes.delete(mode);
    }
    this.selectedDeliveryModes$.set(modes);
  }

  public isDeliverySelected(mode: DeliveryMode): boolean {
    return this.selectedDeliveryModes$().has(mode);
  }

  /**
   * Keeps the selection inside what the current configuration allows.
   *
   * Changing type or format can withdraw `direct`. Leaving it selected would submit a mode the
   * checkbox list no longer even shows, so it is dropped; if that empties the selection, it
   * falls back to the first available mode.
   */
  private readonly pruneUnavailableDeliveryModes = effect(() => {
    const available = new Set(this.availableDeliveryOptions$().map(option => option.value));
    const selected = this.selectedDeliveryModes$();
    const kept = [...selected].filter(mode => available.has(mode));

    if (kept.length === selected.size) return;

    const fallback = this.availableDeliveryOptions$()[0]?.value;
    this.selectedDeliveryModes$.set(new Set(kept.length > 0 ? kept : (fallback ? [fallback] : [])));
  });

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
      return this.unsavedChanges.canDeactivate(!this.canLeave(), UNSAVED_ISSUANCE_ALERT_KEY);
  }

  public openLeaveConfirm(): boolean{
    return this.unsavedChanges.confirmLeave(UNSAVED_ISSUANCE_ALERT_KEY);
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

  /**
   * Fail-closed (ES-02): without a selected type/schema, or with an empty FormGroup (which
   * Angular treats as VALID by default), the trigger is not allowed. Re-evaluates the current
   * FormGroup state (ES-03) instead of relying on a cached flag.
   */
  private isSubmissionAllowed(): boolean {
    const schema = this.credentialFormSchema$();
    const type = this.selectedCredentialType$();
    const form = this.form$();

    if (!type || !schema || schema.length === 0) {
      return false;
    }
    if (Object.keys(form.controls).length === 0) {
      return false;
    }
    return form.valid;
  }

  private submitCredentialPayload(): Observable<any>{
      if(!this.isSubmissionAllowed()){
        console.error('Invalid form values or missing schema! Cannot submit.');
        return of(EMPTY);
      }

      const formValue = this.formValue$();
      const credentialType = this.selectedCredentialType$();
      const formatOption = this.effectiveFormatOption$();
      if(!credentialType){
        console.error('SubmitCredential: type missing!');
        return of(EMPTY);
      }

      const rawCredentialPayload: IssuanceRawCredentialPayload = {
        formData: formValue,
        staticData: this.staticData$(),
        onBehalf: this.onBehalf$()
      }

      const configId = formatOption?.configId ?? credentialType;
      const grantType = this.selectedGrantType$().value;
      const modes = [...this.selectedDeliveryModes$()];

      // The holder key is generated here and lives in this closure only: the public half reaches
      // the request, the private half reaches the result dialog, and nothing else ever sees it.
      return this.holderKeyIfNeeded$(configId).pipe(
        switchMap(holderKey => {
          const request = this.buildCredentialRequest(rawCredentialPayload, credentialType, configId, modes, grantType, holderKey);

          // catchError lives INSIDE this switchMap so `holderKey` is still in scope on the error
          // path. It used to sit outside, which meant a failed issuance closed with a generic dialog
          // and the generated private key -- which exists nowhere but this closure -- was destroyed,
          // even when the wallet leg had already dispatched a credential bound to it.
          return this.sendCredentialRequest(request).pipe(
            timeout(CredentialIssuanceService.ISSUANCE_REQUEST_TIMEOUT_MS),
            tap(() => { this.hasSubmitted$.set(true); }),
            switchMap(response => this.openResultDialog(modes, response, holderKey)),
            switchMap(() => from(this.navigateToCredentials())),
            catchError((error: unknown) => this.handleIssuanceFailure(error, modes, holderKey))
          );
        }),
        // Outer guard: a failure before the request was even built (key generation, payload assembly)
        // has no holder key to hand over and no per-mode result to report.
        catchError((error: unknown) => this.handleIssuanceFailure(error, modes, undefined))
      );
    }

  /**
   * A holder key, whenever the selected configuration says the request has to supply one.
   *
   * Keyed on the configuration, not on the delivery modes: the issuer requires the key for every
   * mode alike (`CredentialProfile.holderKeyRequired`). A configuration with no cryptographic
   * binding method gets no wallet proof either, so even an email or QR issuance binds to the key
   * generated here — the Operator has to keep it whichever channel delivered the credential.
   *
   * Where a wallet IS in the loop the wallet proves possession of its own key through the OID4VCI
   * proof, and the issuer derives both the cnf and `mandatee.id` from it. Generating one here for
   * such a type would hand the Operator a private key the credential is not bound to.
   */
  private holderKeyIfNeeded$(configId: string): Observable<HolderKeyMaterial | undefined> {
    const needsKey = this.metadataService.isHolderKeyRequired(configId);
    // `of(undefined)` rather than a resolved promise: without a key to generate the chain stays
    // synchronous, exactly as it was before this step existed. Only holder-bound types pay for the await.
    return needsKey ? from(this.keyGenerator.generateHolderKeyPair()) : of(undefined);
  }

  /**
   * Which success dialog to show.
   *
   * The two single wallet modes keep the dialogs they always had, but ONLY when there is no holder
   * key to hand over and no mode came back failed. The result dialog is the only one with a slot
   * for the key, and the only one that can say a mode failed, so either overrides the routing
   * whatever the modes are. Everything else -- any combination of modes, and anything including
   * `direct` -- goes to the multi-box result dialog.
   *
   * The failed-mode check matters most for single-mode `email`: a 200 whose only mode failed used
   * to land on the plain success dialog, telling the Operator the offer had been emailed when the
   * backend had just reported it had not.
   *
   * Which BOXES appear is still decided on the SELECTED modes, not on what the response carries:
   * the dialog must open even when the response came back without the credential token.
   */
  private openResultDialog(
    modes: readonly DeliveryMode[],
    response: IssuanceResponseDto | undefined,
    holderKey: HolderKeyMaterial | undefined
  ): Observable<any> {
    const isSingle = (mode: DeliveryMode) => modes.length === 1 && modes[0] === mode;
    const anyFailed = (response?.delivery_results ?? []).some(result => result.status === 'failed');

    if (!holderKey && !anyFailed) {
      if (isSingle('email')) {
        return this.openSuccessfulCreateDialog();
      }
      if (isSingle('ui') && response?.credential_offer_uri) {
        return this.openCredentialOfferDialog(response.credential_offer_uri);
      }
    }

    return this.openIssuanceResultDialog(modes, response, holderKey, response?.delivery_results);
  }

  private openIssuanceResultDialog(
    modes: readonly DeliveryMode[],
    response: IssuanceResponseDto | undefined,
    holderKey: HolderKeyMaterial | undefined,
    deliveryResults?: readonly IssuanceDeliveryResultDto[],
    failed = false
  ): Observable<any> {
    const dialogData: IssuanceResultDialogData = {
      deliveryModes: modes,
      credentialToken: response?.signed_credential,
      privateKey: holderKey?.privateKeyHex,
      credentialOfferUri: response?.credential_offer_uri,
      deliveryResults,
      failed
    };

    const dialogRef = this.matDialog.open(IssuanceResultDialogComponent, {
      data: dialogData,
      autoFocus: false,
      width: '560px',
      panelClass: 'dialog-custom'
    });
    return dialogRef.afterClosed();
  }

  private navigateToCredentials(): Promise<boolean> {
    return this.router.navigate(['/organization/credentials']);
  }

  private buildCredentialRequest(
    credentialData: IssuanceRawCredentialPayload,
    credentialType: IssuanceCredentialType,
    configId: string,
    deliveryModes: readonly DeliveryMode[],
    grantType: IssuanceGrantType,
    holderKey?: HolderKeyMaterial,
  ): IssuanceLEARCredentialRequestDto {
    return this.credentialRequestFactory.createCredentialRequest(credentialData, credentialType, configId, deliveryModes, grantType, holderKey);
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
  private handleIssuanceFailure(
    error: unknown,
    modes: readonly DeliveryMode[],
    holderKey: HolderKeyMaterial | undefined
  ): Observable<any> {
    console.error('POST /api/v1/issuances failed', error);
    const { deliveryResults, credentialOfferUri } = this.extractFailureBody(error);

    // Two reasons to show the result dialog instead of the generic one, and either is enough:
    // a generated private key exists nowhere else and dies with this closure, and the error body
    // may report that some modes DID dispatch (a hybrid whose direct leg failed still answers 5xx,
    // but its email may have gone out). The generic dialog stays for failures with neither -- a
    // validation error, a 403, a timeout -- where ES-02 wants a cause-agnostic message.
    if (holderKey || deliveryResults) {
      // The offer survives the failure: a channel the issuer reports as dispatched is redeemable
      // whatever the direct leg did, so the QR still has to reach the Operator.
      this.openIssuanceResultDialog(
        modes, { credential_offer_uri: credentialOfferUri }, holderKey, deliveryResults, true);
      return EMPTY;
    }

    this.openFailedCreateDialog();
    return EMPTY;
  }

  /**
   * Reads what an error body can still tell us, defensively: each shape is only trusted when it
   * really is what it claims to be. Anything else (a plain-text 502 from a proxy, an HTML error
   * page, a timeout with no body at all) yields an empty answer, and with no holder key either the
   * caller falls back to the generic failure dialog.
   *
   * `credential_offer_uri` travels on the error side of the contract too: a declared `direct` that
   * fails makes the whole issuance a failure even when the wallet leg produced a perfectly
   * redeemable offer.
   */
  private extractFailureBody(error: unknown): {
    deliveryResults?: readonly IssuanceDeliveryResultDto[];
    credentialOfferUri?: string;
  } {
    const body = (error as { error?: unknown } | null)?.error;
    if (!body || typeof body !== 'object') return {};

    const raw = (body as { delivery_results?: unknown }).delivery_results;
    const results = Array.isArray(raw)
      ? raw.filter((entry): entry is IssuanceDeliveryResultDto =>
          !!entry && typeof entry === 'object'
          && typeof (entry as IssuanceDeliveryResultDto).mode === 'string'
          && typeof (entry as IssuanceDeliveryResultDto).status === 'string')
      : [];

    const offerUri = (body as { credential_offer_uri?: unknown }).credential_offer_uri;

    return {
      deliveryResults: results.length > 0 ? results : undefined,
      credentialOfferUri: typeof offerUri === 'string' && offerUri.length > 0 ? offerUri : undefined
    };
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