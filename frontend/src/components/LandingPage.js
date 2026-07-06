import React, { useEffect, useState } from 'react';
import logo from '../data/logo.png';

export default function LandingPage({ onEnter }) {
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setFade(true);
      setTimeout(onEnter, 500);
    }, 3000);
    return () => clearTimeout(t);
  }, [onEnter]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#1D1D1D',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fade ? 0 : 1,
        transition: 'opacity 0.5s ease',
        cursor: 'pointer',
        zIndex: 9999,
      }}
      onClick={() => { setFade(true); setTimeout(onEnter, 500); }}
    >
      <img
        src={logo}
        alt="Arattai"
        style={{
          width: 196,
          height: 196,
          borderRadius: 44,
          animation: 'logoPulse 2s ease-in-out infinite',
        }}
      />
    </div>
  );
}
