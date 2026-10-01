import { CommonModule } from '@angular/common';
import { Component, computed, inject, Injector, OnInit, Signal, WritableSignal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { PortalModule } from '@angular/cdk/portal';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { CustomTooltipDirective } from 'src/app/shared/directives/custom-tooltip.directive';
import { AddPrefixPipe } from 'src/app/shared/pipes/add-prefix.pipe';
import { CapitalizePipe } from 'src/app/shared/pipes/capitalize.pipe';
import { LoaderService } from 'src/app/shared/services/loader.service';
import { KNOWLEDGEBASE_PATH } from 'src/app/core/constants/knowledge.constants';
import { LifeCycleStatus } from 'src/app/core/models/entity/lear-credential';
import { EvaluatedExtendedDetailsField } from 'src/app/core/models/entity/lear-credential-details';
import { CredentialFormat, FORMAT_LABEL_MAP } from 'src/app/core/models/entity/lear-credential-issuance';
import { StatusClass } from 'src/app/core/models/entity/lear-credential-management';
import { ThemeService } from 'src/app/core/services/theme.service';
import { CredentialDetailsService } from '../services/credential-details.service';

export interface CredentialDetailsDrawerData {
  procedureId: string;
  lastUpdated?: string;
}


@Component({
  selector: 'app-credential-details-drawer',
  standalone: true,
  imports: [
    AddPrefixPipe,
    CapitalizePipe,
    CommonModule,
    CustomTooltipDirective,
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
  /** i18n key of the credential format, or the raw OID4VCI format when it has no label. */
  public readonly credentialFormatLabel$: Signal<string | undefined>;
  // Hidden for now: the contact email stays out of the drawer until it is asked for.
  public readonly showContactEmail = false;

  public readonly mainViewModel$: WritableSignal<EvaluatedExtendedDetailsField[] | undefined>;
  public readonly sideViewModel$: WritableSignal<EvaluatedExtendedDetailsField[] | undefined>;
  public readonly showSideTemplateCard$: Signal<boolean>;

  public readonly showSignCredentialButton$: Signal<boolean>;
  public readonly showRevokeCredentialButton$: Signal<boolean>;
  public readonly enableRevokeCredentialButton$: Signal<boolean>;
  public readonly showWithdrawCredentialButton$: Signal<boolean>;
  public readonly showArchiveCredentialButton$: Signal<boolean>;

  public readonly isLoading$: Observable<boolean>;

  public readonly tooltipText = 'credentialDetails.revokeTooltip';
  public readonly knowledgeBaseUrl: string;

  public readonly revokedAt$: Signal<string | undefined>;

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
    this.credentialFormatLabel$ = computed<string | undefined>(() => {
      const format = this.detailsService.credentialFormat$();
      return format ? FORMAT_LABEL_MAP[format as CredentialFormat] ?? format : undefined;
    });
    this.mainViewModel$ = this.detailsService.mainViewModel$;
    this.sideViewModel$ = this.detailsService.sideViewModel$;
    this.showSideTemplateCard$ = this.detailsService.showSideTemplateCard$;
    this.showSignCredentialButton$ = this.detailsService.showSignCredentialButton$;
    this.showRevokeCredentialButton$ = this.detailsService.showRevokeCredentialButton$;
    this.enableRevokeCredentialButton$ = this.detailsService.enableRevokeCredentialButton$;
    this.showWithdrawCredentialButton$ = this.detailsService.showWithdrawCredentialButton$;
    this.showArchiveCredentialButton$ = this.detailsService.showArchiveCredentialButton$;


    this.revokedAt$ = computed<string | undefined>(() =>
      this.lifeCycleStatus$() === 'REVOKED' ? this.data.lastUpdated : undefined
    );

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

  public openSignCredentialDialog(): void {
    this.detailsService.openSignCredentialDialog();
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
