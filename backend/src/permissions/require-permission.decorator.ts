import { SetMetadata } from '@nestjs/common';

export const PERM_KEY = 'required_permission';
/** Attach a minimum permission requirement to a route: @RequirePermission('finance', 2) */
export const RequirePermission = (module: string, level: number) => SetMetadata(PERM_KEY, { module, level });
