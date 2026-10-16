import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.js';
import type { KybCheck, Prisma } from '../generated/prisma/client.js';
import type { KybDecision, KybStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  type Draft,
  draftSchema,
  emptyDraft,
  normalizeName,
  OWNER_THRESHOLD,
  screenedPeople,
  submitProblems,
} from './draft.js';
import {
  type CompanyCheckResult,
  KYB_PROVIDER,
  type KybProvider,
  type PersonSessionStatus,
  type ProviderDecision,
  ProviderError,
} from './provider.js';
import { screen } from './screening.js';

/** Certificates the company check accepts, and the largest one (the provider takes up to 10 MB). */
export const DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

/** The parts of a multipart upload the company check uses. */
export interface UploadedDocument {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

const EDITABLE: readonly KybStatus[] = ['NOT_STARTED', 'IN_PROGRESS'];

type CaseWithChecks = Prisma.KybCaseGetPayload<{ include: { checks: true } }>;

/**
 * The KYB flow (docs/kyb.md): one case per institution, filled in by one applicant.
 * Checks run as each step is completed; submission hands the case to platform review.
 */
@Injectable()
export class KybService {
  private readonly logger = new Logger(KybService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(KYB_PROVIDER) private readonly provider: KybProvider,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** The applicant's case as the verification pages show it. */
  async view(privyDid: string) {
    const kase = await this.findCase(await this.userId(privyDid));
    return toView(kase);
  }

  async saveDraft(privyDid: string, input: unknown) {
    const parsed = draftSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({ code: 'INVALID_DRAFT', message: parsed.error.issues[0]?.message ?? 'Invalid form' });
    }
    const kase = await this.openCase(await this.userId(privyDid));
    const updated = await this.prisma.kybCase.update({
      where: { id: kase.id },
      data: { draft: withIdDetails(parsed.data, kase.checks), status: 'IN_PROGRESS' },
      include: { checks: true },
    });
    return toView(updated);
  }

  /** Step 1: the certificate goes to the provider, which reads it and checks the registry. Prefills the form. */
  async checkCompany(privyDid: string, file: UploadedDocument | undefined) {
    if (!file) throw new BadRequestException({ code: 'NO_DOCUMENT', message: 'Upload the registration certificate' });
    if (!DOCUMENT_TYPES.includes(file.mimetype)) {
      throw new BadRequestException({ code: 'BAD_DOCUMENT_TYPE', message: 'Upload a PDF, JPEG, PNG or WebP file' });
    }
    const kase = await this.openCase(await this.userId(privyDid));
    const result = await this.withProvider(() => this.provider.verifyCompany({ data: file.buffer, mimeType: file.mimetype }));

    const draft = prefill(draftOf(kase), result, file.originalname);
    const updated = await this.prisma.kybCase.update({
      where: { id: kase.id },
      data: {
        status: 'IN_PROGRESS',
        draft,
        companyData: result.company,
        registryFound: result.registry?.found ?? false,
        checks: {
          create: {
            kind: 'COMPANY',
            providerTransactionId: result.transactionId || null,
            decision: toDecision(result.decision),
            warnings: result.warnings as unknown as Prisma.InputJsonValue,
            result: {
              registry: result.registry,
              company: result.company,
              principals: result.principals,
              document: file.originalname,
            } as unknown as Prisma.InputJsonValue,
          },
        },
      },
      include: { checks: true },
    });
    return toView(updated);
  }

  /**
   * Step 2: a DocuPass session for the applicant. Nothing is typed first: the name, birth date and nationality are
   * read from the ID and written into the form when it is done. An unfinished session is reused: each costs credits.
   */
  async startApplicantSession(privyDid: string) {
    const kase = await this.openCase(await this.userId(privyDid));

    const open = latest(kase.checks, 'APPLICANT_ID');
    if (
      open &&
      sessionStatus(open) === 'pending' &&
      open.sessionUrl &&
      (!open.sessionExpiresAt || open.sessionExpiresAt.getTime() > Date.now() + 5 * 60_000)
    ) {
      return { url: open.sessionUrl, reference: open.providerReference };
    }

    const session = await this.withProvider(() => this.provider.createPersonSession({ customData: kase.id }));
    await this.prisma.kybCheck.create({
      data: {
        caseId: kase.id,
        kind: 'APPLICANT_ID',
        providerReference: session.reference,
        personKey: 'applicant',
        sessionUrl: session.url,
        sessionExpiresAt: session.expiresAt,
        result: { status: 'pending' },
      },
    });
    return { url: session.url, reference: session.reference };
  }

