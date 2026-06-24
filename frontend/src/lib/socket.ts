'use client';

/**
 * Realtime socket singletons (SYS-09 Comms · SYS-06 Dispatch).
 * Connects to the backend socket.io namespaces with the JWT from localStorage. The REST
 * API stays the source of truth — these just push live updates so the UI doesn't poll.
 * Requires: npm i socket.io-client
 */
import { io, type Socket } from 'socket.io-client';

const ROOT = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').replace('/api/v1', '');
const token = () => (typeof window !== 'undefined' ? localStorage.getItem('tfm_token') : null);

let comms: Socket | null = null;
let dispatch: Socket | null = null;

/** Comms namespace — channel threads + inbox pushes. */
export function commsSocket(): Socket {
  if (!comms) comms = io(`${ROOT}/comms`, { auth: { token: token() }, transports: ['websocket', 'polling'], reconnection: true });
  return comms;
}

/** Dispatch namespace — live driver positions. */
export function dispatchSocket(): Socket {
  if (!dispatch) dispatch = io(`${ROOT}/dispatch`, { auth: { token: token() }, transports: ['websocket', 'polling'], reconnection: true });
  return dispatch;
}
