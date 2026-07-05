import React, { useState } from 'react';

export default function NewGroupDialog({ onClose, onNext }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="dialog-box new-group-dialog" onClick={e => e.stopPropagation()}>

        <div className="new-group-header">
          <div className="dialog-title" style={{ textAlign: 'left', marginBottom: 0 }}>New group</div>
          <button className="header-btn" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        {/* Group icon picker */}
        <div className="new-group-icon-wrap">
          <div className="new-group-icon-circle">
            <CameraIcon />
          </div>
          <div className="new-group-icon-label">
            <InfoIcon /> Set group icon (Optional)
          </div>
        </div>

        {/* Group name */}
        <div className="dialog-field" style={{ marginBottom: 12 }}>
          <input
            className="dialog-input"
            placeholder="Group name"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
          <span className="required-star">*</span>
          <button className="emoji-btn-dialog" title="Emoji">😊</button>
        </div>

        {/* Description */}
        <textarea
          className="dialog-textarea"
          placeholder="Description"
          value={desc}
          onChange={e => setDesc(e.target.value)}
          rows={3}
        />

        {/* Group settings row */}
        <div className="new-group-settings-row">
          <SettingsIcon />
          <span>Group settings</span>
          <ChevronRightIcon />
        </div>

        {/* Actions */}
        <div className="dialog-actions" style={{ marginTop: 24 }}>
          <button className="btn-cancel" onClick={onClose}>Back</button>
          <button
            className={`btn-next${!name.trim() ? ' disabled' : ''}`}
            disabled={!name.trim()}
            onClick={() => onNext({ name: name.trim(), description: desc.trim() })}
          >
            Create group
          </button>
        </div>
      </div>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="#9E9E9E">
      <path d="M12 15.2A3.2 3.2 0 1 1 12 8.8a3.2 3.2 0 0 1 0 6.4zM9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9z"/>
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}
function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#9E9E9E">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#9E9E9E">
      <path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/>
    </svg>
  );
}
function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9E9E9E" strokeWidth="2" strokeLinecap="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}
