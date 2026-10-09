import { LifeCycleStatus } from "../entity/lear-credential";

export interface CredentialProceduresResponse {
  credential_procedures: CredentialProcedureBasicInfo[];
}

export interface CredentialProcedureBasicInfo {
  credential_procedure: {
    procedure_id: string;
    subject: string;
    credential_type: CredentialProcedureType;
    status: LifeCycleStatus;
    created_at: string;
    expires_at?: string;
    updated: string;
    organization_identifier: string;
    tenant?: string;
  }
}

export type CredentialProcedureType = string;

