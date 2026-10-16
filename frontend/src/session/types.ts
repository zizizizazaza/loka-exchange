/** Mirrors the backend's GET /api/me response (backend/src/accounts/accounts.service.ts). */
export type AccessTier = 'public' | 'unverified' | 'pending' | 'verified';

export interface Profile {
  user: { id: string; email: string | null };
  wallets: {
    address: string;
    kind: 'EXTERNAL' | 'EMBEDDED';
    delegated: boolean;
    institutionId: string | null;
    whitelisted: boolean;
  }[];
  institutions: { id: string; name: string; role: 'ADMIN' | 'MEMBER'; kybStatus: string }[];
  accessTier: Exclude<AccessTier, 'public'>;
}

export interface ApiError {
  status: number;
  code: string;
  message: string;
  /** Submission problems from POST /api/kyb/submit, as short codes. */
  problems?: string[];
  /** The verification provider's error code, when a KYB call failed there. */
  providerCode?: string;
}
