import React, { useState, useRef, useEffect } from 'react';
import Avatar from './Avatar';
import aiLogo from '../data/ai-logo.png';
import { getSenderColor } from '../lib/colors';
import SubGroupModal from './SubGroupModal';
import CreateSubGroupDialog from './CreateSubGroupDialog';
import AddParticipantsDialog from './AddParticipantsDialog';
import { api } from '../lib/api';
import { sendSocketMessage, sendReadReceipt, sendTyping } from '../lib/socket';
import { AI_MODES } from '../constants/aiPrompts';

const fmtTime = iso => iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

// The messaging pipeline addresses chats as dm:{a}:{b}, group:{id}, subgroup:{id}.
// The Arattai AI chat is ephemeral — never sent over the socket, never persisted.
const wsChatId = chat => {
  if (!chat || chat.id === 'arattai-ai') return null;
  if (chat.type === 'direct') return chat.id;
  if (chat.type === 'group') return `group:${chat.id}`;
  if (chat.type === 'subgroup') return `subgroup:${chat.id}`;
  return null;
};

export default function ChatArea({ chat, onSubGroupCreated, onOpenSubGroup, allSubGroups, groups = [], contacts = [], me = null, incoming = null, typing = null, presence = {}, onDeleteChat, onMessageSent, onStartCall, onClose, onExitGroup }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showSubGroupModal, setShowSubGroupModal] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddParticipants, setShowAddParticipants] = useState(false);
  const [newSubGroupData, setNewSubGroupData] = useState(null);
  const [groupMemberContacts, setGroupMemberContacts] = useState([]);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [groupInfoMembers, setGroupInfoMembers] = useState([]);
  const [groupInfoLoading, setGroupInfoLoading] = useState(false);
  const [messages, setMessages] = useState(chat?.messages || []);
  const [aiLoading, setAiLoading] = useState(false);
  const [input, setInput] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState([]);
  const [searchIdx, setSearchIdx] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const [typingFrom, setTypingFrom] = useState(null);
  const [otherOnline, setOtherOnline] = useState(null);
  const [pendingMedia, setPendingMedia] = useState(null); // { url, contentType, name }
  const [uploading, setUploading] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const emojiPickerRef = useRef(null);
  const searchInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const menuRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimerRef = useRef(null);
  const lastTypingSentRef = useRef(0);

  useEffect(() => {
    setMessages(chat?.messages || []);
    setMenuOpen(false);
    setSearchOpen(false);
    setSearchQuery('');
    setSearchMatches([]);
    setBellOpen(false);
    setAiLoading(false);
    setTypingFrom(null);
    setOtherOnline(null);
    setPendingMedia(null);
    setUploading(false);
    setEmojiPickerOpen(false);
    setShowGroupInfo(false);
    setGroupInfoMembers([]);
  }, [chat]);

  // Initial presence snapshot for the person in a direct chat
  useEffect(() => {
    if (!chat || chat.type !== 'direct' || !chat.userId) return;
    let cancelled = false;
    api.getPresence(chat.userId)
      .then(p => { if (!cancelled) setOtherOnline(p.online); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [chat]); // eslint-disable-line

  // Show "typing…" while the other person types; hide after 3s of silence
  useEffect(() => {
    if (!typing || !chat || typing.chatId !== wsChatId(chat) || typing.senderId === me?.id) return;
    setTypingFrom(typing.senderId);
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => setTypingFrom(null), 3000);
  }, [typing]); // eslint-disable-line

  const senderName = senderId => {
    if (senderId === me?.id) return 'You';
    if (chat?.type === 'direct') return chat.name;
    const contact = contacts.find(u => u.userId === senderId);
    return contact?.name || `User ${senderId}`;
  };

  // Load persisted history when opening a direct, group, or subgroup chat
  useEffect(() => {
    const chatKey = wsChatId(chat);
    if (!chatKey) return;
    let cancelled = false;
    api.getMessages(chatKey)
      .then(hist => {
        if (cancelled) return;
        // API returns newest-first; the UI renders oldest-first
        setMessages(hist.slice().reverse().map(m => ({
          id: m.messageId,
          sender: senderName(m.senderId),
          text: m.content,
          mediaUrl: m.mediaUrl,
          contentType: m.mediaUrl?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? 'image/' : m.mediaUrl?.endsWith('.pdf') ? 'application/pdf' : undefined,
          time: fmtTime(m.createdAt),
          isMine: m.senderId === me?.id,
        })));
        // Opening the chat marks it read — clears the unread badge
        if (hist.length) {
          sendReadReceipt(chatKey, hist[0].messageId);
          onMessageSent && onMessageSent();
        }
      })
      .catch(e => console.error('load history failed', e));
    return () => { cancelled = true; };
  }, [chat, me, contacts]); // eslint-disable-line

  // Append real-time messages arriving over the WebSocket for this chat
  useEffect(() => {
    if (!incoming || !chat || incoming.chatId !== wsChatId(chat)) return;
    if (incoming.senderId === me?.id) return; // fan-out excludes sender, but be safe
    setMessages(prev => prev.some(m => m.id === incoming.messageId) ? prev : [...prev, {
      id: incoming.messageId,
      sender: senderName(incoming.senderId),
      text: incoming.content,
      mediaUrl: incoming.mediaUrl,
      contentType: incoming.mediaUrl?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? 'image/' : incoming.mediaUrl?.endsWith('.pdf') ? 'application/pdf' : undefined,
      time: fmtTime(incoming.createdAt),
      isMine: false,
    }]);
    // The chat is open, so we've read it immediately
    sendReadReceipt(incoming.chatId, incoming.messageId);
  }, [incoming]); // eslint-disable-line

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

  useEffect(() => {
    if (!emojiPickerOpen) return;
    function onClickOutside(e) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) setEmojiPickerOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [emojiPickerOpen]);

  if (!chat) {
    return (
      <div className="chat-area empty-chat">
        <p>Select a chat to start messaging</p>
      </div>
    );
  }

  const isGroup = chat.type === 'group';
  const isSubGroup = chat.type === 'subgroup';
  const parentGroup = isSubGroup ? groups.find(g => g.id === (chat.groupId ?? chat.parentGroupId)) : null;
  const otherSubGroups = isSubGroup && allSubGroups
    ? allSubGroups.filter(sg => chat.otherSubGroups?.includes(sg.id))
    : [];

  const headerName = isSubGroup ? `${chat.name} (${parentGroup?.name || ''})` : chat.name;

  // Unread badges for the bell: subgroups of this group, or (inside a subgroup)
  // the parent group plus sibling subgroups.
  const subsOfGroup = gid => (allSubGroups || []).filter(sg => (sg.parentGroupId ?? sg.groupId) === gid);
  const bellUnreadTotal = isGroup
    ? subsOfGroup(chat.id).reduce((sum, sg) => sum + (sg.unread || 0), 0)
    : isSubGroup
      ? (parentGroup?.unread || 0) +
        subsOfGroup(chat.parentGroupId ?? chat.groupId)
          .filter(sg => sg.id !== chat.id)
          .reduce((sum, sg) => sum + (sg.unread || 0), 0)
      : 0;

  async function sendMessage() {
    if (!input.trim() && !pendingMedia) return;
    if (aiLoading) return;
    const text = input.trim();
    const media = pendingMedia;
    setInput('');
    setPendingMedia(null);

    const userMsg = {
      id: `m${Date.now()}`,
      sender: 'You',
      text,
      mediaUrl: media?.url,
      contentType: media?.contentType,
      fileName: media?.name,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMine: true,
    };
    setMessages(prev => [...prev, userMsg]);

    const chatKey = wsChatId(chat);
    if (chatKey) {
      const clientMsgId = window.crypto?.randomUUID ? window.crypto.randomUUID() : `c${Date.now()}`;
      const sent = sendSocketMessage(chatKey, text, clientMsgId, media?.url);
      if (!sent) window.alert('Not connected — message not sent');
      else onMessageSent && onMessageSent();
      return;
    }

    if (chat.id === 'arattai-ai') {
      setAiLoading(true);
      // Build full conversation history so GPT has context across the whole session
      const history = messages
        .filter(m => m.text && !m.isSystem && !m.isDateSep && !m.isUnreadBar)
        .map(m => ({ role: m.isMine ? 'user' : 'assistant', content: m.text }));
      history.push({ role: 'user', content: text });

      try {
        const reply = await api.sendAiMessage(history);
        setMessages(prev => [...prev, {
          id: `ai${Date.now()}`,
          sender: 'Arattai AI',
          text: reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }]);
      } catch {
        setMessages(prev => [...prev, {
          id: `ai-err${Date.now()}`,
          sender: 'Arattai AI',
          text: 'Sorry, I could not reach the AI service. Please try again.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }]);
      } finally {
        setAiLoading(false);
      }
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    if (e.key === 'Escape' && pendingMedia) { setPendingMedia(null); }
  }

  // Tell the other members we're typing, at most once every 2s
  function handleInputChange(e) {
    setInput(e.target.value);
    const chatKey = wsChatId(chat);
    if (!chatKey || !e.target.value.trim()) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current > 2000) {
      lastTypingSentRef.current = now;
      sendTyping(chatKey);
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.uploadMedia(file);
      setPendingMedia({ url: res.mediaUrl, contentType: res.contentType, name: file.name });
    } catch (err) {
      window.alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleCreateSubGroupNext(data) {
    setNewSubGroupData(data);
    setShowCreateDialog(false);
    // Subgroup participants can only come from the parent group's members
    try {
      const members = await api.getGroupMembers(chat.id);
      setGroupMemberContacts(members.filter(m => m.id !== me?.id).map(m => ({ ...m, userId: m.id })));
    } catch (e) {
      console.error('getGroupMembers failed', e);
      setGroupMemberContacts([]);
    }
    setShowAddParticipants(true);
  }

  async function handleSubGroupCreated(data) {
    try {
      const res = await api.createSubGroup(chat.id, { name: data.name });
      const participants = data.participants || [];
      await Promise.all(participants.map(p =>
        api.addSubGroupMember(res.id, p.userId ?? p.id).catch(e =>
          console.error(`addSubGroupMember failed for ${p.name}`, e))
      ));
      const newSg = {
        id: res.id,
        name: data.name,
        groupId: chat.id,
        parentGroupId: chat.id,
        participants: participants.length + 1,
        type: 'subgroup',
        isGroup: true,
        messages: [
          { id: 'sm_1', sender: '__system__', text: 'You have created this subgroup', time: '', isSystem: true, dateLabel: 'Today' },
        ],
        otherSubGroups: [],
      };
      if (onSubGroupCreated) onSubGroupCreated(newSg);
      if (onOpenSubGroup) onOpenSubGroup(newSg);
    } catch (e) {
      console.error('createSubGroup failed', e);
      window.alert(e.message || 'Could not create subgroup');
    }
    setShowAddParticipants(false);
  }

  return (
    <div className="chat-area">
      {/* ── Header ── */}
      <div className="chat-header">
        <div
          className={`chat-header-identity${(isGroup || isSubGroup) ? ' chat-header-identity-clickable' : ''}`}
          onClick={() => {
            if (!isGroup && !isSubGroup) return;
            if (!showGroupInfo) {
              setShowGroupInfo(true);
              setGroupInfoLoading(true);
              const gid = isGroup ? chat.id : (chat.groupId ?? chat.parentGroupId ?? chat.id);
              api.getGroupMembers(gid)
                .then(members => setGroupInfoMembers(members))
                .catch(() => setGroupInfoMembers([]))
                .finally(() => setGroupInfoLoading(false));
            } else {
              setShowGroupInfo(false);
            }
          }}
        >
          {chat.id === 'arattai-ai'
            ? <img src={aiLogo} alt="Arattai AI" style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            : <Avatar name={chat.name} size={42} isGroup={isGroup || isSubGroup} />
          }
        <div className="chat-header-info">
          <div className="chat-header-name">{headerName}</div>
          {chat.id !== 'arattai-ai' && (
            <div className="chat-header-sub">
              {typingFrom ? (
                <span style={{ color: '#22c55e', fontStyle: 'italic' }}>
                  {isGroup || isSubGroup ? `${senderName(typingFrom)} is typing…` : 'typing…'}
                </span>
              ) : isGroup || isSubGroup ? (
                `${chat.participants ?? ''} participants`
              ) : (
                (presence[chat.userId] ?? otherOnline)
                  ? <span style={{ color: '#22c55e' }}>Online</span>
                  : <span style={{ opacity: 0.6 }}>Offline</span>
              )}
            </div>
          )}
        </div>
        </div>
        <div className="header-actions">
          {!isGroup && !isSubGroup && chat.id !== 'arattai-ai' && chat.id !== 'c2' && (
            <>
              <button className="header-btn" title="Voice call" onClick={() => onStartCall && onStartCall(chat, 'audio')}><PhoneIcon /></button>
              <button className="header-btn" title="Video call" onClick={() => onStartCall && onStartCall(chat, 'video')}><VideoIcon /></button>
            </>
          )}
          {(isSubGroup || (isGroup && (allSubGroups || []).some(sg => (sg.parentGroupId ?? sg.groupId) === chat.id))) && (
            <button
              className={`header-btn${bellOpen ? ' header-btn-active' : ''}`}
              title="SubGroups"
              style={{ position: 'relative' }}
              onClick={() => setBellOpen(o => !o)}
            >
              <BellIcon />
              {bellUnreadTotal > 0 && <BellBadge count={bellUnreadTotal} />}
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
                {(isGroup || isSubGroup) && (
                  <button className="dropdown-item" onClick={() => setMenuOpen(false)}><GroupInfoIcon /> Group Info</button>
                )}
                {isGroup && (
                  <button className="dropdown-item" onClick={() => { setMenuOpen(false); setShowSubGroupModal(true); }}>
                    <SubGroupIcon /> Sub Group
                  </button>
                )}
                {chat.type === 'direct' && (
                  <button
                    className="dropdown-item"
                    style={{ color: '#ef4444' }}
                    onClick={() => {
                      setMenuOpen(false);
                      if (window.confirm(`Delete chat with ${chat.name}? You can find them again through search.`)) {
                        onDeleteChat && onDeleteChat(chat);
                      }
                    }}
                  >
                    <TrashIcon /> Delete Chat
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
              {subsOfGroup(chat.id).map(sg => (
                <div key={sg.id} className="bell-panel-item" onClick={() => { setBellOpen(false); onOpenSubGroup && onOpenSubGroup(sg); }}>
                  <Avatar name={sg.name} size={34} isGroup />
                  <span style={{ flex: 1 }}>{sg.name}</span>
                  {sg.unread > 0 && <div className="unread-badge">{sg.unread}</div>}
                </div>
              ))}
              {subsOfGroup(chat.id).length === 0 && (
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
                  <span style={{ flex: 1 }}>{parentGroup.name}</span>
                  {parentGroup.unread > 0 && <div className="unread-badge">{parentGroup.unread}</div>}
                </div>
              )}
              <div className="bell-panel-title" style={{ marginTop: 10 }}>Other SubGroups</div>
              {subsOfGroup(chat.parentGroupId ?? chat.groupId).filter(sg => sg.id !== chat.id).map(sg => (
                <div key={sg.id} className="bell-panel-item" onClick={() => { setBellOpen(false); onOpenSubGroup && onOpenSubGroup(sg); }}>
                  <Avatar name={sg.name} size={34} isGroup />
                  <span style={{ flex: 1 }}>{sg.name}</span>
                  {sg.unread > 0 && <div className="unread-badge">{sg.unread}</div>}
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


        {aiLoading && (
          <div className="message-row">
            <img src={aiLogo} alt="AI" className="ai-logo-spin" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            <div className="bubble">
              <div className="msg-sender" style={{ color: '#60a5fa' }}>Arattai AI</div>
              <div className="msg-text" style={{ opacity: 0.5 }}>●●●</div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ── */}
      <div className="input-area">
        {/* Pending media preview */}
        {pendingMedia && (
          <div className="pending-media-preview">
            {pendingMedia.contentType?.startsWith('image/') ? (
              <img src={pendingMedia.url} alt="preview" style={{ maxHeight: 80, maxWidth: 140, borderRadius: 6, objectFit: 'cover' }} />
            ) : (
              <div className="pending-file-card">
                <FileCardIcon type="pdf" />
                <span className="pending-file-name">{pendingMedia.name}</span>
              </div>
            )}
            <button className="pending-media-remove" onClick={() => setPendingMedia(null)} title="Remove">✕</button>
          </div>
        )}
        <div className="input-wrap">
          {/* Hidden file input — accept images and PDFs */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <button
            className="attach-btn"
            title={uploading ? 'Uploading…' : 'Attach image or PDF'}
            disabled={uploading || chat.id === 'arattai-ai'}
            onClick={() => fileInputRef.current?.click()}
            style={uploading ? { opacity: 0.5 } : {}}
          >
            {uploading ? <UploadSpinner /> : <AttachIcon />}
          </button>
          <input
            className="message-input"
            placeholder={pendingMedia ? 'Add a caption…' : 'Type your message here...'}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
          />
          {chat.id !== 'arattai-ai' && (
            <div className="emoji-btn-wrap" ref={emojiPickerRef}>
              {emojiPickerOpen && (
                <EmojiPicker onSelect={emoji => { setInput(prev => prev + emoji); }} />
              )}
              <button
                className="emoji-btn"
                title="Emoji"
                onClick={() => setEmojiPickerOpen(o => !o)}
              >😊</button>
            </div>
          )}
          {chat.id !== 'arattai-ai' && <AiLogoBtn input={input} setInput={setInput} />}
        </div>
        {(input.trim() || pendingMedia) ? (
          <button className="send-btn" onClick={sendMessage} title="Send" disabled={aiLoading || uploading} style={(aiLoading || uploading) ? { opacity: 0.5 } : {}}>
            <SendIcon />
          </button>
        ) : (
          <button className="mic-record-btn" title="Voice message">
            <MicIcon />
          </button>
        )}
      </div>

      {showGroupInfo && (isGroup || isSubGroup) && (
        <GroupInfoPanel
          chat={chat}
          isGroup={isGroup}
          me={me}
          contacts={contacts}
          members={groupInfoMembers}
          loading={groupInfoLoading}
          onClose={() => setShowGroupInfo(false)}
          onClearMessages={() => setMessages([])}
          onExitGroup={async () => {
            const gid = isGroup ? chat.id : (chat.groupId ?? chat.parentGroupId ?? chat.id);
            try {
              await api.leaveGroup(gid, me?.id);
            } catch (e) {
              window.alert(e.message || 'Could not leave group');
              return;
            }
            setShowGroupInfo(false);
            onExitGroup && onExitGroup(chat);
          }}
        />
      )}

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
          contacts={groupMemberContacts}
          onClose={() => setShowAddParticipants(false)}
          onCreate={handleSubGroupCreated}
        />
      )}
    </div>
  );
}

function GroupInfoPanel({ chat, isGroup, me, contacts, members, loading, onClose, onClearMessages, onExitGroup }) {
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [exiting, setExiting] = useState(false);

  const memberName = m => {
    if (m.id === me?.id || m.userId === me?.id) return (m.name || 'You') + ' (You)';
    const c = contacts.find(u => u.id === m.id || u.userId === m.id || u.userId === m.userId);
    return c?.name || m.name || `User ${m.id ?? m.userId}`;
  };

  const createdDate = chat.createdAt
    ? new Date(chat.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  async function handleExit() {
    if (!window.confirm(`Exit "${chat.name}"? You will no longer receive messages from this group.`)) return;
    setExiting(true);
    try { await onExitGroup(); } finally { setExiting(false); }
  }

  return (
    <div className="group-info-overlay" onClick={onClose}>
      <div className="group-info-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="gip-header">
          <span className="gip-title">Group info</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="gip-icon-btn" title="Close" onClick={onClose}>
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="gip-body">
          {/* Group avatar + name */}
          <div className="gip-hero">
            <Avatar name={chat.name} size={72} isGroup />
            <div className="gip-hero-name">{chat.name}</div>
            <div className="gip-hero-sub">{chat.participants ?? members.length} participants</div>
            {createdDate && (
              <div className="gip-created">Group created on {createdDate}</div>
            )}
          </div>

          <div className="gip-divider" />

          {/* Mute */}
          <button className="gip-row" onClick={() => setMuted(m => !m)}>
            <span className="gip-row-icon"><MuteIcon /></span>
            <span className="gip-row-label">Mute group</span>
            <span className="gip-row-right">
              <span className={`gip-toggle${muted ? ' gip-toggle-on' : ''}`} />
            </span>
          </button>

          <div className="gip-divider" />

          {/* Participants */}
          <button className="gip-row" onClick={() => setParticipantsOpen(o => !o)}>
            <span className="gip-row-icon"><GroupInfoIcon /></span>
            <span className="gip-row-label">Participants</span>
            <span className="gip-row-right">
              {participantsOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
            </span>
          </button>
          {participantsOpen && (
            <div className="gip-participants">
              {loading ? (
                <div className="gip-participants-loading">Loading…</div>
              ) : members.length === 0 ? (
                <div className="gip-participants-loading">No members found</div>
              ) : members.map((m, i) => (
                <div key={m.id ?? m.userId ?? i} className="gip-participant-row">
                  <Avatar name={memberName(m)} size={34} />
                  <span className="gip-participant-name">{memberName(m)}</span>
                  {(m.role === 'admin' || m.role === 'owner') && (
                    <span className="gip-participant-role">{m.role}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Starred messages */}
          <button className="gip-row">
            <span className="gip-row-icon"><StarIcon filled={false} /></span>
            <span className="gip-row-label">Starred messages</span>
            <span className="gip-row-right"><ChevronRightIcon /></span>
          </button>

          <div className="gip-divider" />

          {/* Media sections */}
          {['Photos', 'Videos', 'Files', 'Links'].map(label => (
            <button key={label} className="gip-row">
              <span className="gip-row-icon"><MediaIcon type={label} /></span>
              <span className="gip-row-label">{label}</span>
              <span className="gip-row-right"><ChevronRightIcon /></span>
            </button>
          ))}

          <div className="gip-divider" />

          {/* Clear messages */}
          <button className="gip-row gip-row-danger" onClick={() => { if (window.confirm('Clear all messages?')) { onClearMessages(); onClose(); } }}>
            <span className="gip-row-icon"><TrashIcon /></span>
            <span className="gip-row-label">Clear messages</span>
          </button>

          {/* Exit group */}
          {isGroup && (
            <button className="gip-row gip-row-danger" onClick={handleExit} disabled={exiting}>
              <span className="gip-row-icon"><ExitIcon /></span>
              <span className="gip-row-label">{exiting ? 'Leaving…' : 'Exit group'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}

function ExitIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

function MediaIcon({ type }) {
  if (type === 'Photos') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  );
  if (type === 'Videos') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
    </svg>
  );
  if (type === 'Files') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  );
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
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
          <>
            {msg.mediaUrl && msg.contentType?.startsWith('image/') && (
              <a href={msg.mediaUrl} target="_blank" rel="noreferrer">
                <img src={msg.mediaUrl} alt="attachment" style={{ maxWidth: 240, maxHeight: 200, borderRadius: 8, display: 'block', marginBottom: msg.text ? 6 : 0, objectFit: 'cover' }} />
              </a>
            )}
            {msg.mediaUrl && msg.contentType === 'application/pdf' && (
              <a href={msg.mediaUrl} target="_blank" rel="noreferrer" className="msg-file-card">
                <FileCardIcon type="pdf" />
                <span className="msg-file-name">{msg.fileName || 'Document.pdf'}</span>
                <span className="msg-file-dl">↓</span>
              </a>
            )}
            {msg.text && <div className="msg-text">{msg.text}</div>}
          </>
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

const EMOJI_CATEGORIES = [
  { label: '😊', name: 'Smileys', emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','😋','😛','😜','🤪','😝','🤑','🤗','🤔','🤐','🤨','😐','😑','😶','🙄','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','😴','🥱','🤤','😪','🤢','🤮','🤧','🤒','🤕','🥴','😵','💫','🤠','🥸','🥳','😎','🤓','🧐','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'] },
  { label: '👋', name: 'Gestures', emojis: ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🫶','💋','👄','🦷','👅','👁️','👀','👃','👂','🫀','🫁','🧠','🦴'] },
  { label: '🐶', name: 'Animals', emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🦋','🐛','🐌','🐞','🐜','🦟','🦗','🕷️','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🦭','🐊','🐅','🐆','🦓','🦍','🦧','🦣','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐈','🐈‍⬛','🐓','🦃','🦤','🦚','🦜','🦢','🦩','🕊️','🐇','🦝','🦨','🦡','🦫','🦦','🦥','🐁','🐀','🐿️','🦔'] },
  { label: '🍎', name: 'Food', emojis: ['🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🫑','🥕','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🥪','🥙','🧆','🌮','🌯','🥗','🥘','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🍤','🍙','🍚','🍘','🍥','🥮','🍢','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🍾','☕','🍵','🧃','🥤','🧋'] },
  { label: '✈️', name: 'Travel', emojis: ['✈️','🛫','🛬','🛩️','🚀','🛸','🚁','🚂','🚃','🚄','🚅','🚆','🚇','🚈','🚉','🚊','🚝','🚞','🚋','🚌','🚍','🚎','🚐','🚑','🚒','🚓','🚔','🚕','🚖','🚗','🚘','🚙','🛻','🚚','🚛','🚜','🏎️','🏍️','🛵','🚲','🛴','🛹','🛼','⛽','🚧','🚦','🚥','🛑','🗺️','🗽','🗼','🏰','🏯','🏟️','🎡','🎢','🎠','⛲','🌁','🏔️','⛰️','🌋','🗻','🏕️','🏖️','🏜️','🏝️','🏞️','🏗️','🏘️','🏚️','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','💒','⛪','🕌','🛕','🕍','⛩️','🕋','⛺','🌐','🧭','🌅','🌄','🌠','🎇','🎆','🌇','🌆','🏙️','🌃','🌌','🌉','🌁'] },
  { label: '⚽', name: 'Activity', emojis: ['⚽','🏀','🏈','⚾','🥎','🏐','🏉','🎾','🥏','🎱','🏓','🏸','🏒','🏑','🥍','🏏','🪃','🥅','⛳','🪁','🛝','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛷','⛸️','🥌','🎿','🎯','🪀','🪆','🎭','🎨','🎬','🎤','🎧','🎼','🎻','🪕','🎹','🥁','🪘','🎷','🎺','🪗','🎸','🎮','🕹️','🎲','♟️','🎳','🎰','🧩'] },
  { label: '💡', name: 'Objects', emojis: ['📱','📲','💻','⌨️','🖥️','🖨️','🖱️','💽','💾','💿','📀','📷','📸','📹','🎥','📽️','🎞️','📞','☎️','📟','📠','📺','📻','🧭','⏰','⌛','⏳','🧲','💡','🔦','🕯️','🪔','🧱','🪞','🪟','🛋️','🪑','🚿','🛁','🧹','🧺','🧻','🧼','🧴','🪒','🧽','🛒','🚪','🛏️','🧸','🪆','🎎','🎍','🎏','🎐','🎑','🧧','🎀','🎁','🎗️','🎟️','🎫','🏆','🥇','🥈','🥉','🏅','🎖️','🔑','🗝️','🔒','🔓','🔔','🔕','🔇','📢','📣','📯','🔈','📡','🔭','🔬','💈','🪄','🎩','💎','🔮','🪬','🧿','💊','💉','🩺','🩹','🩻','🩼','🦯','🦺'] },
  { label: '❤️', name: 'Symbols', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','❤️‍🔥','❤️‍🩹','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','☸️','✡️','🛐','♻️','✅','❎','🆗','🆙','🆒','🆕','🆓','💯','🆖','🔞','🚫','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔺','🔻','🔷','🔶','🔹','🔸','🔳','🔲','⭐','🌟','💫','✨','🌙','☀️','🌤️','⛅','🌦️','🌧️','⛈️','🌩️','🌨️','🌊','🌈','☔','⚡','❄️','☃️','⛄','🔥','💧'] },
];

function EmojiPicker({ onSelect }) {
  const [activeCategory, setActiveCategory] = useState(0);
  return (
    <div className="emoji-picker">
      <div className="emoji-picker-tabs">
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button
            key={cat.name}
            className={`emoji-picker-tab${activeCategory === i ? ' active' : ''}`}
            title={cat.name}
            onClick={() => setActiveCategory(i)}
          >
            {cat.label}
          </button>
        ))}
      </div>
      <div className="emoji-picker-grid">
        {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji, i) => (
          <button key={i} className="emoji-item" onClick={() => onSelect(emoji)}>
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

function BellBadge({ count }) {
  return (
    <span style={{
      position: 'absolute', top: 1, right: 1,
      background: '#ef4444', color: '#fff',
      borderRadius: 9, minWidth: 15, height: 15,
      fontSize: 10, fontWeight: 700, lineHeight: 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 3px', pointerEvents: 'none',
    }}>
      {count > 99 ? '99+' : count}
    </span>
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

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
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

function AiLogoBtn({ input, setInput }) {
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!pickerOpen) return;
    function onOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setPickerOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [pickerOpen]);

  async function runTransform(mode) {
    if (!input.trim() || loading) return;
    setPickerOpen(false);
    setLoading(true);
    try {
      const result = await api.transformMessage(input.trim(), mode);
      setInput(result);
    } catch {
      // keep original input on failure
    } finally {
      setLoading(false);
    }
  }

  function handleClick() {
    if (loading || !input.trim()) return;
    setPickerOpen(p => !p);
  }

  const disabled = !input.trim() || loading;

  return (
    <div className="ai-transform-wrap" ref={wrapperRef}>
      {pickerOpen && (
        <div className="ai-transform-picker">
          {Object.entries(AI_MODES).map(([key, mode]) => (
            <button
              key={key}
              className="ai-transform-mode-btn"
              onClick={() => runTransform(key)}
              title={mode.description}
            >
              <span className="ai-mode-emoji">{mode.emoji}</span>
              <span className="ai-mode-label">{mode.label}</span>
            </button>
          ))}
        </div>
      )}
      <img
        src={aiLogo}
        alt="AI Transform"
        className={`input-ai-logo${loading ? ' ai-logo-spin' : ''}`}
        onClick={handleClick}
        title={disabled ? 'Type a message to use AI Transform' : 'AI Transform — click to choose mode'}
        style={{ cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.35 : 1 }}
      />
    </div>
  );
}

function UploadSpinner() {
  return (
    <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #334155', borderTopColor: '#4a9eff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
  );
}

function FileCardIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#ef4444">
      <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
    </svg>
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
