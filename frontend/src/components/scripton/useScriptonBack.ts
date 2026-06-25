'use client';
import { useRouter } from 'next/navigation';
import { useScriptonShellFlag } from './osShellFlag';
import { lastFilmosRoute } from './os-workspaces';

/** The ScriptON brand-home action: last FilmOS route when the new shell is on, else /home (old). */
export function useScriptonBack(): () => void {
  const router = useRouter();
  const flag = useScriptonShellFlag();
  return () => router.push(flag === 'new' ? lastFilmosRoute() : '/home');
}
