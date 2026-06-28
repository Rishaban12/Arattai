import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import LandingPage from './components/LandingPage';
import SettingsPage from './components/SettingsPage';
import HamburgerMenu from './components/HamburgerMenu';
import aiLogo from './data/ai-logo.png';
import { groups, subGroups as initialSubGroups } from './data/mockData';

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
  const [showLanding, setShowLanding] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showHamburger, setShowHamburger] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [selectedChat, setSelectedChat] = useState(groups[0]);

  useEffect(() => {
    document.body.classList.toggle('light', !darkMode);
  }, [darkMode]);
  const [dynamicSubGroups, setDynamicSubGroups] = useState(initialSubGroups);

  function handleSubGroupCreated(newSg) {
    setDynamicSubGroups(prev => [...prev, newSg]);
    const parentGroup = groups.find(g => g.id === newSg.parentGroupId);
    if (parentGroup) {
      parentGroup.subGroups = [...(parentGroup.subGroups || []), newSg.id];
    }
  }

  function handleOpenSubGroup(sg) {
    if (!sg) return;
    if (sg.type === 'subgroup') {
      const found = dynamicSubGroups.find(s => s.id === sg.id) || sg;
      setSelectedChat(found);
    } else if (sg.type === 'group') {
      setSelectedChat(sg);
    }
  }

  return (
    <React.Fragment>
      {showLanding && <LandingPage onEnter={() => setShowLanding(false)} />}
      {showSettings && <SettingsPage onClose={() => setShowSettings(false)} />}
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
          <div className="user-avatar-nav" onClick={() => setShowSettings(true)} style={{ cursor: 'pointer' }}>R</div>
        </div>

        <Sidebar selected={selectedChat} onSelect={setSelectedChat} />


        <ChatArea
          chat={selectedChat}
          allSubGroups={dynamicSubGroups}
          onSubGroupCreated={handleSubGroupCreated}
          onOpenSubGroup={handleOpenSubGroup}
          onClose={() => setSelectedChat(null)}
        />
      </div>
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
