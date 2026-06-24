'use client';
/** ScripON Canon — Living Canon stub route /scripon/canon. */
import { SxRail, SX_CSS } from '@/components/scripon/ScripOnStudio';
import { useLocale } from '@/lib/i18n';
import { useScriponBack } from '@/components/scripon/useScriponBack';

export default function ScripOnCanonPage() {
  const { dir } = useLocale();
  const onBack = useScriponBack();
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SX_CSS }} />
      <div className="sx" dir={dir} style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
        <div className="top">
          <div className="tl">
            <div className="logo" onClick={onBack} title="Back to FilmOS">TFM</div>
            <div className="proj">Living Canon</div>
          </div>
        </div>
        <div className="body">
          <SxRail active="canon" />
          <div className="main">
            <div className="content" style={{ padding: '40px 48px' }}>
              <div className="phead">
                <div className="meta" style={{ marginBottom: 8 }}>ScripON · Canon</div>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--cream)', marginBottom: 12 }}>Living Canon</h1>
                <div className="sub" style={{ color: 'var(--mute)', fontSize: 14, maxWidth: 520 }}>
                  The Canon workspace UI is coming soon. The canon kernel — character bibles, world rules, continuity anchors — already exists and is ready to surface here.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
