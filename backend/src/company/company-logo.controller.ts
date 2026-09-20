import {
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import type { Response } from 'express';
import { createReadStream, existsSync, statSync } from 'fs';
import { basename, extname, join, resolve, sep } from 'path';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * The company's own logo, servable to an <img> tag.
 *
 * Uploaded files live behind FilesModule, which requires a Bearer token an
 * <img> cannot send — so every printed document (invoice, receipt, call sheet,
 * schedule, cost report) silently fell back to the bundled placeholder. The
 * general fix for private files is the signed link FilesModule mints, but the
 * company logo is different in kind: it is public branding that already appears
 * on every invoice sent to a client and on the public website. A round trip to
 * mint a token for it buys nothing and forces every print page to become async.
 *
 * So this route is deliberately unauthenticated, and deliberately narrow: it
 * serves a file ONLY when the requested name matches one of the three logo
 * paths stored on the company profile. It is not a general file route — a name
 * that is not one of those three is a 404, whatever it points at on disk.
 */

const UPLOADS_DIR = resolve(join(process.cwd(), 'uploads'));

const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

/** A bare filename, no separators, no traversal, no surprises. */
function safeName(raw: string): string | null {
  if (!raw) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (decoded !== basename(decoded)) return null;
  if (decoded.includes('\0') || decoded.includes('..')) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(decoded)) return null;
  return decoded;
}

function resolveInsideUploads(name: string): string | null {
  const full = resolve(join(UPLOADS_DIR, name));
  if (full !== UPLOADS_DIR && !full.startsWith(UPLOADS_DIR + sep)) return null;
  return full;
}

@ApiTags('Company Management')
@Controller('company/logo')
export class CompanyLogoController {
  constructor(private prisma: PrismaService) {}

  @Get(':filename')
  @ApiOperation({
    summary: 'Serve one of the company profile logos',
    description:
      'Unauthenticated by design so an <img> can load it. Serves a file only if ' +
      'the name matches logoUrl, darkLogoUrl or invoiceLogoUrl on the company ' +
      'profile; anything else is a 404.',
  })
  @ApiParam({ name: 'filename', description: 'Bare file name, no path' })
  async serve(@Param('filename') filename: string, @Res() res: Response): Promise<void> {
    const name = safeName(filename);
    if (!name) throw new BadRequestException('Invalid filename');

    const ext = extname(name).toLowerCase();
    const mime = IMAGE_MIME[ext];
    if (!mime) throw new NotFoundException('Not a logo');

    const profile = await this.prisma.companyProfile.findFirst({
      select: { logoUrl: true, darkLogoUrl: true, invoiceLogoUrl: true },
    });
    if (!profile) throw new NotFoundException('Not a logo');

    // The allow-list is the profile itself: only these three names are servable.
    const allowed = new Set(
      [profile.logoUrl, profile.darkLogoUrl, profile.invoiceLogoUrl]
        .filter((p): p is string => !!p)
        .map((p) => basename(p)),
    );
    if (!allowed.has(name)) throw new NotFoundException('Not a logo');

    const full = resolveInsideUploads(name);
    if (!full || !existsSync(full)) throw new NotFoundException('Not a logo');
    const stat = statSync(full);
    if (!stat.isFile()) throw new NotFoundException('Not a logo');

    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Length', String(stat.size));
    res.setHeader('Content-Disposition', `inline; filename="${name}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Branding changes rarely and is not confidential, so it may be cached —
    // but only by the browser, and only for an hour, so a logo swap shows up.
    res.setHeader('Cache-Control', 'public, max-age=3600');
    createReadStream(full).pipe(res);
  }
}
