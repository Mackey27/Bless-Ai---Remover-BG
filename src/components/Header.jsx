const SunIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="5" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

const MoonIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

export default function Header({
  theme,
  onToggleTheme,
  onNavigate,
  authReady,
  authConfigured,
  currentUser,
  isSigningIn,
  onSignIn,
  onSignOut,
}) {
  const handleNavClick = (event, target) => {
    event.preventDefault();
    onNavigate(target);
  };

  return (
    <header className="app-header">
      <div className="shell app-header__inner">
        <button type="button" className="brand brand-button animate-fade-up" onClick={() => onNavigate("features")} aria-label="Go to features">
          <div className="brand__mark">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 3l14 9-14 9V3z" />
            </svg>
          </div>
          <h1 className="brand__title">
            Backless<span>AI</span>
          </h1>
        </button>

        <nav className="app-nav animate-fade-up stagger-1">
          <button type="button" className="app-nav__link" onClick={(event) => handleNavClick(event, "features")}>
            Features
          </button>
          <button type="button" className="app-nav__link" onClick={(event) => handleNavClick(event, "editor")}>
            Editor
          </button>
          <button type="button" className="app-nav__link" onClick={(event) => handleNavClick(event, "history")}>
            History
          </button>
        </nav>

        <div className="header-actions animate-fade-up stagger-2">
          <button type="button" className="tool-btn" aria-label="Toggle theme" onClick={onToggleTheme}>
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
          {!authReady && authConfigured ? (
            <button type="button" className="btn-secondary desktop-only" disabled>
              Restoring session...
            </button>
          ) : currentUser ? (
            <div className="auth-chip desktop-only">
              {currentUser.photoURL ? (
                <img
                  className="auth-chip__avatar"
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || "Google profile"}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="auth-chip__avatar auth-chip__avatar--fallback">
                  {(currentUser.displayName || currentUser.email || "U").slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="auth-chip__meta">
                <strong>{currentUser.displayName || "Signed in"}</strong>
                <span>{currentUser.email}</span>
              </div>
              <button type="button" className="btn-secondary auth-chip__action" onClick={onSignOut}>
                Sign Out
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn-secondary desktop-only"
              onClick={onSignIn}
              disabled={!authReady || isSigningIn}
              title={authConfigured ? "Sign in with Google" : "Add Firebase env keys to enable Google sign-in"}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M21.8 12.23c0-.78-.07-1.53-.2-2.23H12v4.22h5.49a4.7 4.7 0 0 1-2.04 3.09v2.56h3.3c1.93-1.78 3.05-4.4 3.05-7.64Z" fill="currentColor" />
                <path d="M12 22c2.7 0 4.97-.9 6.62-2.43l-3.3-2.56c-.91.61-2.08.98-3.32.98-2.55 0-4.72-1.72-5.49-4.03H3.11v2.64A9.99 9.99 0 0 0 12 22Z" fill="currentColor" opacity=".8" />
                <path d="M6.51 13.96A5.99 5.99 0 0 1 6.2 12c0-.68.12-1.33.31-1.96V7.4H3.11A10 10 0 0 0 2 12c0 1.61.38 3.13 1.11 4.6l3.4-2.64Z" fill="currentColor" opacity=".65" />
                <path d="M12 6.01c1.47 0 2.8.51 3.84 1.52l2.88-2.88C16.96 3.02 14.7 2 12 2A9.99 9.99 0 0 0 3.11 7.4l3.4 2.64C7.28 7.73 9.45 6.01 12 6.01Z" fill="currentColor" opacity=".5" />
              </svg>
              {authConfigured ? (isSigningIn ? "Opening Google..." : "Sign in with Google") : "Google Login Setup Needed"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
