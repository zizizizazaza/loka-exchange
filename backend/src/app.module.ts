import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AccountsModule } from './accounts/accounts.module.js';
import { validateEnv } from './config/env.js';
import { HealthController } from './health/health.controller.js';
import { KybModule } from './kyb/kyb.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }), PrismaModule, AccountsModule, KybModule],
  controllers: [HealthController],
})
export class AppModule {}
