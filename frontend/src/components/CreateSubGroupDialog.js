import React, { useState } from 'react';

export default function CreateSubGroupDialog({ onClose, onNext }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  function handleNext() {
    if (!name.trim()) return;
    onNext({ name: name.trim(), description: desc.trim() });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="dialog-box" onClick={e => e.stopPropagation()}>
        <div className="dialog-title">Create subgroup</div>

        <div className="dialog-avatar-wrap">
          <div className="dialog-avatar-placeholder">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
            </svg>
          </div>
        </div>

        <div className="dialog-field">
          <input
            className="dialog-input"
            placeholder="SubGroup Name"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={50}
            autoFocus
          />
          <span className="required-star">*</span>
          <button className="emoji-btn-dialog" title="Emoji">😊</button>
        </div>

        <textarea
          className="dialog-textarea"
          placeholder="Description"
          value={desc}
          onChange={e => setDesc(e.target.value)}
          rows={3}
        />

        <div className="dialog-actions">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button
            className={`btn-next${!name.trim() ? ' disabled' : ''}`}
            onClick={handleNext}
            disabled={!name.trim()}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
