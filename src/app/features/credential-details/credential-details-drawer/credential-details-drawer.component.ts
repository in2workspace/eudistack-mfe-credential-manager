import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, computed, effect, inject, Injector, OnInit, Signal, WritableSignal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { PortalModule } from '@angular/cdk/portal';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { CustomTooltipDirective } from 'src/app/shared/directives/custom-tooltip.directive';
import { AddPrefixPipe } from 'src/app/shared/pipes/add-prefix.pipe';
import { CapitalizePipe } from 'src/app/shared/pipes/capitalize.pipe';
import { LocalizedDatePipe } from 'src/app/shared/pipes/localized-date.pipe';
import { LoaderService } from 'src/app/shared/services/loader.service';
import { KNOWLEDGEBASE_PATH } from 'src/app/core/constants/knowledge.constants';
import { LifeCycleStatus } from 'src/app/core/models/entity/lear-credential';
import { EvaluatedExtendedDetailsField } from 'src/app/core/models/entity/lear-credential-details';
import { StatusClass } from 'src/app/core/models/entity/lear-credential-management';
import { ThemeService } from 'src/app/core/services/theme.service';
import { CredentialDetailsService, CredentialFormatDisplay } from '../services/credential-details.service';

export interface CredentialDetailsDrawerData {
  procedureId: string;
  lastUpdated: Signal<string | undefined>;
}


@Component({
  selector: 'app-credential-details-drawer',
  standalone: true,
  imports: [
    AddPrefixPipe,
    CapitalizePipe,
    AsyncPipe,
    DatePipe,
    CustomTooltipDirective,
    LocalizedDatePipe,
    MatButton,
    MatIcon,
    PortalModule,
    TranslatePipe,
  ],
  providers: [CredentialDetailsService],
  templateUrl: './credential-details-drawer.component.html',
  styleUrl: './credential-details-drawer.component.scss',
})
export class CredentialDetailsDrawerComponent implements OnInit {
  public readonly credentialValidFrom$: Signal<string>;
  public readonly credentialValidUntil$: Signal<string>;
  public readonly credentialDisplayName$: Signal<string>;
  public readonly credentialTypeFamilyLabelKey$: Signal<string | undefined>;
  public readonly lifeCycleStatus$: Signal<LifeCycleStatus | undefined>;
  public readonly lifeCycleStatusClass$: Signal<StatusClass | undefined>;
  public readonly email$: Signal<string | undefined>;
  public readonly issuerOrganization$: Signal<string | undefined>;
  public readonly credentialFormat$: Signal<CredentialFormatDisplay | undefined>;
  // Hidden until the design team answers how the credential information section should look.
  public readonly showCredentialInformation = false;
  // Hidden for now: the contact email stays out of the drawer until it is asked for.
  public readonly showContactEmail = false;

  public readonly mainViewModel$: WritableSignal<EvaluatedExtendedDetailsField[] | undefined>;

  public readonly showRevokeCredentialButton$: Signal<boolean>;
  public readonly enableRevokeCredentialButton$: Signal<boolean>;
  public readonly showWithdrawCredentialButton$: Signal<boolean>;
  public readonly showArchiveCredentialButton$: Signal<boolean>;

  public readonly isLoading$: Observable<boolean>;

  public readonly tooltipText = 'credentialDetails.revokeTooltip';
  public readonly knowledgeBaseUrl: string;

  public readonly revokedAt$: Signal<string | undefined>;
  public readonly missingCredential$: Signal<boolean>;

  private readonly data = inject<CredentialDetailsDrawerData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<CredentialDetailsDrawerComponent>>(MatDialogRef);
  private readonly detailsService = inject(CredentialDetailsService);
  private readonly themeService = inject(ThemeService);
  private readonly injector = inject(Injector);
  private readonly loader = inject(LoaderService);

  public constructor() {
    this.isLoading$ = this.loader.isLoading$;
    this.knowledgeBaseUrl =this.themeService.knowledgeBaseUrl + KNOWLEDGEBASE_PATH.ISSUER + KNOWLEDGEBASE_PATH.ISSUER_REVOKATION;
    this.credentialValidFrom$ = this.detailsService.credentialValidFrom$;
    this.credentialValidUntil$ = this.detailsService.credentialValidUntil$;
    this.credentialDisplayName$ = this.detailsService.credentialDisplayName$;
    this.credentialTypeFamilyLabelKey$ = this.detailsService.credentialTypeFamilyLabelKey$;
    this.lifeCycleStatus$ = this.detailsService.lifeCycleStatus$;
    this.lifeCycleStatusClass$ = this.detailsService.lifeCycleStatusClass$;
    this.email$ = this.detailsService.email$;
    this.issuerOrganization$ = this.detailsService.issuerOrganization$;
    this.credentialFormat$ = this.detailsService.credentialFormat$;
    this.mainViewModel$ = this.detailsService.mainViewModel$;
    this.showRevokeCredentialButton$ = this.detailsService.showRevokeCredentialButton$;
    this.enableRevokeCredentialButton$ = this.detailsService.enableRevokeCredentialButton$;
    this.showWithdrawCredentialButton$ = this.detailsService.showWithdrawCredentialButton$;
    this.showArchiveCredentialButton$ = this.detailsService.showArchiveCredentialButton$;

    // Fragile but correct today: the backend exposes no revocation instant, so this is the row's
    // last update, which matches the revocation only while nothing else writes a revoked record.
    this.revokedAt$ = computed<string | undefined>(() =>
      this.lifeCycleStatus$() === 'REVOKED' ? this.data.lastUpdated() : undefined
    );
    this.missingCredential$ = computed(() => this.detailsService.loadError$() === 'missingCredential');

    effect(() => {
      if (this.detailsService.loadError$() === 'request') this.close();
    });
  }

  public isPowersSection(section: EvaluatedExtendedDetailsField): boolean {
    return Boolean(section.custom) && (section.key ?? '').toLowerCase().includes('power');
  }

  public ngOnInit(): void {
    this.detailsService.setProcedureId(this.data.procedureId);
    this.detailsService.loadCredentialModels(this.injector);
  }

  public close(): void {
    this.dialogRef.close();
  }

  public openWithdrawCredentialDialog(): void {
    this.detailsService.openWithdrawCredentialDialog();
  }

  public openRevokeCredentialDialog(): void {
    this.detailsService.openRevokeCredentialDialog();
  }

  public openArchiveCredentialDialog(): void {
    this.detailsService.openArchiveCredentialDialog();
  }
}
