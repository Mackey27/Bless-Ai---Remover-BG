export default function HeroSection({
  onBrowseClick,
  onFilesSelected,
  uploadZoneRef,
  isDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
}) {
  return (
    <section id="features" className="hero-section">
      <div className="hero-copy animate-fade-up stagger-1">
        <h2>
          Remove Backgrounds
          <br />
          <span>Like Magic</span>
        </h2>
        <p>
          Professional AI-powered background removal with precision edge detection. Perfect for products,
          portraits, and creative projects.
        </p>
      </div>

      <div
        ref={uploadZoneRef}
        className={`upload-zone animate-fade-up stagger-2 ${isDragOver ? "drag-over" : ""}`}
        onDragOver={onDragEnter}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="upload-zone__content">
          <input type="file" accept="image/*" multiple className="hidden-input" onChange={onFilesSelected} />

          <div className="upload-zone__icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>

          <h3>Drop your images here</h3>
          <p>or click to browse</p>

          <div className="hero-actions">
            <button type="button" className="btn-primary" onClick={onBrowseClick}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              Browse Files
            </button>
          </div>
          <small>Supports PNG, JPG, WebP, HEIC, and HEIF up to 10MB with 250+ image selections</small>
        </div>
      </div>

      <div className="privacy-badge animate-fade-up stagger-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Privacy Mode: Images auto-delete after processing
      </div>
    </section>
  );
}
