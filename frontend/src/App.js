import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import LandingPage from './components/LandingPage';
import OAuthPage from './components/OAuthPage';
import SettingsPage from './components/SettingsPage';
import HamburgerMenu from './components/HamburgerMenu';
import CallOverlay from './components/CallOverlay';
import aiLogo from './data/ai-logo.png';
import { api } from './lib/api';
import { connectSocket } from './lib/socket';

const AI_CHAT = {
  id: 'arattai-ai',
  name: 'Arattai AI',
  type: 'direct',
  participants: 1,
  lastMessage: 'How can I help you?',
  time: 'Now',
  verified: false,
  messages: [
    {
      id: 'ai1',
      sender: 'Arattai AI',
      text: 'Hi! I am Arattai AI. How can I help you today?',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ],
};

export default function App() {
  // Auth flow: landing → oauth → chat
  // ?auth=success → skip landing & oauth, go to chat
  // ?auth=error   → skip landing, show oauth with error message
  const params    = new URLSearchParams(window.location.search);
  const authParam = params.get('auth');
  const authError = params.get('reason');
  const [showLanding, setShowLanding] = useState(authParam !== 'success' && authParam !== 'error');
  const [showOAuth,   setShowOAuth]   = useState(authParam === 'error');
  const [authChecked, setAuthChecked] = useState(!!authParam);
  const [showSettings, setShowSettings] = useState(false);
  const [showHamburger, setShowHamburger] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [selectedChat, setSelectedChat] = useState(null);
  const [dbGroups, setDbGroups] = useState([]);
  const [dbSubGroups, setDbSubGroups] = useState([]);
  const [dbContacts, setDbContacts] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [incoming, setIncoming] = useState(null);
  const [typingEvt, setTypingEvt] = useState(null);
  const [presence, setPresence] = useState({});
  const [me, setMe] = useState(null);
  const [callEvt, setCallEvt] = useState(null);
  const [outgoingCall, setOutgoingCall] = useState(null);

  const inChat = !showLanding && !showOAuth;

  useEffect(() => {
    if (authParam) { window.history.replaceState({}, '', '/'); return; }
    // On refresh with no URL param: check if an HttpOnly cookie session already exists
    api.getMe()
      .then(user => {
        setMe(user);
        setShowLanding(false);
        setShowOAuth(false);
      })
      .catch(() => { /* 401 — stay on landing */ })
      .finally(() => setAuthChecked(true));
  }, []); // eslint-disable-line

  useEffect(() => {
    document.body.classList.toggle('light', !darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (!inChat) return;
    fetchGroups();
    fetchContacts();
    fetchConversations();
    api.getMe().then(setMe).catch(e => console.error('getMe failed', e));
  }, [inChat]); // eslint-disable-line

  // Real-time socket: cookie-authenticated, one connection per session
  useEffect(() => {
    if (!inChat) return;
    const disconnect = connectSocket(null, evt => {
      if (evt.type === 'MESSAGE' && evt.data) {
        setIncoming(evt.data);
        // InboxConsumer updates the inbox via Kafka — refresh shortly after
        setTimeout(fetchConversations, 1500);
      } else if (evt.type === 'TYPING') {
        setTypingEvt({ chatId: evt.chatId, senderId: evt.senderId, at: Date.now() });
      } else if (evt.type === 'PRESENCE') {
        setPresence(prev => ({ ...prev, [evt.userId]: evt.online }));
      } else if (evt.type === 'GROUP_ADDED' || evt.type === 'SUBGROUP_ADDED') {
        fetchGroups();
      } else if (evt.type && evt.type.startsWith('CALL_')) {
        setCallEvt({ ...evt, at: Date.now() });
      }
    });
    return disconnect;
  }, [inChat]); // eslint-disable-line

  async function fetchConversations() {
    try {
      setConversations(await api.getConversations());
    } catch (e) {
      console.error('fetchConversations failed', e);
    }
  }

  async function fetchContacts() {
    try {
      const users = await api.getContacts();
      setDbContacts(users.map(u => ({
        ...u,
        userId: u.id,
        type: 'direct',
        isGroup: false,
        lastMessage: '',
        time: '',
      })));
    } catch (e) {
      console.error('fetchContacts failed', e);
    }
  }

  async function fetchGroups() {
    try {
      const groups = await api.getGroups();
      const shaped = await Promise.all(groups.map(async g => {
        let subs = [];
        try { subs = await api.getSubGroups(g.id); } catch (_) {}
        return {
          ...g,
          type: 'group',
          isGroup: true,
          lastMessage: '',
          time: '',
          subGroups: subs.map(s => ({ ...s, type: 'subgroup', isGroup: true, groupId: g.id, parentGroupId: g.id, lastMessage: '', time: '' })),
        };
      }));
      setDbGroups(shaped);
      const allSubs = shaped.flatMap(g => g.subGroups);
      setDbSubGroups(allSubs);
    } catch (e) {
      console.error('fetchGroups failed', e);
    }
  }

  const dmChatId = (a, b) => `dm:${Math.min(a, b)}:${Math.max(a, b)}`;

  // Merge inbox previews (last message, unread) into group/subgroup entries
  const convByChatId = Object.fromEntries(conversations.map(c => [c.chatId, c]));
  const enrich = (item, chatKey) => {
    const conv = convByChatId[chatKey];
    if (!conv) return item;
    return {
      ...item,
      lastMessage: conv.lastMessage || item.lastMessage,
      time: conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : item.time,
      unread: conv.unreadCount || 0,
    };
  };
  const enrichedGroups    = dbGroups.map(g => enrich(g, `group:${g.id}`));
  const enrichedSubGroups = dbSubGroups.map(sg => enrich(sg, `subgroup:${sg.id}`));

  // Chat list = conversations I actually have (people I've talked to), not all users
  const directChats = conversations
    .filter(c => c.chatId.startsWith('dm:'))
    .map(c => {
      const [, a, b] = c.chatId.split(':').map(Number);
      const otherId = me && a === me.id ? b : a;
      const contact = dbContacts.find(u => u.userId === otherId);
      return {
        id: c.chatId,
        type: 'direct',
        userId: otherId,
        name: contact?.name || `User ${otherId}`,
        username: contact?.username,
        lastMessage: c.lastMessage || '',
        time: c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        unread: c.unreadCount || 0,
      };
    });

  // All registered users, openable as a DM — surfaced only through search
  const searchableContacts = me
    ? dbContacts.map(u => ({ ...u, id: dmChatId(me.id, u.userId), type: 'direct' }))
    : [];

  async function handleDeleteChat(chat) {
    if (chat.type !== 'direct') return;
    try {
      await api.deleteConversation(chat.id);
      setConversations(prev => prev.filter(c => c.chatId !== chat.id));
      setSelectedChat(null);
    } catch (e) {
      console.error('deleteConversation failed', e);
      window.alert(e.message || 'Could not delete chat');
    }
  }

  async function handleSignOut() {
    try { await api.logout(); } catch (_) {}
    setDbGroups([]);
    setDbSubGroups([]);
    setDbContacts([]);
    setConversations([]);
    setMe(null);
    setSelectedChat(null);
    setShowSettings(false);
    setShowOAuth(true);
  }

  async function handleGroupCreated(newGroup) {
    setDbGroups(prev => [newGroup, ...prev]);
    setSelectedChat(newGroup);
  }

  function handleExitGroup(chat) {
    if (chat.type === 'group') {
      setDbGroups(prev => prev.filter(g => g.id !== chat.id));
      setDbSubGroups(prev => prev.filter(sg => (sg.groupId ?? sg.parentGroupId) !== chat.id));
    } else if (chat.type === 'subgroup') {
      setDbSubGroups(prev => prev.filter(sg => sg.id !== chat.id));
      setDbGroups(prev => prev.map(g =>
        g.id === (chat.groupId ?? chat.parentGroupId)
          ? { ...g, subGroups: (g.subGroups || []).filter(sg => sg.id !== chat.id) }
          : g
      ));
    }
    setSelectedChat(null);
  }

  async function handleSubGroupCreated(newSg) {
    const shaped = { ...newSg, type: 'subgroup', isGroup: true, lastMessage: '', time: '' };
    setDbSubGroups(prev => [...prev, shaped]);
    setDbGroups(prev => prev.map(g =>
      g.id === newSg.groupId ? { ...g, subGroups: [...(g.subGroups || []), shaped] } : g
    ));
  }

  function handleOpenSubGroup(sg) {
    if (!sg) return;
    if (sg.type === 'subgroup') {
      const found = dbSubGroups.find(s => s.id === sg.id) || sg;
      setSelectedChat(found);
    } else if (sg.type === 'group') {
      setSelectedChat(sg);
    }
  }

  if (!authChecked) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f172a' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #334155', borderTopColor: '#4a9eff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  return (
    <React.Fragment>
      {showLanding && (
        <LandingPage onEnter={() => { setShowLanding(false); setShowOAuth(true); }} />
      )}
      <OAuthPage visible={!showLanding && showOAuth} error={authError} />
      {showSettings && <SettingsPage onClose={() => setShowSettings(false)} onSignOut={handleSignOut} darkMode={darkMode} onToggleDark={() => setDarkMode(d => !d)} me={me} onUpdateMe={updated => setMe(updated)} />}
      <div className="app-container">
        <div className="left-nav">

          {/* Top icons */}
          <NavIcon active title="Chats">
            <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
            </svg>
          </NavIcon>
          <NavIcon title="Stories">
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
              <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
            </svg>
          </NavIcon>
          <NavIcon title="Calendar">
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
          </NavIcon>
          <NavIcon title="Calls">
            <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
            </svg>
          </NavIcon>
          <NavIcon title="Favorites">
            <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
            </svg>
          </NavIcon>

          <div className="nav-spacer" />

          {/* AI Logo — bottom, opens Arattai AI chat */}
          <button
            className="nav-ai-btn"
            title="Arattai AI"
            onClick={() => setSelectedChat(AI_CHAT)}
          >
            <img src={aiLogo} alt="Arattai AI" className="nav-ai-img" />
          </button>

          {/* Hamburger menu */}
          <div style={{ position: 'relative' }}>
            <button className="nav-icon" title="Menu" onClick={() => setShowHamburger(o => !o)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="4" y1="8" x2="20" y2="8"/>
                <line x1="4" y1="14" x2="20" y2="14"/>
              </svg>
            </button>
            {showHamburger && (
              <HamburgerMenu
                onClose={() => setShowHamburger(false)}
                onSettings={() => setShowSettings(true)}
                darkMode={darkMode}
                onToggleDark={() => setDarkMode(d => !d)}
              />
            )}
          </div>

          {/* User avatar */}
          <div className="user-avatar-nav" onClick={() => setShowSettings(true)} style={{ cursor: 'pointer' }}>{me?.name?.[0]?.toUpperCase() || '?'}</div>
        </div>

        <Sidebar
          selected={selectedChat}
          onSelect={setSelectedChat}
          groups={enrichedGroups}
          subGroups={enrichedSubGroups}
          directChats={directChats}
          contacts={searchableContacts}
          onGroupCreated={handleGroupCreated}
        />

        <ChatArea
          chat={selectedChat}
          allSubGroups={enrichedSubGroups}
          groups={enrichedGroups}
          contacts={dbContacts}
          me={me}
          incoming={incoming}
          typing={typingEvt}
          presence={presence}
          onDeleteChat={handleDeleteChat}
          onStartCall={(target, media) => setOutgoingCall({ targetId: target.userId, name: target.name, media, at: Date.now() })}
          onMessageSent={() => setTimeout(fetchConversations, 2000)}
          onSubGroupCreated={handleSubGroupCreated}
          onOpenSubGroup={handleOpenSubGroup}
          onExitGroup={handleExitGroup}
          onClose={() => setSelectedChat(null)}
        />
      </div>
      {inChat && (
        <CallOverlay
          me={me}
          contacts={dbContacts}
          callEvt={callEvt}
          outgoing={outgoingCall}
          onOutgoingConsumed={() => setOutgoingCall(null)}
        />
      )}
    </React.Fragment>
  );
}

function NavIcon({ children, active, title }) {
  return (
    <button className={`nav-icon${active ? ' nav-icon-active' : ''}`} title={title}>
      {children}
    </button>
  );
}
