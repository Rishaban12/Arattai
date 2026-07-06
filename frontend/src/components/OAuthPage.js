import React, { useState } from 'react';
import logo from '../data/logo.png';

const BACKEND = process.env.REACT_APP_API_BASE_URL
  ? process.env.REACT_APP_API_BASE_URL.replace('/api', '')
  : 'http://localhost:8080';

const ERROR_MESSAGES = {
  access_denied: 'You cancelled the sign-in. Please try again.',
  google_api:    'Could not reach Google. Please check your connection.',
  db:            'A server error occurred. Please try again later.',
  invalid_state: 'The sign-in session expired. Please try again.',
};

export default function OAuthPage({ visible, error }) {
  const [loading, setLoading] = useState(false);

  function handleGoogleSignIn() {
    setLoading(true);
    window.location.href = `${BACKEND}/api/auth/google`;
  }

  if (!visible) return null;

  const errorMsg = error ? (ERROR_MESSAGES[error] || 'Sign-in failed. Please try again.') : null;

  return (
    <div className="oauth-overlay">
      <div className="oauth-card">
        <img src={logo} alt="Arattai" className="oauth-logo" />
        <h1 className="oauth-title">Arattai</h1>
        <p className="oauth-tagline">Connect with your people</p>

        {errorMsg && (
          <p className="oauth-error">{errorMsg}</p>
        )}

        <div className="oauth-divider" />

        <button
          className="google-btn"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          {loading ? (
            <span className="google-btn-spinner" />
          ) : (
            <GoogleIcon />
          )}
          <span>{loading ? 'Redirecting…' : 'Sign in with Google'}</span>
        </button>

        <p className="oauth-terms">
          By signing in you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
