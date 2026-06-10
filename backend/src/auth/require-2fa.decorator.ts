import { SetMetadata } from '@nestjs/common';

export const REQUIRE_2FA = 'require_2fa';
/**
 * Mark a route as needing fresh two-factor step-up. The caller must have 2FA enabled
 * and send a current authenticator code in the `x-2fa-code` header, e.g. on payment release.
 */
export const Require2FA = () => SetMetadata(REQUIRE_2FA, true);
