import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ChannelsService } from './channels.service';
import { ChannelsController } from './channels.controller';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { AuditVaultService } from './audit-vault.service';
import { AuditVaultController } from './audit-vault.controller';
import { CommsSearchController } from './comms-search.controller';
import { SignoffController } from './signoff.controller';
import { SignoffService } from './signoff.service';
import { CommsGateway } from './comms.gateway';

/** SYS-09 — Comms backbone: channels, messages (append-only), search, read-&-sign, realtime gateway, admin audit vault. */
@Module({
  imports: [PrismaModule, JwtModule.register({ secret: process.env.JWT_SECRET })],
  controllers: [ChannelsController, MessagesController, AuditVaultController, CommsSearchController, SignoffController],
  providers: [ChannelsService, MessagesService, AuditVaultService, SignoffService, CommsGateway],
  exports: [ChannelsService, MessagesService],
})
export class CommsModule {}
