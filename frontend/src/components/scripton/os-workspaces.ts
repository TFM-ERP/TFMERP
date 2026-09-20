// frontend/src/components/scripton/os-workspaces.ts
//
// Attaches the rail icon components (React/lucide-react) to the plain workspace data in
// ./os-workspaces.data.ts, and re-exports everything under the names this module has always
// exported. Consumers (ScriptOnStudio.tsx, shared/sx.tsx, (dashboard)/layout.tsx,
// useScriptonBack.ts) import from here exactly as before — nothing about their imports changes.
//
// Why the split: this file's import of ./rail-icons pulls in real JSX, which plain `node --test`
// cannot execute (no JSX transform). The data + pure logic now live in os-workspaces.data.ts,
// which has no React/JSX in its import chain and so is directly testable under Node. See
// ../../test-support/README.md for the full explanation of that boundary.
import type { ComponentType } from 'react';
import { Home, PenLine, Stethoscope } from 'lucide-react';
import { BuildIcon, CanonIcon, VersionsIcon, RoomIcon, SlateIcon, SettingsIcon } from './rail-icons';
import {
  OS_WORKSPACES as OS_WORKSPACES_DATA,
  activeWorkspaceKey,
  filterWorkspaces,
  rememberFilmosRoute,
  lastFilmosRoute,
  type OsWorkspace as OsWorkspaceData,
} from './os-workspaces.data';

export { activeWorkspaceKey, filterWorkspaces, rememberFilmosRoute, lastFilmosRoute };

export type OsWorkspace = OsWorkspaceData & { icon: ComponentType<any> };

const ICONS: Record<string, ComponentType<any>> = {
  home: Home,
  write: PenLine,
  develop: BuildIcon,
  canon: CanonIcon,
  doctor: Stethoscope,
  versions: VersionsIcon,
  room: RoomIcon,
  slate: SlateIcon,
  studio: SettingsIcon,
};

export const OS_WORKSPACES: OsWorkspace[] = OS_WORKSPACES_DATA.map((w) => {
  const icon = ICONS[w.key];
  if (!icon) throw new Error(`os-workspaces: no icon mapped for workspace key "${w.key}"`);
  return { ...w, icon };
});
