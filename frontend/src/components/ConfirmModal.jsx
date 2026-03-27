import React from 'react';

/**
 * A custom premium confirmation/alert modal.
 * @param {Object} props
 * @param {boolean} props.show - Whether to show the modal.
 * @param {string} props.title - Modal title.
 * @param {string} props.message - Modal message/body.
 * @param {string} props.confirmLabel - Label for the confirm button.
 * @param {string} props.cancelLabel - Label for the cancel button (if empty, only one button shown).
 * @param {string} props.type - 'info', 'warning', 'danger', 'success'.
 * @param {function} props.onConfirm - Callback when confirmed.
 * @param {function} props.onCancel - Callback when cancelled/closed.
 */
export default function ConfirmModal({ 
  show, 
  title, 
  message, 
  confirmLabel = 'OK', 
  cancelLabel, 
  type = 'info', 
  onConfirm, 
  onCancel 
}) {
  if (!show) return null;

  const typeStyles = {
    info: { icon: 'ℹ️', color: 'var(--accent-blue)', bg: 'var(--accent-blue-glow)' },
    warning: { icon: '⚠️', color: 'var(--accent-yellow)', bg: 'var(--accent-yellow-soft)' },
    danger: { icon: '🔥', color: 'var(--accent-red)', bg: 'var(--accent-red-soft)' },
    success: { icon: '✅', color: 'var(--accent-green)', bg: 'var(--accent-green-soft)' }
  };

  const style = typeStyles[type] || typeStyles.info;

  return (
    <div className="modal-overlay" style={{ zIndex: 3000 }}>
      <div className="modal-content" style={{ maxWidth: '400px', animation: 'modalSlideUp 0.3s ease-out' }}>
        <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: '0.5rem' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            borderRadius: '10px', 
            background: style.bg, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: '1.2rem',
            marginRight: '1rem'
          }}>
            {style.icon}
          </div>
          <h2 className="modal-title" style={{ flex: 1 }}>{title}</h2>
          <button className="modal-close" onClick={onCancel}>&times;</button>
        </div>
        
        <div className="modal-body" style={{ padding: '0.5rem 0 1.5rem 1rem' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5' }}>
            {message}
          </p>
        </div>

        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          {cancelLabel && (
            <button 
              className="btn btn--secondary" 
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
          )}
          <button 
            className="btn" 
            style={{ 
              background: style.color, 
              color: 'white',
              border: 'none'
            }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
