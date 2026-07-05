import React, { useState } from 'react';
import Avatar from './Avatar';

export default function SubGroupModal({ groupId, allSubGroups, onClose, onOpenSubGroup, onCreateSubGroup }) {
  const [search, setSearch] = useState('');
  const mySubGroups = allSubGroups.filter(sg => (sg.parentGroupId ?? sg.groupId) === groupId);
  const filtered = mySubGroups.filter(sg =>
    sg.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box subgroup-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Your SubGroups</div>
        <div className="modal-search-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            className="modal-search-input"
            placeholder="Search SubGroups"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div className="modal-list">
          {filtered.map(sg => (
            <div
              key={sg.id}
              className="modal-list-item"
              onClick={() => { onOpenSubGroup(sg); onClose(); }}
            >
              <Avatar name={sg.name} size={40} isGroup />
              <span className="modal-item-name">{sg.name}</span>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="modal-empty">No subgroups found</div>
          )}
        </div>
        <button className="create-subgroup-btn" onClick={() => { onCreateSubGroup(); onClose(); }}>
          + Create SubGroup
        </button>
      </div>
    </div>
  );
}
