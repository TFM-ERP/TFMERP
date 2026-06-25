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
        pages: [{ label: 'Dashboard', href: '/scripon' }],
      },
      {
        key: 'scripon-write',
        label: 'Write',
        icon: PenLine,
        pages: [{ label: 'Editor', href: '/scripon/write' }],
      },
      {
        key: 'scripon-develop',
        label: 'Develop',
        icon: Layers,
        pages: [{ label: 'Development', href: '/scripon/develop' }],
      },
      {
        key: 'scripon-canon',
        label: 'Canon',
        icon: Network,
        pages: [{ label: 'Story Canon', href: '/scripon/canon' }],
      },
      {
        key: 'scripon-doctor',
        label: 'Doctor',
        icon: Activity,
        pages: [{ label: 'Script Health', href: '/scripon/doctor' }],
      },
      {
        key: 'scripon-versions',
        label: 'Versions',
        icon: History,
        pages: [{ label: 'Version History', href: '/scripon/versions' }],
      },
      {
        key: 'scripon-room',
        label: 'Room',
        icon: MessagesSquare,
        pages: [{ label: 'Writers Room', href: '/scripon/room' }],
      },
      {
        key: 'scripon-slate',
        label: 'Slate',
        icon: FolderKanban,
        pages: [{ label: 'Slate Board', href: '/scripon/slate' }],
      },
      {
        key: 'scripon-studio',
        label: 'Studio',
        icon: Settings,
        pages: [{ label: 'Studio Settings', href: '/scripon/studio' }],
      },
    ],
  },
];
