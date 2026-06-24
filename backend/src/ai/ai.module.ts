import { Global, Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { LlmRoutingService } from './llm-routing.service';
import { LlmEnginesController } from './llm-engines.controller';

/** Global AI gateway module — AiService + the LLM Engines & Routing switchboard are
 *  injectable everywhere (PrismaModule is already global). */
@Global()
@Module({ providers: [AiService, LlmRoutingService], controllers: [LlmEnginesController], exports: [AiService, LlmRoutingService] })
export class AiModule {}
