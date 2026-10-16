import { Module } from '@nestjs/common';

import { PrivyAuthGuard } from './auth.guard.js';
import { PrivyService } from './privy.service.js';

@Module({
  providers: [PrivyService, PrivyAuthGuard],
  exports: [PrivyService, PrivyAuthGuard],
})
export class AuthModule {}
