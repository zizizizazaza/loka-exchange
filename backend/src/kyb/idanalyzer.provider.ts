import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.js';
import {
  type AmlRecord,
  type CompanyCheckResult,
  type KybProvider,
  type PersonSession,
  type PersonSessionResult,
  type ProviderDecision,
  ProviderError,
  type ProviderWarning,
} from './provider.js';

/**
 * ID Analyzer API v2 (https://developer.idanalyzer.com/help/id-analyzer-api-v2), checked against the docs on 2026-10-14:
 * POST /kyb (10 credits), POST /docupass (mode 0: 2 credits), GET /docupass/{reference}, POST /amlv3.
 */
@Injectable()
export class IdAnalyzerProvider implements KybProvider {
  readonly name = 'idanalyzer';
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  /** Key for DocuPass and AML calls: IDANALYZER_KYC_API_KEY if set, else the main key. */
  private readonly personKey: string | undefined;
  private readonly profileId: string | undefined;

  constructor(config: ConfigService<Env, true>) {
    this.baseUrl = config.get('IDANALYZER_BASE_URL', { infer: true });
    this.apiKey = config.get('IDANALYZER_API_KEY', { infer: true });
    this.personKey = config.get('IDANALYZER_KYC_API_KEY', { infer: true }) || this.apiKey;
    this.profileId = config.get('IDANALYZER_KYC_PROFILE_ID', { infer: true });
  }

  async verifyCompany(document: { data: Buffer; mimeType: string }): Promise<CompanyCheckResult> {
    const body = await this.call(this.apiKey, 'POST', '/kyb', {
      document: `data:${document.mimeType};base64,${document.data.toString('base64')}`,
    });
    const data = (body.data ?? {}) as Record<string, { value?: unknown }[]>;
    const field = (k: string) => String(data[k]?.[0]?.value ?? '').trim();
    const registry = body.registry as Record<string, unknown> | undefined;

    return {
      transactionId: String(body.transactionId ?? ''),
      decision: decisionOf(body.decision),
      warnings: warningsOf(body.warning),
      registry: registry
        ? {
            found: registry.found === true,
            active: typeof registry.active === 'boolean' ? registry.active : null,
            source: strOrNull(registry.source),
            legalName: strOrNull(registry.legalName),
            status: strOrNull(registry.status),
          }
        : null,
      company: {
        legalName: field('legalName'),
        registrationNumber: field('registrationNumber') || field('identifier'),
        country: field('countryIso2'),
        address: [field('address1'), field('address2'), field('city'), field('state'), field('postcode')]
          .filter(Boolean)
          .join(', '),
        incorporationDate: field('incorporationDate'),
        entityType: field('entityType'),
        status: field('status'),
      },
      principals: (Array.isArray(body.directorsToVerify) ? body.directorsToVerify : []).map((p: Record<string, unknown>) => ({
        name: String(p.name || p.nameLocal || '').trim(),
        role: String(p.role ?? ''),
        ownershipPercent: typeof p.ownershipPercent === 'number' ? p.ownershipPercent : null,
      })),
    };
  }

  async createPersonSession(input: { name?: string; dob?: string; customData: string }): Promise<PersonSession> {
    if (!this.profileId) throw new ProviderError(0, 'NOT_CONFIGURED', 'IDANALYZER_KYC_PROFILE_ID is not set');
    const body = await this.call(this.personKey, 'POST', '/docupass', {
      mode: 0, // ID document and selfie
      version: '3', // the docs disagree on the default, so always ask for v3
      profile: this.profileId,
      ...(input.name ? { verifyName: input.name } : {}),
      ...(input.dob ? { verifyDOB: input.dob } : {}),
      customData: input.customData,
    });
    return {
      reference: String(body.reference),
      url: String(body.url),
      qrCode: strOrNull(body.qrCode),
      expiresAt: typeof body.expiry === 'number' && body.expiry > 0 ? new Date(body.expiry * 1000) : null,
    };
  }

