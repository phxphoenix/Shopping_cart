import type { CSSProperties } from 'react';

const containerStyle: CSSProperties = {
  minHeight: '100vh',
  backgroundColor: '#0b0f0b',
  color: '#21f35a',
  fontFamily: "'Courier New', Courier, monospace",
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '1.5rem',
  boxSizing: 'border-box',
};

const terminalBoxStyle: CSSProperties = {
  border: '2px solid #21f35a',
  backgroundColor: '#0f1a10',
  padding: '2rem',
  maxWidth: '640px',
  width: '100%',
  boxShadow: '0 0 15px rgba(33, 243, 90, 0.25)',
  textAlign: 'center',
};

const headerStyle: CSSProperties = {
  margin: '0 0 1rem 0',
  fontSize: '1.25rem',
  letterSpacing: '0.08em',
};

const statusStyle: CSSProperties = {
  color: '#00ff66',
  fontSize: '0.95rem',
  lineHeight: 1.6,
};

export default function App() {
  return (
    <main style={containerStyle}>
      <div style={terminalBoxStyle}>
        <h1 style={headerStyle}>[BOOTING RETRO SHOPPING CART v2.0...]</h1>
        <p style={statusStyle}>
          SYSTEM STATUS: ONLINE
          <br />
          TERMINAL READY. WAITING FOR HOST COMMAND.
        </p>
      </div>
    </main>
  );
}
