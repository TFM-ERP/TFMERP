'use client';
import { useRouter } from 'next/navigation';
import { useScriponShellFlag } from './osShellFlag';
import { lastFilmosRoute } from './os-workspaces';

/** The ScripON brand-home action: last FilmOS route when the new shell is on, else /home (old). */
export function useScriponBack(): () => void {
  const router = useRouter();
  const flag = useScriponShellFlag();
  return () => router.push(flag === 'new' ? lastFilmosRoute() : '/home');
}