  async getPersonSession(reference: string): Promise<PersonSessionResult> {
    const body = await this.call(this.personKey, 'GET', `/docupass/${encodeURIComponent(reference)}`);
    const final = body.finalTransaction as Record<string, unknown> | undefined;
    const warnings = warningsOf(final?.warning);
    if (body.decision) {
      // An expired link is reported as a reject with DOCUPASS_EXPIRED; it is not a failed check.
      const expired = warnings.some((w) => w.code === 'DOCUPASS_EXPIRED');
      const data = (final?.data ?? {}) as Record<string, { value?: unknown }[]>;
      const field = (k: string) => String(data[k]?.[0]?.value ?? '').trim();
      const name = field('fullName') || [field('firstName'), field('middleName'), field('lastName')].filter(Boolean).join(' ');
      return {
        status: expired ? 'expired' : decisionOf(body.decision),
        transactionId: strOrNull(body.transactionId),
        warnings,
        person: final
          ? {
              name: displayName(name),
              dob: /^\d{4}-\d{2}-\d{2}$/.test(field('dob')) ? field('dob') : '',
              nationality: field('nationalityFull') || field('countryFull'),
            }
          : null,
      };
    }
    const expiry = typeof body.expiry === 'number' ? body.expiry : 0;
    return {
      status: expiry > 0 && expiry * 1000 < Date.now() ? 'expired' : 'pending',
      transactionId: null,
      warnings: [],
      person: null,
    };
  }

  async searchAml(name: string): Promise<AmlRecord[]> {
    const body = await this.call(this.personKey, 'POST', '/amlv3', { text: name, limit: 50 });
    const rows = Array.isArray(body.rows) ? (body.rows as { json?: string; score?: number }[]) : [];
    return rows.map((row) => {
      let e: Record<string, unknown> = {};
      try {
        e = JSON.parse(row.json ?? '{}') as Record<string, unknown>;
      } catch {
        // Keep the row with what we have; a reviewer can look it up by id.
      }
      const list = (k: string) => (Array.isArray(e[k]) ? (e[k] as unknown[]).map(String) : []);
      return {
        id: String(e.id ?? ''),
        names: [...list('name'), ...list('alias')],
        birthDates: list('birthDate'),
        countries: [...list('citizenship'), ...list('country')],
        topics: (Array.isArray(e.topics) ? (e.topics as unknown[]) : []).map((t) => (Array.isArray(t) ? String(t[0]) : String(t))),
        score: typeof row.score === 'number' ? row.score : 0,
      };
    });
  }

  private async call(
    apiKey: string | undefined,
    method: 'GET' | 'POST',
    path: string,
    payload?: unknown,
  ): Promise<Record<string, any>> {
    if (!apiKey) throw new ProviderError(0, 'NOT_CONFIGURED', 'IDANALYZER_API_KEY is not set');
    let res: Response;
    try {
      const signal = AbortSignal.timeout(120_000);
      res =
        method === 'GET'
          ? await fetch(this.baseUrl + path, { headers: { 'X-API-KEY': apiKey }, signal })
          : await fetch(this.baseUrl + path, {
              method: 'POST',
              headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
              body: JSON.stringify(payload ?? {}),
              signal,
            });
    } catch (error) {
      throw new ProviderError(0, 'UNREACHABLE', `ID Analyzer unreachable: ${(error as Error).message}`);
    }
    const body = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (!res.ok || body.success === false || body.error) {
      const err = (body.error ?? {}) as { code?: string; message?: string };
      throw new ProviderError(res.status, err.code ?? `HTTP_${res.status}`, err.message ?? res.statusText);
    }
    return body;
  }
}

function decisionOf(v: unknown): ProviderDecision {
  return v === 'accept' || v === 'review' || v === 'reject' ? v : 'review';
}

function warningsOf(v: unknown): ProviderWarning[] {
  if (!Array.isArray(v)) return [];
  return v.map((w: Record<string, unknown>) => ({
    code: String(w.code ?? 'UNKNOWN'),
    description: strOrNull(w.description) ?? undefined,
    severity: strOrNull(w.severity) ?? undefined,
    decision: strOrNull(w.decision) ?? undefined,
  }));
}

/** IDs print names in capitals ("JANE VAN DER BERG"); show them as "Jane Van Der Berg". Mixed case is kept. */
function displayName(name: string): string {
  if (name !== name.toUpperCase()) return name;
  return name.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null;
}
