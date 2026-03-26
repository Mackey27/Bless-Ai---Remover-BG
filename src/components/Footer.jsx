export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="shell app-footer__inner">
        <div className="app-footer__brand">
          <div className="brand__mark app-footer__mark" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 3l14 9-14 9V3z" />
            </svg>
          </div>
          <div>
            <strong>BacklessAI</strong>
            <p>Fast AI background removal for product shots, portraits, and creative work.</p>
          </div>
        </div>

        <div className="app-footer__meta">
          <span>Privacy-first processing flow</span>
          <span>backless-ai.vercel.app</span>
          <span>{currentYear} BacklessAI</span>
        </div>
      </div>
    </footer>
  );
}
