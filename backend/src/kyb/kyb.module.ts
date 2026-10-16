import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { IdAnalyzerProvider } from './idanalyzer.provider.js';
import { KybController } from './kyb.controller.js';
import { KybService } from './kyb.service.js';
import { KYB_PROVIDER } from './provider.js';

@Module({
  imports: [AuthModule],
  controllers: [KybController],
  providers: [KybService, { provide: KYB_PROVIDER, useClass: IdAnalyzerProvider }],
})
export class KybModule {}
