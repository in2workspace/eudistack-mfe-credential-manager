import { Injectable } from '@angular/core';
import { CredentialProcedureBasicInfo } from 'src/app/core/models/dto/credential-procedures-response.dto';
import { LifeCycleStatus } from 'src/app/core/models/entity/lear-credential';
import { CredentialProcedureWithClass, StatusClass, DefinedStatusClass, StatusClassFromDefined, STATUSES_WITH_DEFINED_CLASS, STATUS_ICON_MAP, DEFAULT_STATUS_ICON } from 'src/app/core/models/entity/lear-credential-management';

@Injectable({
  providedIn: 'root'
})
export class LifeCycleStatusService {

  private readonly statusesWithDefinedClass = STATUSES_WITH_DEFINED_CLASS;

    public addStatusClass(credentialProcedure: CredentialProcedureBasicInfo[]): CredentialProcedureWithClass[]{
      const procedureWithStatus: CredentialProcedureWithClass[] = credentialProcedure.map(cred => {
        const credStatus: string = this.mapStatusToClass(cred.credential_procedure.status);
        return { ...cred, statusClass: credStatus };
      
      });
      return procedureWithStatus;
    }
  
    public mapStatusToClass(status: LifeCycleStatus): StatusClass{
      if (this.statusesWithDefinedClass.includes(status as DefinedStatusClass)) {
        const slug = status.toLowerCase().replaceAll('_', '-'); //for statuses like "PEND_DOWNLOAD"
        return `status-${slug}` as StatusClassFromDefined;
      }
      return 'status-default';
    }

    /**
     * Material icon ligature for the Status column (one icon per status, tooltip
     * carries the label). ISSUED rarely persists in practice — activateIfReady on
     * the issuer flips DRAFT->ISSUED->VALID in the same round trip unless the
     * credential has a future validFrom (delayed activation) — but still gets its
     * own icon for that case.
     */
    public getStatusIcon(status: string): string {
      return STATUS_ICON_MAP[status] ?? DEFAULT_STATUS_ICON;
    }
}
