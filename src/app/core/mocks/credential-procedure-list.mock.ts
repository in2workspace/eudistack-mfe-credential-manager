import { CredentialProceduresResponse } from "../models/dto/credential-procedures-response.dto";

export const credentialProceduresResponseMock: CredentialProceduresResponse = {
  credential_procedures: [
    {
      credential_procedure: {
        procedure_id: 'proc-001',
        subject: 'John Doe',
        credential_type: "learcredential.employee.w3c.1",
        status: "VALID",
        issued_at: '2025-01-05T09:30:00Z',
        expires_at: '2026-01-05T09:30:00Z',
        updated: '2025-01-10T09:30:00Z',
        email: 'john.doe@example.com',
        organization_identifier: 'ORG-123'
      }
    },
    {
      credential_procedure: {
        procedure_id: 'proc-002',
        subject: 'Jane Smith',
        credential_type: "learcredential.employee.w3c.1",
        status: "PEND_DOWNLOAD",
        issued_at: '2025-01-04T15:12:00Z',
        expires_at: '2026-01-04T15:12:00Z',
        updated: '2025-01-09T15:12:00Z',
        email: 'jane.smith@example.com',
        organization_identifier: 'ORG-456'
      }
    }
  ]
};
