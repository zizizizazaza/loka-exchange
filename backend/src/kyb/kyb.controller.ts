import { Body, Controller, Delete, Get, HttpCode, Post, Put, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { CurrentAuth, PrivyAuthGuard } from '../auth/auth.guard.js';
import type { AccessClaims } from '../auth/privy.service.js';
import { DOCUMENT_MAX_BYTES, KybService, type UploadedDocument } from './kyb.service.js';

/** Business verification for the signed-in applicant (docs/kyb.md section 3). */
@Controller('kyb')
@UseGuards(PrivyAuthGuard)
export class KybController {
  constructor(private readonly kyb: KybService) {}

  @Get()
  view(@CurrentAuth() auth: AccessClaims) {
    return this.kyb.view(auth.privyDid);
  }

  @Put('draft')
  save(@CurrentAuth() auth: AccessClaims, @Body() body: unknown) {
    return this.kyb.saveDraft(auth.privyDid, body);
  }

  /** Multipart upload, field `document`. Costs 10 provider credits per call. */
  @Post('company')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('document', { limits: { fileSize: DOCUMENT_MAX_BYTES, files: 1 } }))
  company(@CurrentAuth() auth: AccessClaims, @UploadedFile() file: UploadedDocument | undefined) {
    return this.kyb.checkCompany(auth.privyDid, file);
  }

  /** Returns the DocuPass link to embed. */
  @Post('applicant/session')
  @HttpCode(200)
  startSession(@CurrentAuth() auth: AccessClaims) {
    return this.kyb.startApplicantSession(auth.privyDid);
  }

  /** Polled by the page while the applicant verifies. */
  @Get('applicant')
  refreshApplicant(@CurrentAuth() auth: AccessClaims) {
    return this.kyb.refreshApplicant(auth.privyDid);
  }

  @Post('submit')
  @HttpCode(200)
  submit(@CurrentAuth() auth: AccessClaims) {
    return this.kyb.submit(auth.privyDid);
  }

  /** Development only. */
  @Delete()
  reset(@CurrentAuth() auth: AccessClaims) {
    return this.kyb.reset(auth.privyDid);
  }
}
