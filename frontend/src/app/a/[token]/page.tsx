'use client';

/**
 * SYS-mobile — Actor Access (public, no login). Resolves an HMAC-signed link to show ONLY
 * this actor's own call for today + safe project/day context. Reached via a shared link/QR.
 * Dark, self-contained styling (outside the app theme).
 */
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { castingApi } from '@/lib/api';
import { Loader2, MapPin, Cross } from 'lucide-react';

const C = { bg: '#0E1117', card: '#16181d', border: '#262a31', text: '#EDEDEA', sub: '#9a9aa2', gold: '#C9A24B' };

export default function ActorAccess() {
  const params = useParams();
  const token = String((params as any)?.token || '');
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    castingApi.actorView(token)
      .then((r: any) => setD(r.data))
      .catch((e: any) => setErr(e?.response?.data?.message || 'This link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 className="animate-spin" style={{ color: C.sub }} /></div>;
  if (err || !d) return <div style={{ minHeight: '100vh', background: C.bg, color: C.sub, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px' }}>{err || 'Not found'}</div>;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, maxWidth: 440, margin: '0 auto', padding: '26px 20px' }}>
      <div style={{ fontSize: 12, color: C.gold, fontWeight: 700, letterSpacing: '.05em' }}>YOUR CALL</div>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginTop: 2 }}>{d.talent}</h1>
      <div style={{ color: C.sub, fontSize: 14 }}>{d.project}{d.dayNumber ? ` · Day ${d.dayNumber}${d.totalDays ? `/${d.totalDays}` : ''}` : ''}</div>

      {!d.hasCallSheet ? (
        <div style={{ marginTop: 26, color: C.sub }}>No call sheet has been published for today yet. Please check back later.</div>
      ) : (
        <>
          <div style={{ marginTop: 20, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 11, color: C.sub, textTransform: 'uppercase', letterSpacing: '.04em' }}>Your call time</div>
            <div style={{ fontSize: 42, fontWeight: 800, color: C.gold, lineHeight: 1.1 }}>{d.myCall?.callTime || d.generalCall || '—'}</div>
            {d.myCall?.character && <div style={{ color: C.sub, marginTop: 2 }}>as {d.myCall.character}</div>}
            {d.myCall?.hmw && <div style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>Hair/Makeup/Wardrobe: {d.myCall.hmw}</div>}
            {d.myCall?.remarks && <div style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>{d.myCall.remarks}</div>}
            {!d.myCall && <div style={{ fontSize: 12, color: C.sub, marginTop: 6 }}>Showing the general crew call — please confirm your personal call with the AD.</div>}
          </div>

          {d.location && (
            <div style={{ marginTop: 12, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, display: 'flex', gap: 10 }}>
              <MapPin size={18} style={{ color: C.gold, flexShrink: 0 }} />
              <div><div style={{ fontWeight: 600 }}>{d.location}</div>{d.locationAddress && <div style={{ fontSize: 13, color: C.sub }}>{d.locationAddress}</div>}</div>
            </div>
          )}

          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 12px' }}><div style={{ fontSize: 10, color: C.sub, textTransform: 'uppercase' }}>Crew call</div><div style={{ fontWeight: 700 }}>{d.generalCall || '—'}</div></div>
            <div style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '10px 12px' }}><div style={{ fontSize: 10, color: C.sub, textTransform: 'uppercase' }}>Shoot call</div><div style={{ fontWeight: 700 }}>{d.shootingCall || '—'}</div></div>
          </div>

          {d.hospitalName && (
            <a href={d.hospitalPhone ? `tel:${d.hospitalPhone}` : undefined} style={{ marginTop: 12, display: 'flex', gap: 10, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, color: C.text, textDecoration: 'none' }}>
              <Cross size={18} style={{ color: '#e24b4a', flexShrink: 0 }} />
              <div><div style={{ fontSize: 11, color: C.sub, textTransform: 'uppercase' }}>Nearest hospital</div><div style={{ fontWeight: 600 }}>{d.hospitalName}</div>{d.hospitalPhone && <div style={{ fontSize: 13, color: C.gold }}>{d.hospitalPhone}</div>}</div>
            </a>
          )}
        </>
      )}

      <div style={{ marginTop: 28, fontSize: 11, color: '#6e6e76', textAlign: 'center' }}>The Film Makers · your personal call sheet access</div>
    </div>
  );
}
