import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Sophia AI Factory';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{
        background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0f0f23 100%)',
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: 'sans-serif',
      }}>
        <div style={{ fontSize: 72, fontWeight: 800, color: '#fff', marginBottom: 16 }}>
          Sophia AI Factory
        </div>
        <div style={{ fontSize: 28, color: '#a78bfa', marginBottom: 8 }}>
          Automated AI Video Creation Platform
        </div>
        <div style={{ fontSize: 20, color: '#67e8f9' }}>
          $199/mo — Create Videos with AI Avatars
        </div>
      </div>
    ),
    { ...size }
  );
}
