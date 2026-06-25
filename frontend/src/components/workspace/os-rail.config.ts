/**
 * ScriptON Script OS — 9-workspace navigation rail config.
 * Rendered in /nav-preview for demo; intended for future wiring into the
 * Scripton-specific layout (NOT the global dashboard layout.tsx).
 *
 * Order matches Figma design authority:
 *   Home · Write · Develop · Canon · Doctor · Versions · Room · Slate · Studio
 */
import {
  Home, PenLine, Layers, Network, Activity, History,
  MessagesSquare, FolderKanban, Settings,
} from 'lucide-react';
import type { RailGroup } from './GroupedRail';

export const OS_WORKSPACES: RailGroup[] = [
  {
    caption: 'STORY',
    modules: [
      {
        key: 'scripon-home',
        label: 'Home',
        icon: Home,
        pages: [{ label: 'Dashboard', href: '/scripton' }],
      },
      {
        key: 'scripon-write',
        label: 'Write',
        icon: PenLine,
        pages: [{ label: 'Editor', href: '/scripton/write' }],
      },
      {
        key: 'scripon-develop',
        label: 'Develop',
        icon: Layers,
        pages: [{ label: 'Development', href: '/scripton/develop' }],
      },
      {
        key: 'scripon-canon',
        label: 'Canon',
        icon: Network,
        pages: [{ label: 'Story Canon', href: '/scripton/canon' }],
      },
      {
        key: 'scripon-doctor',
        label: 'Doctor',
        icon: Activity,
        pages: [{ label: 'Script Health', href: '/scripton/doctor' }],
      },
      {
        key: 'scripon-versions',
        label: 'Versions',
        icon: History,
        pages: [{ label: 'Version History', href: '/scripton/versions' }],
      },
      {
        key: 'scripon-room',
        label: 'Room',
        icon: MessagesSquare,
        pages: [{ label: 'Writers Room', href: '/scripton/room' }],
      },
      {
        key: 'scripon-slate',
        label: 'Slate',
        icon: FolderKanban,
        pages: [{ label: 'Slate Board', href: '/scripton/slate' }],
      },
      {
        key: 'scripon-studio',
        label: 'Studio',
        icon: Settings,
        pages: [{ label: 'Studio Settings', href: '/scripton/studio' }],
      },
    ],
  },
];
