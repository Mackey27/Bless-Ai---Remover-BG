const exportFormats = ["png", "jpg", "webp"];

const backgroundTypes = [
  { id: "transparent", label: "None" },
  { id: "color", label: "Color" },
  { id: "image", label: "Image" },
];

const colorSwatches = ["#ffffff", "#000000", "#f5f5f5", "#00d4aa", "#3b82f6", "#ef4444", "#f59e0b", "#8b5cf6"];

export default function EditorSection({
  comparisonContainerRef,
  isProcessing,
  processingStatus,
  progress,
  currentImage,
  displayImage,
  previewFrame,
  sliderPosition,
  panOffset,
  onSliderStart,
  onBack,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  selectedFormat,
  onFormatChange,
  onDownload,
  canDownload,
  backgroundType,
  onBackgroundTypeChange,
  backgroundColor,
  onBackgroundColorChange,
  onCustomColorChange,
  onBackgroundUpload,
  shadowEnabled,
  onShadowToggle,
  shadowBlur,
  onShadowBlurChange,
  shadowOpacity,
  onShadowOpacityChange,
  images,
  onSelectImage,
  onAddMore,
  onAddFolder,
  onDownloadAll,
}) {
  return (
    <section id="editor" className="editor-grid">
      <div className="editor-main">
        <div className="glass-card toolbar">
          <div className="toolbar__group">
            <button type="button" className="tool-btn" aria-label="Back to upload" onClick={onBack}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
          </div>

          <div className="toolbar__group">
            <span className="desktop-only toolbar__label">Zoom:</span>
            <button type="button" className="tool-btn" aria-label="Zoom out" onClick={onZoomOut}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </button>
            <span className="zoom-level">{zoomLevel}%</span>
            <button type="button" className="tool-btn" aria-label="Zoom in" onClick={onZoomIn}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </button>
          </div>
        </div>

        <div className="glass-card canvas-shell">
          {isProcessing ? (
            <div className="processing-overlay">
              <div className="processing-center">
                <div className="processing-spinner">
                  <div className="processing-spinner__ring" />
                  <div className="processing-spinner__ring processing-spinner__ring--accent" />
                  <div className="processing-spinner__pulse" />
                </div>
                <h4>AI Processing</h4>
                <p>{processingStatus}</p>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>
          ) : null}

          <div ref={comparisonContainerRef} className="comparison-container transparency-surface">
            <div
              className="comparison-stage"
              style={{
                width: previewFrame?.width ? `${previewFrame.width}px` : undefined,
                height: previewFrame?.height ? `${previewFrame.height}px` : undefined,
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel / 100})`,
              }}
            >
              <div className="comparison-before" style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}>
                {currentImage?.original ? <img src={currentImage.original} alt="Original upload" /> : null}
              </div>
              {displayImage ? <img src={displayImage} alt="Processed result" /> : null}
              <div
                className="comparison-slider"
                style={{ left: `${sliderPosition}%` }}
                onMouseDown={onSliderStart}
                onTouchStart={onSliderStart}
              />
              {isProcessing ? <div className="scan-line" /> : null}
            </div>
          </div>
        </div>

        <div className="preview-grid">
          <div className="glass-card preview-card">
            <div className="preview-card__header">
              <h4>Preview</h4>
              <span>Original</span>
            </div>
            <div className="preview-card__media">
              {currentImage?.original ? <img src={currentImage.original} alt="Original preview" /> : null}
            </div>
          </div>

          <div className="glass-card preview-card">
            <div className="preview-card__header">
              <h4>Result</h4>
              <span>{displayImage ? "Processed" : "Waiting"}</span>
            </div>
            <div className="preview-card__media preview-card__media--checkerboard transparency-surface">
              {displayImage ? <img src={displayImage} alt="Processed result preview" /> : null}
            </div>
          </div>
        </div>

        <div className="glass-card export-row">
          <div className="format-group">
            <span>Export as:</span>
            <div className="mode-row mode-row--compact">
              {exportFormats.map((format) => (
                <button
                  key={format}
                  type="button"
                  className={`mode-tab ${selectedFormat === format ? "active" : ""}`}
                  onClick={() => onFormatChange(format)}
                >
                  {format.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <button type="button" className="btn-primary" onClick={onDownload} disabled={!canDownload} title={!canDownload ? "Sign in with Google to download" : "Download image"}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download
          </button>
        </div>
      </div>

      <aside className="editor-sidebar">
        <div className="glass-card side-card">
          <h4>Background Studio</h4>
          <div className="mode-row mode-row--compact mode-row--full">
            {backgroundTypes.map((type) => (
              <button
                key={type.id}
                type="button"
                className={`mode-tab ${backgroundType === type.id ? "active" : ""}`}
                onClick={() => onBackgroundTypeChange(type.id)}
              >
                {type.label}
              </button>
            ))}
          </div>

          {backgroundType === "color" ? (
            <div className="stack">
              <p className="muted-copy">Solid Colors</p>
              <div className="swatch-grid">
                {colorSwatches.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`color-swatch ${backgroundColor === color ? "selected" : ""}`}
                    style={{ background: color }}
                    onClick={() => onBackgroundColorChange(color)}
                  />
                ))}
              </div>
              <label className="custom-color-row">
                <span>Custom:</span>
                <input type="color" value={backgroundColor} onChange={onCustomColorChange} />
              </label>
            </div>
          ) : null}

          {backgroundType === "image" ? (
            <div className="stack">
              <p className="muted-copy">Upload Background</p>
              <label className="btn-secondary upload-inline">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                Choose Image
                <input type="file" accept="image/*" className="hidden-input" onChange={onBackgroundUpload} />
              </label>
            </div>
          ) : null}
        </div>

        <div className="glass-card side-card">
          <h4>Shadow Effects</h4>
          <div className="setting-row">
            <span>Enable Shadow</span>
            <button
              type="button"
              className={`custom-checkbox ${shadowEnabled ? "checked" : ""}`}
              role="checkbox"
              aria-checked={shadowEnabled}
              onClick={onShadowToggle}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
          </div>

          {shadowEnabled ? (
            <div className="stack">
              <label className="range-row">
                <span>Blur: {shadowBlur}px</span>
                <input type="range" min="0" max="50" value={shadowBlur} onChange={onShadowBlurChange} />
              </label>
              <label className="range-row">
                <span>Opacity: {shadowOpacity}%</span>
                <input type="range" min="0" max="100" value={shadowOpacity} onChange={onShadowOpacityChange} />
              </label>
            </div>
          ) : null}
        </div>

        <div className="glass-card side-card">
          <h4>Batch Queue</h4>
          <div className="batch-list">
            {images.length === 0 ? (
              <p className="empty-copy">No images in queue</p>
            ) : (
              images.map((image) => (
                <button
                  key={image.id}
                  type="button"
                  className={`batch-item ${currentImage?.id === image.id ? "batch-item--active" : ""}`}
                  onClick={() => onSelectImage(image.id)}
                >
                  <img src={image.original} alt={image.name} />
                  <div className="batch-item__meta">
                    <strong>{image.name}</strong>
                    <span>{image.processed ? "Processed" : "Pending"}</span>
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="side-actions">
            <button type="button" className="btn-secondary side-action" onClick={onAddMore}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add More Images
            </button>
            <button type="button" className="btn-secondary side-action" onClick={onAddFolder}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
                <path d="M12 11v6M9 14h6" />
              </svg>
              Add Folder
            </button>
            <button
              type="button"
              className="btn-secondary side-action"
              onClick={onDownloadAll}
              disabled={!canDownload}
              title={!canDownload ? "Sign in with Google to download all results" : "Download all processed images"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download All
            </button>
          </div>
        </div>
      </aside>
    </section>
  );
}
