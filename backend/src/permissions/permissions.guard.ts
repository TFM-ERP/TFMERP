import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERM_KEY } from './require-permission.decorator';
import { PermissionsService } from './permissions.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector, private perms: PermissionsService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<{ module: string; level: number }>(PERM_KEY, [
      ctx.getHandler(), ctx.getClass(),
    ]);
    if (!required) return true;
    const req = ctx.switchToHttp().getRequest();
    const role = req.user?.role;
    if (!role) throw new ForbiddenException('Not authenticated');
    const map = await this.perms.forRole(role);
    if ((map[required.module] ?? 0) < required.level) {
      throw new ForbiddenException(`Your role lacks permission for ${required.module}`);
    }
    return true;
  }
}
