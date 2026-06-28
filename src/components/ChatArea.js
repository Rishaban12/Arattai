import React, { useState, useRef, useEffect } from 'react';
import Avatar from './Avatar';
import aiLogo from '../data/ai-logo.png';
import { getSenderColor, groups } from '../data/mockData';
import SubGroupModal from './SubGroupModal';
import CreateSubGroupDialog from './CreateSubGroupDialog';
import AddParticipantsDialog from './AddParticipantsDialog';

export default function ChatArea({ chat, onSubGroupCreated, onOpenSubGroup, allSubGroups, onClose }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showSubGroupModal, setShowSubGroupModal] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddParticipants, setShowAddParticipants] = useState(false);
  const [newSubGroupData, setNewSubGroupData] = useState(null);
  const [messages, setMessages] = useState(chat?.messages || []);
  const [input, setInput] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState([]);
  const [searchIdx, setSearchIdx] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const searchInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    setMessages(chat?.messages || []);
    setMenuOpen(false);
    setSearchOpen(false);
    setSearchQuery('');
    setSearchMatches([]);
    setBellOpen(false);
  }, [chat]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  function handleSearchChange(e) {
    const q = e.target.value;
    setSearchQuery(q);
    if (!q.trim()) { setSearchMatches([]); setSearchIdx(0); return; }
    const matches = messages
      .map((m, i) => ({ i, text: m.text || '' }))
      .filter(m => m.text.toLowerCase().includes(q.toLowerCase()));
    setSearchMatches(matches);
    setSearchIdx(0);
  }

  function searchNav(dir) {
    if (!searchMatches.length) return;
    setSearchIdx(prev => {
      const next = (prev + dir + searchMatches.length) % searchMatches.length;
      return next;
    });
  }

  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchMatches([]);
    setSearchIdx(0);
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    function onClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  if (!chat) {
    return (
      <div className="chat-area empty-chat">
        <p>Select a chat to start messaging</p>
      </div>
    );
  }

  const isGroup = chat.type === 'group';
  const isSubGroup = chat.type === 'subgroup';
  const parentGroup = isSubGroup ? groups.find(g => g.id === chat.parentGroupId) : null;
  const otherSubGroups = isSubGroup && allSubGroups
    ? allSubGroups.filter(sg => chat.otherSubGroups?.includes(sg.id))
    : [];

  const headerName = isSubGroup ? `${chat.name} (${parentGroup?.name || ''})` : chat.name;

  function sendMessage() {
    if (!input.trim()) return;
    setMessages(prev => [...prev, {
      id: `m${Date.now()}`,
      sender: 'You',
      text: input.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMine: true,
    }]);
    setInput('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function handleCreateSubGroupNext(data) {
    setNewSubGroupData(data);
    setShowCreateDialog(false);
    setShowAddParticipants(true);
  }

  function handleSubGroupCreated(data) {
    const newSg = {
      id: `sg${Date.now()}`,
      name: data.name,
      parentGroupId: chat.id,
      participants: data.participants.length + 1,
      type: 'subgroup',
      messages: [
        { id: 'sm_1', sender: '__system__', text: 'You have created this subgroup', time: '', isSystem: true, dateLabel: 'Today' },
      ],
      otherSubGroups: [],
    };
    setShowAddParticipants(false);
    if (onSubGroupCreated) onSubGroupCreated(newSg);
    if (onOpenSubGroup) onOpenSubGroup(newSg);
  }

  return (
    <div className="chat-area">
      {/* ── Header ── */}
      <div className="chat-header">
        {chat.id === 'arattai-ai'
          ? <img src={aiLogo} alt="Arattai AI" style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          : <Avatar name={chat.name} size={42} isGroup={isGroup || isSubGroup} />
        }
        <div className="chat-header-info">
          <div className="chat-header-name">{headerName}</div>
          {chat.id !== 'arattai-ai' && (
            <div className="chat-header-sub">
              {isGroup || isSubGroup ? `${chat.participants} participants` : 'Online'}
            </div>
          )}
        </div>
        <div className="header-actions">
          {!isGroup && !isSubGroup && chat.id !== 'arattai-ai' && chat.id !== 'c2' && (
            <>
              <button className="header-btn" title="Voice call"><PhoneIcon /></button>
              <button className="header-btn" title="Video call"><VideoIcon /></button>
            </>
          )}
          {(isSubGroup || (isGroup && chat.subGroups?.length > 0)) && (
            <button
              className={`header-btn${bellOpen ? ' header-btn-active' : ''}`}
              title="SubGroups"
              onClick={() => setBellOpen(o => !o)}
            >
              <BellIcon />
            </button>
          )}
          {chat.id !== 'arattai-ai' && chat.id !== 'c2' && (
            <button className="header-btn" title="Search" onClick={() => setSearchOpen(o => !o)}>
              <SearchIcon />
            </button>
          )}
          <div className="menu-wrap" ref={menuRef}>
            {chat.id !== 'arattai-ai' && chat.id !== 'c2' && (
              <button className="header-btn" title="Options" onClick={() => setMenuOpen(o => !o)}>
                <DotsIcon />
              </button>
            )}
            {menuOpen && (
              <div className="dropdown-menu">
                <button className="dropdown-item" onClick={() => setMenuOpen(false)}><PinIcon /> Pin</button>
                <button className="dropdown-item" onClick={() => setMenuOpen(false)}><MuteIcon /> Mute</button>
                <button className="dropdown-item" onClick={() => setMenuOpen(false)}><GroupInfoIcon /> Group Info</button>
                {isGroup && (
                  <button className="dropdown-item" onClick={() => { setMenuOpen(false); setShowSubGroupModal(true); }}>
                    <SubGroupIcon /> Sub Group
                  </button>
                )}
              </div>
            )}
          </div>
          <button className="header-btn" title="Close" onClick={onClose}><CloseIcon /></button>
        </div>
      </div>

      {/* ── Search Bar Row (below header) ── */}
      {searchOpen && (
        <div className="header-search-bar">
          <SearchIcon />
          <input
            ref={searchInputRef}
            className="header-search-input"
            placeholder="Search"
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={e => { if (e.key === 'Enter') searchNav(1); if (e.key === 'Escape') closeSearch(); }}
            autoFocus
          />
          <button className="header-search-nav" onClick={() => searchNav(-1)} title="Previous">
            <ChevronUpIcon />
          </button>
          <button className="header-search-nav" onClick={() => searchNav(1)} title="Next">
            <ChevronDownIcon />
          </button>
          <button className="header-search-close" onClick={closeSearch} title="Close">
            <CircleCloseIcon />
          </button>
        </div>
      )}

      {/* ── Bell Panel (SubGroup info below header) ── */}
      {bellOpen && (
        <div className="bell-panel">
          {isGroup && (
            <>
              <div className="bell-panel-title">SubGroups</div>
              {(allSubGroups || []).filter(sg => sg.parentGroupId === chat.id).map(sg => (
                <div key={sg.id} className="bell-panel-item" onClick={() => { setBellOpen(false); onOpenSubGroup && onOpenSubGroup(sg); }}>
                  <Avatar name={sg.name} size={34} isGroup />
                  <span>{sg.name}</span>
                </div>
              ))}
              {(allSubGroups || []).filter(sg => sg.parentGroupId === chat.id).length === 0 && (
                <div className="bell-panel-empty">No subgroups yet</div>
              )}
            </>
          )}
          {isSubGroup && (
            <>
              <div className="bell-panel-title">Main Group</div>
              {parentGroup && (
                <div className="bell-panel-item" onClick={() => { setBellOpen(false); onOpenSubGroup && onOpenSubGroup(parentGroup); }}>
                  <Avatar name={parentGroup.name} size={34} isGroup />
                  <span>{parentGroup.name}</span>
                </div>
              )}
              <div className="bell-panel-title" style={{ marginTop: 10 }}>Other SubGroups</div>
              {(allSubGroups || []).filter(sg => sg.parentGroupId === chat.parentGroupId && sg.id !== chat.id).map(sg => (
                <div key={sg.id} className="bell-panel-item" onClick={() => { setBellOpen(false); onOpenSubGroup && onOpenSubGroup(sg); }}>
                  <Avatar name={sg.name} size={34} isGroup />
                  <span>{sg.name}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── Messages ── */}
      <div className="messages-area">
        {messages.map((msg, idx) => {
          if (msg.isUnreadBar) {
            return <div key={msg.id || idx} className="unread-bar">{msg.text}</div>;
          }
          if (msg.isDateSep) {
            return <div key={msg.id || idx} className="date-separator"><span>{msg.text}</span></div>;
          }
          if (msg.isSystem) {
            return (
              <div key={msg.id || idx} className="system-message-row">
                {msg.dateLabel && (
                  <div className="date-separator-inline"><span>{msg.dateLabel}</span></div>
                )}
                {msg.isLink
                  ? <span className="system-link">{msg.text}</span>
                  : <span className="system-msg-text">{msg.text}</span>
                }
              </div>
            );
          }
          const isNew = idx === messages.length - 1;
          return <MessageBubble key={msg.id || idx} msg={msg} isNew={isNew} />;
        })}


        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ── */}
      <div className="input-area">
        <div className="input-wrap">
          <button className="attach-btn" title="Attach">
            <AttachIcon />
          </button>
          <input
            className="message-input"
            placeholder="Type your message here..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {chat.id !== 'arattai-ai' && <button className="emoji-btn" title="Emoji">😊</button>}
          {chat.id !== 'arattai-ai' && <AiLogoBtn />}
        </div>
        {input.trim() ? (
          <button className="send-btn" onClick={sendMessage} title="Send">
            <SendIcon />
          </button>
        ) : (
          <button className="mic-record-btn" title="Voice message">
            <MicIcon />
          </button>
        )}
      </div>

      {showSubGroupModal && (
        <SubGroupModal
          groupId={chat.id}
          allSubGroups={allSubGroups || []}
          onClose={() => setShowSubGroupModal(false)}
          onOpenSubGroup={sg => { onOpenSubGroup && onOpenSubGroup(sg); }}
          onCreateSubGroup={() => { setShowSubGroupModal(false); setShowCreateDialog(true); }}
        />
      )}

      {showCreateDialog && (
        <CreateSubGroupDialog
          onClose={() => setShowCreateDialog(false)}
          onNext={handleCreateSubGroupNext}
        />
      )}

      {showAddParticipants && (
        <AddParticipantsDialog
          subGroupData={newSubGroupData}
          onClose={() => setShowAddParticipants(false)}
          onCreate={handleSubGroupCreated}
        />
      )}
    </div>
  );
}

function MessageBubble({ msg, isNew }) {
  const [starred, setStarred] = useState(false);
  const [spinning, setSpinning] = useState(isNew && msg.sender === 'Arattai AI');

  return (
    <div className={`message-row${msg.isMine ? ' mine' : ''}`}>
      {!msg.isMine && (
        msg.sender === 'Arattai AI'
          ? <img
              src={aiLogo}
              alt="AI"
              className={spinning ? 'ai-logo-spin' : ''}
              onAnimationEnd={() => setSpinning(false)}
              style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
          : <Avatar name={msg.sender} size={34} />
      )}
      <div className={`bubble${msg.isMine ? ' bubble-mine' : ''}${msg.deleted ? ' bubble-deleted' : ''}`}>
        {!msg.isMine && msg.sender && (
          <div className="msg-sender" style={{ color: getSenderColor(msg.sender) }}>
            {msg.sender}
          </div>
        )}
        {msg.forwardedBy && (
          <div className="msg-forwarded-by">~ {msg.forwardedBy}</div>
        )}

        {msg.deleted ? (
          <span className="deleted-text">This message has been deleted.</span>
        ) : msg.isLink ? (
          <a className="msg-link" href={msg.text} target="_blank" rel="noreferrer">{msg.text}</a>
        ) : (
          msg.text && <div className="msg-text">{msg.text}</div>
        )}

        {msg.linkPreview && (
          <div className="link-preview">
            <div className="link-preview-body">
              <div className="link-preview-title">{msg.linkPreview.title}</div>
              {msg.linkPreview.desc && (
                <div className="link-preview-desc">{msg.linkPreview.desc}</div>
              )}
              <div className="link-preview-domain">
                <div className="link-preview-icon" style={{ background: msg.linkPreview.iconBg || '#1e3558' }}>
                  <span style={{ color: 'white', fontSize: 10, fontWeight: 700 }}>{msg.linkPreview.icon}</span>
                </div>
                {msg.linkPreview.domain}
              </div>
            </div>
          </div>
        )}

        <div className="msg-footer">
          <button className="msg-action-btn" onClick={() => setStarred(s => !s)} title="Star">
            <StarIcon filled={starred} />
          </button>
          {msg.time && <span className="msg-time">{msg.time}</span>}
          <button className="msg-action-btn" title="Forward">
            <ForwardIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Icons ── */
function BellIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="18 15 12 9 6 15"/>
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}

function CircleCloseIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z"/>
    </svg>
  );
}

function MuteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8a6 6 0 0 0-9.33-5M6.26 6.26A6 6 0 0 0 6 8v4l-2 2v1h13M15 13V8a3 3 0 0 0-2-2.83M9 17v1a3 3 0 0 0 6 0v-1"/>
    </svg>
  );
}

function GroupInfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

function SubGroupIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

function AttachIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
    </svg>
  );
}

function AiLogoBtn() {
  const [spinning, setSpinning] = React.useState(false);
  function handleClick() {
    if (spinning) return;
    setSpinning(true);
  }
  return (
    <img
      src={aiLogo}
      alt="AI"
      className={`input-ai-logo${spinning ? ' ai-logo-spin' : ''}`}
      onClick={handleClick}
      onAnimationEnd={() => setSpinning(false)}
      style={{ cursor: 'pointer' }}
    />
  );
}

function SendIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="white">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
    </svg>
  );
}

function StarIcon({ filled }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill={filled ? '#f59e0b' : 'none'} stroke={filled ? '#f59e0b' : 'currentColor'} strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
}

function ForwardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/>
    </svg>
  );
}
