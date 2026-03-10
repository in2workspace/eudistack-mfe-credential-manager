import { CustomTooltipDirective } from './../../shared/directives/custom-tooltip.directive';
import { MatCard, MatCardContent } from '@angular/material/card';
import { Component, inject, Injector, OnInit, Signal, WritableSignal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';
import { MatIcon } from '@angular/material/icon';
import { MatButton } from '@angular/material/button';
import { LoaderService } from 'src/app/shared/services/loader.service';
import { CapitalizePipe } from 'src/app/shared/pipes/capitalize.pipe';
import { AddPrefixPipe } from 'src/app/shared/pipes/add-prefix.pipe';
import { CredentialDetailsService } from './services/credential-details.service';
import { PortalModule } from '@angular/cdk/portal';
import { CredentialStatus, CredentialType, LifeCycleStatus } from 'src/app/core/models/entity/lear-credential';
import { Observable } from 'rxjs';
import { EvaluatedExtendedDetailsField } from 'src/app/core/models/entity/lear-credential-details';
import { StatusClass } from 'src/app/core/models/entity/lear-credential-management';
import { KNOWLEDGEBASE_PATH } from 'src/app/core/constants/knowledge.constants';
import { environment } from 'src/environments/environment';
import { trigger, transition, style, animate } from '@angular/animations';


@Component({
    imports: [AddPrefixPipe, CapitalizePipe, CommonModule, CustomTooltipDirective, FormsModule, MatButton, MatCard, MatCardContent, MatFormField, MatIcon, MatInput, MatLabel, PortalModule, ReactiveFormsModule, RouterLink, TranslatePipe],
    providers: [CredentialDetailsService],
    selector: 'app-credential-details',
    templateUrl: './credential-details.component.html',
    styleUrl: './credential-details.component.scss',
    animations: [
      trigger('fadeSlideIn', [
        transition(':enter', [
          style({ opacity: 0, transform: 'translateY(12px)' }),
          animate('400ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
        ])
      ])
    ]
})
export class CredentialDetailsComponent implements OnInit {
  
  //SIGNALS
  //Credential data
  public credentialValidFrom$: Signal<string>;
  public credentialValidUntil$: Signal<string>
  public credentialType$: Signal<CredentialType | undefined>;
  public lifeCycleStatus$: Signal<LifeCycleStatus | undefined>;
  public lifeCycleStatusClass$: Signal<StatusClass | undefined>;
  public email$: Signal<string | undefined>;
  public credentialStatus$: Signal<CredentialStatus | undefined>;
  //Models
  public mainViewModel$: WritableSignal<EvaluatedExtendedDetailsField[] | undefined>; // credentialSubject data
  public sideViewModel$: WritableSignal<EvaluatedExtendedDetailsField[] | undefined>;
  public showSideTemplateCard$: Signal<boolean>;
  // Buttons
  public showSignCredentialButton$: Signal<boolean>;
  public showRevokeCredentialButton$: Signal<boolean>;
  public enableRevokeCredentialButton$: Signal<boolean>;
  public showWithdrawCredentialButton$: Signal<boolean>;
  public showActionsButtonsContainer$: Signal<boolean>;
  
  //OBSERVABLES
  public isLoading$: Observable<boolean>;

  //RAW VARIABLES
  public tooltipText: string = "credentialDetails.revokeTooltip";
  public knowledgeBaseUrl = environment.knowledge_base_url + KNOWLEDGEBASE_PATH.ISSUER + KNOWLEDGEBASE_PATH.ISSUER_REVOKATION;

  private readonly route = inject(ActivatedRoute);
  private readonly detailsService = inject(CredentialDetailsService);
  private readonly injector = inject(Injector);
  private readonly loader = inject(LoaderService);

  public constructor(){
    this.isLoading$ = this.loader.isLoading$;
    this.credentialValidFrom$ = this.detailsService.credentialValidFrom$;
    this.credentialValidUntil$ = this.detailsService.credentialValidUntil$;
    this.credentialType$ = this.detailsService.credentialType$;
    this.lifeCycleStatus$ = this.detailsService.lifeCycleStatus$;
    this.lifeCycleStatusClass$ = this.detailsService.lifeCycleStatusClass$;
    this.email$ = this.detailsService.email$;
    this.credentialStatus$ = this.detailsService.credentialStatus$;
    this.mainViewModel$ = this.detailsService.mainViewModel$;
    this.sideViewModel$ = this.detailsService.sideViewModel$;
    this.showSideTemplateCard$ = this.detailsService.showSideTemplateCard$;
    this.showSignCredentialButton$ = this.detailsService.showSignCredentialButton$;
    this.showRevokeCredentialButton$ = this.detailsService.showRevokeCredentialButton$;
    this.enableRevokeCredentialButton$ = this.detailsService.enableRevokeCredentialButton$;
    this.showWithdrawCredentialButton$ = this.detailsService.showWithdrawCredentialButton$;
    this.showActionsButtonsContainer$ = this.detailsService.showActionsButtonsContainer$;
  }

  public ngOnInit(): void {
    this.getProcedureId();
    this.loadViewModel();
  }

  // SIGN
  public openSignCredentialDialog(){
    this.detailsService.openSignCredentialDialog();
  }

  // WITHDRAW
  public openWithdrawCredentialDialog(){
    this.detailsService.openWithdrawCredentialDialog();
  }

  // REVOKE
  public openRevokeCredentialDialog(){
    this.detailsService.openRevokeCredentialDialog();
  }
  
  // DATA FETCHING
  private getProcedureId(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.detailsService.setProcedureId(id);
  }

  private loadViewModel(): void {
    this.detailsService.loadCredentialModels(this.injector);
  }

}
