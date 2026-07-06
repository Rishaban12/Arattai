import React, { useState } from 'react';
import Avatar from './Avatar';

export default function AddParticipantsDialog({ subGroupData, contacts = [], onClose, onCreate }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);

  const filtered = contacts.filter(m => {
    const q = search.toLowerCase();
    return m.name.toLowerCase().includes(q) ||
      (m.username || '').toLowerCase().includes(q);
  });

  function toggle(member) {
    if (selected.find(s => s.id === member.id)) {
      setSelected(selected.filter(s => s.id !== member.id));
    } else {
      setSelected([...selected, member]);
    }
  }

  function handleCreate() {
    onCreate({ ...subGroupData, participants: selected });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="dialog-box add-participants-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-title">Add participants</div>

        <div className="selected-tags-row">
          {selected.map(m => (
            <div key={m.id} className="selected-tag">
              <Avatar name={m.name} size={22} />
              <span>{m.name}</span>
              <button className="tag-remove" onClick={() => toggle(m)}>×</button>
            </div>
          ))}
        </div>

        <div className="modal-search-wrap" style={{ margin: '0 0 8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            className="modal-search-input"
            placeholder="Search contacts"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="modal-list participants-list">
          {filtered.map(member => {
            const isSelected = !!selected.find(s => s.id === member.id);
            return (
              <div
                key={member.id}
                className={`modal-list-item${isSelected ? ' selected-item' : ''}`}
                onClick={() => toggle(member)}
              >
                <Avatar name={member.name} size={40} />
                <span className="modal-item-name">
                  {member.name}
                  {member.username && (
                    <span style={{ display: 'block', fontSize: 12, opacity: 0.6 }}>
                      @{member.username}
                    </span>
                  )}
                </span>
                {isSelected && (
                  <div className="check-circle">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="dialog-actions">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-next" onClick={handleCreate}>Next</button>
        </div>
      </div>
    </div>
  );
}