  /** Polls the applicant's latest session (no webhook needed; docs/kyb.md section 4). */
  async refreshApplicant(privyDid: string) {
    const kase = await this.findCase(await this.userId(privyDid));
    const check = kase && latest(kase.checks, 'APPLICANT_ID');
    if (kase && check?.providerReference && sessionStatus(check) === 'pending') {
      const r = await this.withProvider(() => this.provider.getPersonSession(check.providerReference!));
      if (r.status !== 'pending') {
        const passed = r.status === 'accept' || r.status === 'review';
        const updated = await this.prisma.kybCheck.update({
          where: { id: check.id },
          data: {
            decision: r.status === 'expired' ? null : toDecision(r.status),
            providerTransactionId: r.transactionId,
            warnings: r.warnings as unknown as Prisma.InputJsonValue,
            personName: (passed && r.person?.name) || null,
            personDob: (passed && r.person?.dob) || null,
            result: { status: r.status, person: passed ? r.person : null },
          },
        });
        // Fill the form from the ID, so the applicant does not type what the document already says.
        if (passed && EDITABLE.includes(kase.status)) {
          await this.prisma.kybCase.update({
            where: { id: kase.id },
            data: { draft: withIdDetails(draftOf(kase), [...kase.checks.filter((c) => c.id !== check.id), updated]) },
          });
        }
      }
    }
    return this.view(privyDid);
  }

  /** Hands the case to platform review once the form is complete and every check is current. */
  async submit(privyDid: string) {
    const userId = await this.userId(privyDid);
    const kase = await this.openCase(userId);
    const draft = draftOf(kase);
    const problems = submitProblems(draft);

    const company = latest(kase.checks, 'COMPANY');
    if (!company) problems.push('COMPANY_NOT_CHECKED');
    else if (company.decision === 'REJECT') problems.push('COMPANY_REJECTED');

    const id = latest(kase.checks, 'APPLICANT_ID');
    const idStatus = id && sessionStatus(id);
    if (!id || (idStatus !== 'accept' && idStatus !== 'review') || !matchesId(id, draft)) {
      problems.push('APPLICANT_NOT_VERIFIED');
    }

    const wallets = await this.prisma.wallet.findMany({ where: { address: { in: draft.wallets } } });
    const usable = wallets.filter(
      (w) => w.userId === userId && !w.delegated && (w.institutionId === null || w.institutionId === kase.institutionId),
    );
    if (usable.length !== draft.wallets.length) problems.push('WALLET_NOT_USABLE');

    if (problems.length) {
      throw new BadRequestException({ code: 'NOT_READY', message: 'The application is not complete', problems });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.wallet.updateMany({ where: { id: { in: usable.map((w) => w.id) } }, data: { institutionId: kase.institutionId } });
      await tx.institution.update({ where: { id: kase.institutionId }, data: { name: draft.company.legalName } });
      await tx.auditLog.create({
        data: { actorUserId: userId, action: 'kyb.submitted', target: kase.id, detail: { wallets: draft.wallets } },
      });
      return tx.kybCase.update({
        where: { id: kase.id },
        data: { status: 'SUBMITTED', submittedAt: new Date(), draft: { ...draft, step: 'submitted' } },
        include: { checks: true },
      });
    });
    // The names are screened once the application is in. A failure here never stops the applicant: the case is in
    // review either way, and the reviewer sees who could not be screened.
    await this.screenCase(kase.id, draft);
    return toView(updated);
  }

  /**
   * Every listed person, and the applicant, against the sanctions and PEP lists (/amlv3). Replaces earlier results.
   * A person the provider could not screen (unreachable, or the account cannot use the service) is recorded as
   * not screened, for the reviewer to run again or check by hand.
   */
  private async screenCase(caseId: string, draft: Draft) {
    const people = screenedPeople(draft).filter((p) => p.name);
    const results = await Promise.all(
      people.map(async (person) => {
        try {
          const outcome = screen(person, await this.provider.searchAml(person.name));
          return {
            person,
            decision: outcome.status === 'clear' ? ('ACCEPT' as const) : ('REVIEW' as const),
            result: { status: outcome.status, hits: outcome.hits },
          };
        } catch (error) {
          const code = error instanceof ProviderError ? error.code : 'UNEXPECTED';
          this.logger.warn(`screening ${caseId}/${person.key} not run: ${code} ${(error as Error).message}`);
          return { person, decision: null, result: { status: 'not_screened', error: code } };
        }
      }),
    );
    try {
      await this.prisma.$transaction([
        this.prisma.kybCheck.deleteMany({ where: { caseId, kind: 'SCREENING' } }),
        this.prisma.kybCheck.createMany({
          data: results.map(({ person, decision, result }) => ({
            caseId,
            kind: 'SCREENING' as const,
            personKey: person.key,
            personName: person.name,
            personDob: person.dob,
            decision,
            result: result as unknown as Prisma.InputJsonValue,
          })),
        }),
      ]);
    } catch (error) {
      this.logger.error(`screening ${caseId} not saved: ${(error as Error).message}`);
    }
  }

