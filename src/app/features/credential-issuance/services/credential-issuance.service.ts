import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { computed, DestroyRef, effect, inject, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup } from '@angular/forms';
import { CredentialProcedureService } from 'src/app/core/services/credential-procedure.service';
import { IssuanceGrantType, IssuanceLEARCredentialRequestDto, IssuanceResponseDto } from 'src/app/core/models/dto/lear-credential-issuance-request.dto';
import { IssuanceRequestFactoryService } from './issuance-request-factory.service';
import { catchError, defer, EMPTY, finalize, forkJoin, from, map, Observable, of, startWith, switchMap, tap, timeout } from 'rxjs';
import { IssuanceSchemaBuilder } from './issuance-schema-builders/issuance-schema-builder';
import { parseCredentialConfigurationId } from 'src/app/core/helpers/credential-configuration-id';
import { resolveOfferableDeliveryOptions } from 'src/app/core/helpers/delivery-eligibility';
import { requiresRequestHolderKey } from 'src/app/core/helpers/holder-binding-exemption';
import { HolderKeyStoreService } from 'src/app/core/services/holder-key-store.service';
import { HolderPrivateKeyStore } from 'src/app/core/services/holder-private-key-store.service';
import { IssuanceHolderKeyService } from './issuance-holder-key.service';
import { HolderBinding } from 'src/app/core/models/entity/holder-binding';
import { HolderKeyGenerationError } from 'src/app/core/models/entity/holder-key-generation-error';
import { CredentialCatalogService } from 'src/app/core/services/credential-catalog.service';
import { DeliveryEligibilitySnapshot } from 'src/app/core/models/entity/delivery-eligibility-snapshot';
import { ChannelOutcome, resolveChannelOutcomes } from 'src/app/core/models/entity/issuance-channel-outcome';
import { CredentialFormatOption, CredentialIssuanceViewModelField, CredentialIssuanceViewModelSchemaWithId, DELIVERY_MODE_OPTIONS, DeliveryModeOption, DeliveryModeToken, FORMAT_LABEL_MAP, GRANT_TYPE_OPTIONS, GrantTypeOption, IssuanceCredentialType, IssuanceRawCredentialPayload, IssuanceStaticViewModel, IssuanceViewModelsTuple, WALLET_DELIVERY_MODE_OPTIONS } from 'src/app/core/models/entity/lear-credential-issuance';
import { ExtendedValidatorFn, ValidatorEntry } from 'src/app/core/models/entity/validator-types';
import { ALL_VALIDATORS_FACTORY_MAP, ValidatorName } from 'src/app/shared/validators/credential-issuance/all-validators';
import { MatSelect } from '@angular/material/select';
import { TranslateService } from '@ngx-translate/core';
import { CanDeactivateType } from 'src/app/core/guards/can-component-deactivate.guard';
import { DialogComponent } from 'src/app/shared/components/dialog/dialog-component/dialog.component';
import { DialogData } from 'src/app/shared/components/dialog/dialog-data';
import { DialogWrapperService } from 'src/app/shared/components/dialog/dialog-wrapper/dialog-wrapper.service';
import { CredentialOfferDialogComponent, CredentialOfferDialogData } from 'src/app/shared/components/dialog/credential-offer-dialog/credential-offer-dialog.component';
import { DirectCredentialResultDialogComponent, DirectCredentialResultDialogData } from 'src/app/shared/components/dialog/direct-credential-result-dialog/direct-credential-result-dialog.component';
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

  // AD-11: a second, narrower narrowing of credentialTypesArr$ -- a type is retired only when
  // EVERY configuration the form would offer for it (the latest version per format) has an empty
  // tenant-resolved delivery set (catalogue state 3). Surviving one config is enough to keep the
  // type listed; only the dead format option disappears from availableFormats$.
  public readonly offerableCredentialTypes$ = computed<IssuanceCredentialType[]>(() =>
    this.credentialTypesArr$().filter(type => this.hasOfferableConfiguration(type))
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
    // AD-11: a format option survives only if its own configId is offerable. This is the same
    // predicate offerableCredentialTypes$ aggregates over the whole lineage -- one place decides
    // "is this configId offerable", so the two lists cannot disagree about the same configId.
    return oneOptionPerFormat(configs)
      .filter(({ configId }) => this.isOfferableConfiguration(configId))
      .map(({ configId, format }) => ({
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

  // DELIVERY SELECTOR (EUD-233)
  //
  // The tenant's published delivery-eligibility snapshot governs all three modes in the nominal path
  // (AD-1): a modes array for the current configId, read literally, no re-derivation (AC-02.3). The
  // degraded states (2: pre-EUD-169 Issuer; 4: catalogue unreadable) fall back to the same schema-only
  // rule EUD-168 already had -- a type bound to a holder key cannot be delivered without a wallet --
  // scoped to WALLET_DELIVERY_MODE_OPTIONS, which never contains 'direct'.
  private readonly _deliveryEligibility$ = signal<DeliveryEligibilitySnapshot>({ status: 'unreadable' });

  public readonly offerableModes$ = computed<readonly DeliveryModeOption[]>(() => {
    const configId = this.effectiveFormatOption$()?.configId;
    return configId ? this.resolveOfferableModes(configId) : [];
  });

  public selectedDeliveryModes$: WritableSignal<ReadonlySet<DeliveryModeToken>> = signal(new Set());

  // ES-08: the single trigger for the "catalogue unreadable" banner. States 1/2/3 show nothing --
  // only a fully failed read (state 4) does. Gated on `!isLoadingCatalog$`: `_deliveryEligibility$`
  // starts as `{ status: 'unreadable' }` as its fail-closed placeholder before the initial load
  // resolves (so `resolveOfferableModes` degrades safely if read mid-load), which otherwise made
  // this signal lie -- true for the whole loading window, not just on a genuine failed read --
  // flashing the banner on every normal page load.
  public readonly hasDeliveryCatalogReadFailed$ = computed<boolean>(
    () => !this._isLoadingCatalog$() && this._deliveryEligibility$().status === 'unreadable'
  );

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
  private readonly holderKeyStore = inject(HolderKeyStoreService);
  private readonly holderPrivateKeyStore = inject(HolderPrivateKeyStore);
  private readonly issuanceHolderKeyService = inject(IssuanceHolderKeyService);
  private readonly credentialProcedureService = inject(CredentialProcedureService);
  private readonly dialog = inject(DialogWrapperService);
  private readonly matDialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly schemaBuilder = inject(IssuanceSchemaBuilder);
  private readonly translate = inject(TranslateService);
  private readonly metadataService = inject(CredentialIssuerMetadataService);
  private readonly issuanceUiPolicy = inject(IssuanceUiPolicyService);
  private readonly unsavedChanges = inject(UnsavedChangesService);
  private readonly credentialCatalogService = inject(CredentialCatalogService);

  constructor() {
    // AD-6 cleanup point 6: substitutes for the deleted KeyGeneratorComponent's ngOnDestroy --
    // belt-and-suspenders alongside the per-attempt clears already threaded through the submit
    // flow below, for whatever a submission left behind if this service is torn down mid-flight.
    inject(DestroyRef).onDestroy(() => this.issuanceHolderKeyService.clear());

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
    // Since EUD-233, a third source joins the same wait: the tenant's delivery-eligibility
    // snapshot (AD-11). `loadDeliveryEligibility()` never fails the stream (Task 7) -- it degrades
    // internally to catalogue state 4 -- so joining it here cannot leave `isLoadingCatalog$` stuck.
    //
    // Until all three settle the screen has nothing truthful to say about the catalogue, so it says
    // exactly that (isLoadingCatalog$) instead of letting the still-empty type list speak for it.
    forkJoin([
      defer(() => this.issuanceUiPolicy.load()),
      this.metadataService.loadMetadata(),
      this.credentialCatalogService.loadDeliveryEligibility(),
    ])
      .pipe(
        takeUntilDestroyed(),
        tap(([, , deliveryEligibility]) => this._deliveryEligibility$.set(deliveryEligibility)),
        // `finalize` rather than the subscriber's `complete`: none of the three sources can fail
        // the stream (loadMetadata() swallows its own error, load() never rejects,
        // loadDeliveryEligibility() degrades instead of erroring), so the flag would fall either
        // way — but if that ever changes, a spinner that never stops is a worse outcome than the
        // empty state it replaces.
        finalize(() => this._isLoadingCatalog$.set(false))
      )
      .subscribe();

    effect(() => {
      const offerableOptions = this.offerableModes$();
      const offerable = new Set(offerableOptions.map(option => option.value));
      const current = this.selectedDeliveryModes$();
      const pruned = new Set([...current].filter(mode => offerable.has(mode)));

      if (pruned.size === 0) {
        const defaultMode: DeliveryModeToken | undefined = offerable.has('direct')
          ? 'direct'
          : offerable.has('email') ? 'email' : undefined;
        if (defaultMode) {
          pruned.add(defaultMode);
        }
      }

      const unchanged = pruned.size === current.size && [...pruned].every(mode => current.has(mode));
      if (!unchanged) {
        this.selectedDeliveryModes$.set(pruned);
      }
    });
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

  /** AD-4/AD-13: a checkbox toggle, never a value swap -- no path exists that unmarks another mode. */
  public toggleDeliveryMode(token: DeliveryModeToken, checked: boolean): void {
    const current = this.selectedDeliveryModes$();
    const next = new Set(current);
    if (checked) {
      next.add(token);
    } else {
      next.delete(token);
    }
    this.selectedDeliveryModes$.set(next);
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

  /**
   * The one place that resolves "which delivery modes does this configId offer" (EUD-233 AD-9),
   * shared by offerableModes$ (the current selection) and isOfferableConfiguration (any configId
   * in the type/format lists) -- a second implementation of the same branching would risk the two
   * disagreeing about the same configId, which AC-02.3 forbids.
   */
  private resolveOfferableModes(configId: string): readonly DeliveryModeOption[] {
    const snapshot = this._deliveryEligibility$();
    const modes = snapshot.status === 'read' ? snapshot.modesByConfigId.get(configId) : undefined;

    if (modes !== undefined) {
      // States 1 and 3: literally what the tenant catalogue resolved. Filtering the fixed
      // DELIVERY_MODE_OPTIONS catalogue by membership (rather than mapping over `modes` directly)
      // keeps render order at direct -> ui -> email regardless of the wire array's own order.
      return DELIVERY_MODE_OPTIONS.filter(option => modes.includes(option.value));
    }

    // States 2 (no entry for this configId) and 4 (whole read unreadable) share the exact same
    // fallback per AD-9's table: the schema-derived, wallet-only catalogue.
    const config = this.metadataService.getConfigurationById(configId);
    return resolveOfferableDeliveryOptions(config, WALLET_DELIVERY_MODE_OPTIONS);
  }

  /**
   * AD-11's single predicate: a configId is offerable unless the tenant catalogue resolved it to
   * an explicit empty set (state 3) -- states 1/2/4 are never empty (the degraded fallback,
   * WALLET_DELIVERY_MODE_OPTIONS, always has two entries).
   */
  private isOfferableConfiguration(configId: string): boolean {
    return this.resolveOfferableModes(configId).length > 0;
  }

  /**
   * AD-11 aggregation rule: true if at least one configuration the form would offer for this type
   * (the latest version per format -- the same set availableFormats$ shows) is offerable. A type
   * with no declared configs at all (the synthetic jwt_vc_json fallback, predates AD-11) is never
   * filtered by this: there is no real configId to check a delivery snapshot against.
   */
  private hasOfferableConfiguration(type: IssuanceCredentialType): boolean {
    const configs = this.metadataService.findConfigurationsForType(type);
    if (configs.length === 0) {
      return true;
    }
    return oneOptionPerFormat(configs).some(({ configId }) => this.isOfferableConfiguration(configId));
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
      const deliveryModes = [...this.selectedDeliveryModes$()];
      // AD-6: one submission, one crypto.randomUUID() -- correlates the private-key handoff's seal
      // (HolderPrivateKeyStore) with this exact attempt, never with a prior or later one. Not the
      // same value as X-Idempotency-Key, which CredentialProcedureService mints on its own, per
      // HTTP call (R-13, §3.4 carrera nº 5).
      const submissionId = globalThis.crypto.randomUUID();
      // AD-6 cleanup point 1: clear-then-set -- a fresh attempt never inherits a private key an
      // earlier, abandoned attempt generated but never completed.
      this.holderPrivateKeyStore.clear();
      const holderBinding$: Observable<HolderBinding | undefined> = requiresRequestHolderKey(configId)
        ? from(this.issuanceHolderKeyService.generateForSubmission(configId, submissionId))
        : of(undefined);

      return holderBinding$.pipe(
        map(holderBinding => this.attachHolderKey(
          this.buildCredentialRequest(rawCredentialPayload, credentialType, configId, deliveryModes, grantType, holderBinding),
          configId,
          submissionId
        )),
        switchMap(request => this.sendCredentialRequest(request).pipe(
          timeout(CredentialIssuanceService.ISSUANCE_REQUEST_TIMEOUT_MS)
        )),
        switchMap((response) => {
          // AD-7 (EUD-233): a 207 Multi-Status is still a 2xx to HttpClient (EUD-167 D-5/D-6), so it never
          // reaches catchError -- each requested channel's outcome is read out of the body here,
          // on the success path.
          const outcomes = resolveChannelOutcomes(response?.responses ?? [], deliveryModes);
          const anyDelivered = [...outcomes.values()].includes('delivered');
          const directDeclared = deliveryModes.includes('direct');
          const needsHolderKeySection = !directDeclared && requiresRequestHolderKey(configId);

          // EUD-233 AD-8's one exception to "nothing delivered => total failure": a machine type's
          // wallet-only emission that produced a credential (envelope present -- guaranteed by
          // reaching this success branch at all) still owes the key even if the one Wallet channel
          // it declared failed to trigger.
          const isTotalFailure = !anyDelivered && !needsHolderKeySection;
          if (isTotalFailure) {
            this.holderPrivateKeyStore.clear();
            this.openFailedCreateDialog();
            return EMPTY;
          }
          // EUD-233: hasSubmitted$ is now fixed on the envelope being present, not on "some channel
          // delivered" (AD-8): a 207 where direct was not requested but a wallet channel failed
          // still means a credential exists in server, and canLeave() must stay true so the
          // Operator's own canDeactivateGuard does not fight the close-guard AC-14 puts on the
          // post-emission surface (carrera nº 6, §3.4).
          this.hasSubmitted$.set(true);
          this.holderKeyStore.clear();

          if (directDeclared && outcomes.get('direct') === 'delivered') {
            const privateKeyHex = this.takeSealedPrivateKey(configId, submissionId);
            return this.openDirectCredentialResultDialog(response, requiresRequestHolderKey(configId), privateKeyHex, outcomes);
          }
          if (directDeclared) {
            // direct was declared but failed/missing
            this.holderPrivateKeyStore.clear();
            return this.openCredentialOfferDialog(this.extractCredentialOfferUri(response), false, undefined, outcomes);
          }
          // direct not declared at all
          if (needsHolderKeySection) {
            const privateKeyHex = this.takeSealedPrivateKey(configId, submissionId);
            return this.openCredentialOfferDialog(this.extractCredentialOfferUri(response), true, privateKeyHex, outcomes);
          }
  
          const credentialOfferUri = this.extractCredentialOfferUri(response);
          if (credentialOfferUri) {
            return this.openCredentialOfferDialog(credentialOfferUri, false, undefined, outcomes);
          }
          return this.openSuccessfulCreateDialog();
        }),
        switchMap(() => from(this.navigateToCredentials())),
        catchError((error: unknown) => this.handleIssuanceFailure(error))
      );
    }

  /**
   * The offer URI, wherever in `responses[]` it landed. Backend only builds one when the requested
   * modes include `ui` (`returnsUri`), and only the `ui` channel's `body` ever carries it -- `email`'s
   * `body` is always absent, whether or not `ui` is also requested, since that URI was already
   * delivered inside the email itself. Reading across every channel rather than assuming a fixed index
   * still costs nothing and keeps this resilient if the backend ever adds another URI-bearing channel.
   */
  private extractCredentialOfferUri(response: IssuanceResponseDto | undefined): string | undefined {
    return response?.responses?.find(channel => channel.body?.credential_offer_uri)?.body?.credential_offer_uri;
  }

  /**
   * Attaches the holder key for the credential types that take their `cnf` from the issuance request
   * (EUD-168 AD-8), and for no others.
   *
   * Not gated on the delivery mode: a type with no `proof_types_supported` gets no wallet key proof
   * either, so even an email or QR issuance binds to the key generated for this attempt.
   *
   * Reads `HolderKeyStoreService` with `peek()`, not destructively: it is a plain carrier for
   * whatever `IssuanceHolderKeyService.generateForSubmission()` wrote moments earlier in this same
   * attempt (AD-6), not a queue to drain. Verifies the entry's seal against this exact attempt
   * (`configId` + `submissionId`, hardened 2026-09-17 to match `takeSealedPrivateKey`'s own check)
   * before trusting it -- a missing or mismatched entry is treated the same as no key at all and
   * left to the Issuer to reject, which answers with a 400 naming the field -- a better outcome
   * than issuing without one, or with one that belongs to a different attempt.
   */
  private attachHolderKey(
    request: IssuanceLEARCredentialRequestDto,
    configId: string,
    submissionId: string
  ): IssuanceLEARCredentialRequestDto {
    if (!requiresRequestHolderKey(configId)) {
      this.holderKeyStore.clear();
      return request;
    }
    const entry = this.holderKeyStore.peek();
    if (!entry) {
      return request;
    }
    const sealMatches = entry.credentialConfigurationId === configId && entry.submissionId === submissionId;
    return sealMatches ? { ...request, holder_key: { jwk: entry.publicJwk } } : request;
  }

  /**
   * Destructive read of the private-key handoff, verified against this exact attempt: a
   * seal mismatch -- or an empty store, e.g. a reload between submit and response destroying the
   * root store -- degrades exactly like absence, never surfaces a key that belongs to another
   * attempt.
   */
  private takeSealedPrivateKey(credentialConfigurationId: string, submissionId: string): string | undefined {
    const entry = this.holderPrivateKeyStore.take();
    if (!entry) {
      return undefined;
    }
    const sealMatches = entry.credentialConfigurationId === credentialConfigurationId
      && entry.submissionId === submissionId;
    return sealMatches ? entry.privateKeyHex : undefined;
  }

  private navigateToCredentials(): Promise<boolean> {
    return this.router.navigate(['/organization/credentials']);
  }

  private buildCredentialRequest(
    credentialData: IssuanceRawCredentialPayload,
    credentialType: IssuanceCredentialType,
    configId: string,
    deliveryModes: readonly DeliveryModeToken[],
    grantType: IssuanceGrantType,
    holderBinding: HolderBinding | undefined,
  ): IssuanceLEARCredentialRequestDto {
    return this.credentialRequestFactory.createCredentialRequest(credentialData, credentialType, configId, holderBinding, deliveryModes, grantType);
  }


  private getValidatorFn(entry: ValidatorEntry<ValidatorName>): ExtendedValidatorFn | null {
    const factory = ALL_VALIDATORS_FACTORY_MAP[entry.name];
    return factory ? factory(...(entry.args ?? [])) : null;
  }

  private sendCredentialRequest(credentialPayload: IssuanceLEARCredentialRequestDto): Observable<IssuanceResponseDto> {
    return this.credentialProcedureService.createProcedure(credentialPayload);
  }

  private openCredentialOfferDialog(
    credentialOfferUri: string | undefined,
    requiresHolderKeySection: boolean,
    privateKeyHex: string | undefined,
    outcomes: ReadonlyMap<DeliveryModeToken, ChannelOutcome>
  ): Observable<any> {
    const dialogData: CredentialOfferDialogData = { credentialOfferUri, requiresHolderKeySection, privateKeyHex, outcomes };
    const dialogRef = this.matDialog.open(CredentialOfferDialogComponent, {
      data: dialogData,
      autoFocus: false,
      width: '420px',
      panelClass: 'dialog-custom',
      // closeOnNavigation must be false whenever UncopiedArtifactCloseGuard is active, or
      // Material closes the dialog on NavigationStart before the guard's popstate listener ever
      // gets a chance to react to the browser's back button.
      disableClose: requiresHolderKeySection,
      closeOnNavigation: !requiresHolderKeySection
    });
    return dialogRef.afterClosed().pipe(tap(() => this.holderPrivateKeyStore.clear()));
  }

  /**
   * The direct-delivery success surface: always opened with
   * `disableClose: true` + `closeOnNavigation: false`, per the contract documented on
   * `DirectCredentialResultDialogComponent` -- `UncopiedArtifactCloseGuard` is unconditionally
   * active here, since the signed credential is always at least one artifact to protect.
   */
  private openDirectCredentialResultDialog(
    response: IssuanceResponseDto,
    requiresHolderKeySection: boolean,
    privateKeyHex: string | undefined,
    outcomes: ReadonlyMap<DeliveryModeToken, ChannelOutcome>
  ): Observable<any> {
    const signedCredential = response.responses?.find(channel => channel.channel === 'direct')?.body?.signed_credential;
    if (!signedCredential) {
      // Defensive, should be unreachable: resolveChannelOutcomes() already treats a body-less
      // direct 2xx as 'missing', never 'delivered' (ES-02), so this branch is never selected for
      // a response that lacks the artifact this dialog exists to present.
      console.error('Direct channel resolved as delivered without a signed_credential body.');
      this.openFailedCreateDialog();
      return EMPTY;
    }
    const dialogData: DirectCredentialResultDialogData = {
      signedCredential,
      requiresHolderKeySection,
      privateKeyHex,
      outcomes,
      credentialOfferUri: this.extractCredentialOfferUri(response)
    };
    const dialogRef = this.matDialog.open(DirectCredentialResultDialogComponent, {
      data: dialogData,
      autoFocus: false,
      disableClose: true,
      closeOnNavigation: false,
      panelClass: 'dialog-custom'
    });
    // AD-6 cleanup point 4: belt-and-suspenders alongside the take() that already drained this
    // attempt's entry before the dialog opened -- guards a future code path that reaches this
    // dialog without having taken it first.
    return dialogRef.afterClosed().pipe(tap(() => this.holderPrivateKeyStore.clear()));
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
    // AD-15: ES-09 already left its own closed-allowlist trace in IssuanceHolderKeyService --
    // logging the raw error here too would print its `cause`/stack, which that allowlist exists
    // to keep out of the console. No POST was sent for this case either, so the generic message
    // below would also be factually wrong for it.
    if (error instanceof HolderKeyGenerationError) {
      console.error({ event: 'issuance_submit_aborted', reason: 'holder_key_generation_failed' });
    } else {
      console.error('POST /api/v1/issuances failed', error);
    }
    // AD-6 cleanup point 2: a transport failure (incl. ES-09's HolderKeyGenerationError, which
    // reaches this same catchError) leaves nothing to hand over on any surface.
    this.holderPrivateKeyStore.clear();
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