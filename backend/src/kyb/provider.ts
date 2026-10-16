/**
 * What the KYB flow needs from a verification provider (docs/kyb.md section 7).
 * The flow layer only uses these shapes, so another provider can be added without touching it.
 */

export type ProviderDecision = 'accept' | 'review' | 'reject';

export interface ProviderWarning {
  code: string;
  description?: string;
  severity?: string;
  decision?: string;
}

export interface CompanyCheckResult {
  transactionId: string;
  decision: ProviderDecision;
  warnings: ProviderWarning[];
  /** Null when no official registry result was available; the decision then rests on the document alone. */
  registry: { found: boolean; active: boolean | null; source: string | null; legalName: string | null; status: string | null } | null;
  /** Read from the certificate. Empty strings when a field could not be read. */
  company: {
    legalName: string;
    registrationNumber: string;
    country: string;
    address: string;
    incorporationDate: string;
    entityType: string;
    status: string;
  };
  /** Directors, officers, shareholders, beneficial owners and signatories named on the certificate. */
  principals: { name: string; role: string; ownershipPercent: number | null }[];
}

export interface PersonSession {
  reference: string;
  url: string;
  /** Base64 PNG, for showing a code to continue on a phone. */
  qrCode: string | null;
  expiresAt: Date | null;
}

export type PersonSessionStatus = 'pending' | 'expired' | ProviderDecision;

export interface PersonSessionResult {
  status: PersonSessionStatus;
  transactionId: string | null;
  warnings: ProviderWarning[];
  /** Read from the ID document once the session is done. Empty strings for fields the document did not show. */
  person: { name: string; dob: string; nationality: string } | null;
}

/** One record from the sanctions, PEP and crime lists that matched a name search. */
export interface AmlRecord {
  id: string;
  names: string[];
  birthDates: string[];
  countries: string[];
  topics: string[];
  score: number;
}

export interface KybProvider {
  readonly name: string;
  verifyCompany(document: { data: Buffer; mimeType: string }): Promise<CompanyCheckResult>;
  /**
   * An ID document, selfie and liveness session for one person. With a name and birth date, the document is
   * cross-checked against them; without, they are read from it (the applicant's own check).
   */
  createPersonSession(input: { name?: string; dob?: string; customData: string }): Promise<PersonSession>;
  getPersonSession(reference: string): Promise<PersonSessionResult>;
  searchAml(name: string): Promise<AmlRecord[]>;
}

export const KYB_PROVIDER = Symbol('KYB_PROVIDER');

/** The provider refused or failed the request. `status` is the provider's HTTP status, 0 when unreachable. */
export class ProviderError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