  /** Development only: drop the case and its institution so the flow can be tried again. */
  async reset(privyDid: string) {
    if (this.config.get('NODE_ENV', { infer: true }) === 'production') {
      throw new ForbiddenException({ code: 'NOT_AVAILABLE', message: 'Not available' });
    }
    const userId = await this.userId(privyDid);
    const kase = await this.findCase(userId);
    if (kase) {
      if (!EDITABLE.includes(kase.status) && kase.status !== 'SUBMITTED') {
        throw new ConflictException({ code: 'CASE_DECIDED', message: 'A decided case cannot be reset' });
      }
      await this.prisma.$transaction([
        this.prisma.auditLog.create({ data: { actorUserId: userId, action: 'kyb.reset', target: kase.id } }),
        this.prisma.institution.delete({ where: { id: kase.institutionId } }),
      ]);
    }
    return toView(null);
  }

  private async userId(privyDid: string) {
    const user = await this.prisma.user.findUnique({ where: { privyDid } });
    if (!user) throw new NotFoundException({ code: 'SESSION_NOT_SYNCED', message: 'Call POST /auth/session first' });
    return user.id;
  }

  /** The case of the first institution the user administers, if any. */
  private async findCase(userId: string): Promise<CaseWithChecks | null> {
    const membership = await this.prisma.membership.findFirst({
      where: { userId, role: 'ADMIN', institution: { kybCase: { isNot: null } } },
      orderBy: { createdAt: 'asc' },
      include: { institution: { include: { kybCase: { include: { checks: { orderBy: { createdAt: 'asc' } } } } } } },
    });
    return membership?.institution.kybCase ?? null;
  }

  /** The user's case, created with its institution on first use. Only open cases can change. */
  private async openCase(userId: string): Promise<CaseWithChecks> {
    const existing = await this.findCase(userId);
    if (existing) {
      if (!EDITABLE.includes(existing.status)) {
        throw new ConflictException({ code: 'CASE_LOCKED', message: 'This application has been submitted' });
      }
      return existing;
    }
    const institution = await this.prisma.institution.create({
      data: {
        name: 'Unnamed institution',
        members: { create: { userId, role: 'ADMIN' } },
        kybCase: { create: { provider: this.provider.name, applicantUserId: userId, draft: emptyDraft() } },
      },
      include: { kybCase: { include: { checks: true } } },
    });
    return institution.kybCase!;
  }

  private async withProvider<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;
      this.logger.warn(`${this.provider.name} ${error.status} ${error.code}: ${error.message}`);
      if (error.code === 'NOT_CONFIGURED') {
        throw new ServiceUnavailableException({ code: 'KYB_NOT_CONFIGURED', message: 'Verification is not set up' });
      }
      throw new BadGatewayException({
        code: 'PROVIDER_ERROR',
        message: 'The verification provider did not respond as expected. Try again.',
        providerCode: error.code,
      });
    }
  }
}

function draftOf(kase: { draft: Prisma.JsonValue | null }): Draft {
  const parsed = draftSchema.safeParse(kase.draft ?? {});
  return parsed.success ? parsed.data : emptyDraft();
}

function latest(checks: KybCheck[], kind: KybCheck['kind']): KybCheck | undefined {
  return checks.filter((c) => c.kind === kind).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}

function sessionStatus(check: KybCheck): PersonSessionStatus {
  const status = (check.result as { status?: PersonSessionStatus } | null)?.status;
  return status ?? 'pending';
}

