import React, { useState } from 'react';
import Avatar from './Avatar';
import PlusMenu from './PlusMenu';
import NewGroupDialog from './NewGroupDialog';
import AddParticipantsDialog from './AddParticipantsDialog';
import { contacts, groups, subGroups } from '../data/mockData';

const tabs = [
  { label: 'Chats', badge: 0 },
  { label: 'Channels', badge: 1 },
  { label: 'Direct', badge: 0 },
  { label: 'Groups', badge: 0 },
  { label: 'SubGroups', badge: 0 },
];

export default function Sidebar({ selected, onSelect }) {
  const [activeTab, setActiveTab] = useState('Chats');
  const [search, setSearch] = useState('');
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showAddParticipants, setShowAddParticipants] = useState(false);
  const [newGroupData, setNewGroupData] = useState(null);

  const allChats = [
    ...groups.map(g => ({ ...g, isGroup: true })),
    ...contacts,
  ];

  const filtered = (() => {
    let list;
    if (activeTab === 'Direct') {
      list = contacts;
    } else if (activeTab === 'Groups') {
      list = groups.map(g => ({ ...g, isGroup: true }));
    } else if (activeTab === 'SubGroups') {
      list = subGroups.map(sg => ({ ...sg, isGroup: true }));
    } else {
      list = allChats;
    }
    return list.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  })();

  function handleGroupCreated(data) {
    const newGroup = {
      id: `g_${Date.now()}`,
      name: data.groupData.name,
      participants: data.participants.length + 1,
      type: 'group',
      isGroup: true,
      subGroups: [],
      messages: [{ id: 'sys1', sender: '__system__', text: 'You created this group', time: '', isSystem: true, dateLabel: 'Today' }],
      lastMessage: 'You created this group',
      time: 'Now',
    };
    groups.unshift(newGroup);
    onSelect(newGroup);
    setShowAddParticipants(false);
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Chats</h2>
        <div className="sidebar-header-actions">
          <button className="btn-dots" title="More options"><DotsIcon /></button>
          <div style={{ position: 'relative' }}>
            <button className="btn-plus" title="New" onClick={() => setShowPlusMenu(o => !o)}>+</button>
            {showPlusMenu && (
              <PlusMenu
                onClose={() => setShowPlusMenu(false)}
                onNewGroup={() => setShowNewGroup(true)}
              />
            )}
          </div>
        </div>
      </div>

      {showNewGroup && (
        <NewGroupDialog
          onClose={() => setShowNewGroup(false)}
          onNext={data => { setNewGroupData(data); setShowNewGroup(false); setShowAddParticipants(true); }}
        />
      )}

      {showAddParticipants && (
        <AddParticipantsDialog
          subGroupData={newGroupData}
          onClose={() => setShowAddParticipants(false)}
          onCreate={participants => handleGroupCreated({ groupData: newGroupData, participants })}
        />
      )}

      <div className="search-wrap">
        <SearchIcon />
        <input
          className="search-input"
          placeholder="Search chats and contacts (ctrl + k)"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="tab-row">
        {tabs.map(t => (
          <button
            key={t.label}
            className={`tab-btn${activeTab === t.label ? ' active' : ''}`}
            onClick={() => setActiveTab(t.label)}
          >
            {t.label}
            {t.badge > 0 && <span className="tab-badge">{t.badge}</span>}
          </button>
        ))}
        <button className="filter-btn" title="Filter">
          <FilterIcon />
        </button>
      </div>

      <div className="chat-list">
        {filtered.map(chat => (
          <ChatItem
            key={chat.id}
            chat={chat}
            selected={selected?.id === chat.id}
            onClick={() => onSelect(chat)}
          />
        ))}
      </div>
    </div>
  );
}

function ChatItem({ chat, selected, onClick }) {
  const preview = chat.previewMeta || {};

  return (
    <div
      className={`chat-item${selected ? ' selected' : ''}`}
      onClick={onClick}
    >
      <Avatar name={chat.name} size={46} isGroup={!!chat.isGroup} />
      <div className="chat-item-info">
        <div className="chat-item-top">
          <div className="chat-item-name">
            {chat.name}
            {chat.verified && (
              <span className="verified-icon">
                <VerifiedIcon />
              </span>
            )}
          </div>
          <span className="chat-item-time">{chat.time || ''}</span>
        </div>
        <div className="chat-item-preview">
          {preview.you && <span className="preview-you">You: </span>}
          {preview.sender && <span className="preview-sender">- {preview.sender}: </span>}
          {preview.fileType && <FileTypeIcon type={preview.fileType} />}
          <span>{chat.lastMessage}</span>
        </div>
      </div>
      {chat.unread > 0 && (
        <div className="unread-badge">{chat.unread}</div>
      )}
    </div>
  );
}

function FileTypeIcon({ type }) {
  const color = type === 'zip' ? '#f59e0b' : type === 'image' ? '#10b981' : '#60a5fa';
  return (
    <span className="preview-file-icon" style={{ color }}>
      {type === 'image' ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
        </svg>
      )}
    </span>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#64748b">
      <circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/>
      <line x1="11" y1="18" x2="13" y2="18"/>
    </svg>
  );
}

function VerifiedIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="#4a9eff">
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
    </svg>
  );
}
