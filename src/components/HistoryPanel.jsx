export default function HistoryPanel({ open, history, onClose, onRestore }) {
  return (
    <aside id="history" className={`history-panel ${open ? "history-panel--open" : ""}`}>
      <div className="history-panel__header">
        <h4>History</h4>
        <button type="button" className="tool-btn tool-btn--small" aria-label="Close history" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="history-list">
        {history.length === 0 ? (
          <p className="empty-copy">No history yet</p>
        ) : (
          history.map((item) => (
            <button key={item.id} type="button" className="history-item" onClick={() => onRestore(item.id)}>
              <img src={item.processed} alt={item.name} />
              <div className="history-item__overlay">
                <p>{item.name}</p>
                <span>{item.timestamp}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