/** The applicant details read from their passed ID check, if any. */
function idDetails(checks: KybCheck[]) {
  const id = latest(checks, 'APPLICANT_ID');
  const status = id && sessionStatus(id);
  if (!id || (status !== 'accept' && status !== 'review')) return null;
  return (id.result as { person?: { name: string; dob: string; nationality: string } | null } | null)?.person ?? null;
}

/** What the ID says wins over what was typed: the applicant cannot change their verified name or birth date. */
function withIdDetails(draft: Draft, checks: KybCheck[]): Draft {
  const person = idDetails(checks);
  if (!person) return draft;
  return {
    ...draft,
    applicant: {
      ...draft.applicant,
      name: person.name || draft.applicant.name,
      dob: person.dob || draft.applicant.dob,
      nationality: person.nationality || draft.applicant.nationality,
    },
  };
}

/** The form still names the person whose ID was checked. Fields the ID did not show are not compared. */
function matchesId(check: KybCheck, draft: Draft) {
  const a = draft.applicant;
  return (
    (!check.personName || normalizeName(check.personName) === normalizeName(a.name)) &&
    (!check.personDob || check.personDob === a.dob)
  );
}

function toDecision(d: ProviderDecision): KybDecision {
  return d === 'accept' ? 'ACCEPT' : d === 'reject' ? 'REJECT' : 'REVIEW';
}

const countryName = (iso2: string) => {
  try {
    return (iso2 && new Intl.DisplayNames(['en'], { type: 'region' }).of(iso2.toUpperCase())) || iso2;
  } catch {
    return iso2;
  }
};

/**
 * Fills the form from the certificate: company fields, and the directors and owners it names.
 * Fields the applicant typed themselves (type, business, website) and people they added are kept.
 */
function prefill(draft: Draft, r: CompanyCheckResult, docName: string): Draft {
  const byName = new Map<string, Draft['people'][number]>();
  r.principals.forEach((p) => {
    const director = p.role === 'director' || p.role === 'officer';
    const owner = p.role === 'shareholder' || p.role === 'beneficial_owner';
    if (!p.name || (!director && !owner)) return;
    if (owner && !director && p.ownershipPercent !== null && p.ownershipPercent < OWNER_THRESHOLD) return;
    const key = normalizeName(p.name);
    const prev = byName.get(key);
    byName.set(key, {
      key: prev?.key ?? `r${byName.size}`,
      name: prev?.name ?? p.name,
      director: (prev?.director ?? false) || director,
      ownership: p.ownershipPercent !== null ? String(p.ownershipPercent) : (prev?.ownership ?? ''),
      dob: '',
      nationality: '',
      fromRegistry: true,
    });
  });
  const added = draft.people.filter((p) => !p.fromRegistry && !byName.has(normalizeName(p.name)));
  return {
    ...draft,
    company: {
      ...draft.company,
      legalName: r.company.legalName || draft.company.legalName,
      regNo: r.company.registrationNumber || draft.company.regNo,
      country: countryName(r.company.country) || draft.company.country,
      address: r.company.address || draft.company.address,
      doc: docName,
    },
    people: [...byName.values(), ...added],
    ownersComplete: false,
  };
}

/**
 * What GET /kyb returns. Provider ids, screening results and raw hits stay on the server: the reviewer sees them,
 * the applicant does not.
 */
function toView(kase: CaseWithChecks | null) {
  if (!kase) {
    return { status: 'NOT_STARTED' as KybStatus, submittedAt: null, draft: null, company: null, applicant: null };
  }
  const company = latest(kase.checks, 'COMPANY');
  const companyResult = company?.result as {
    registry: CompanyCheckResult['registry'];
    company: CompanyCheckResult['company'];
    principals: CompanyCheckResult['principals'];
  } | null;
  const id = latest(kase.checks, 'APPLICANT_ID');
  return {
    status: kase.status,
    submittedAt: kase.submittedAt,
    draft: draftOf(kase),
    company:
      company && companyResult
        ? {
            decision: company.decision,
            warnings: ((company.warnings ?? []) as { code: string; description?: string }[]).map((w) => ({
              code: w.code,
              description: w.description,
            })),
            registry: companyResult.registry,
            status: companyResult.registry?.status || companyResult.company.status,
            incorporated: companyResult.company.incorporationDate,
            directors: companyResult.principals
              .filter((p) => p.role === 'director' || p.role === 'officer')
              .map((p) => p.name),
          }
        : null,
    applicant: id ? { status: sessionStatus(id), fromId: idDetails(kase.checks) } : null,
  };
}
