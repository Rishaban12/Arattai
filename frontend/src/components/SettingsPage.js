import React, { useState } from 'react';
import { api } from '../lib/api';

const menuItems = [
  { key: 'profile', label: 'Profile', icon: <ProfileIcon /> },
  { key: 'appearance', label: 'Appearance', icon: <AppearanceIcon /> },
  { key: 'security', label: 'Security & privacy', icon: <SecurityIcon /> },
  { key: 'calls', label: 'Calls & meetings', icon: <CallsIcon /> },
  { key: 'notifications', label: 'Notifications', icon: <BellIcon /> },
];

export default function SettingsPage({ onClose, onSignOut, darkMode, onToggleDark, me, onUpdateMe }) {
  const [active, setActive] = useState('profile');
  const [name, setName] = useState(me?.name || '');
  const [bio, setBio] = useState("Hello! I'm using Arattai");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setSaveError('');
    try {
      const updated = await api.updateMe(name.trim());
      onUpdateMe && onUpdateMe(updated);
    } catch (e) {
      setSaveError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-container" onClick={e => e.stopPropagation()}>

        {/* Left sidebar */}
        <div className="settings-sidebar">
          <div className="settings-title">Settings</div>
          {menuItems.map(item => (
            <button
              key={item.key}
              className={`settings-menu-item${active === item.key ? ' active' : ''}`}
              onClick={() => setActive(item.key)}
            >
              <span className="settings-menu-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
          <button className="settings-menu-item settings-signout" onClick={onSignOut}>
            <span className="settings-menu-icon"><SignOutIcon /></span>
            Sign Out
          </button>
        </div>

        {/* Right content */}
        <div className="settings-content">
          {active === 'profile' && (
            <>
              <div className="settings-section-title">Personal info</div>
              <div className="settings-card">
                <div className="settings-avatar-wrap">
                  <div className="settings-avatar">
                    <span>R</span>
                    <button className="settings-avatar-camera"><CameraIcon /></button>
                  </div>
                </div>
                <div className="settings-field">
                  <label className="settings-field-label">Name <span className="required-star">*</span></label>
                  <input
                    className="settings-input"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
                <div className="settings-field">
                  <label className="settings-field-label">Bio</label>
                  <textarea
                    className="settings-textarea"
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    rows={3}
                  />
                </div>
                {saveError && <div className="settings-save-error">{saveError}</div>}
                <button
                  className="settings-save-btn"
                  onClick={handleSave}
                  disabled={saving || !name.trim()}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>

              <div className="settings-section-title">Phone number</div>
              <div className="settings-card settings-card-plain">
                <span className="settings-phone">+91 63833 89545</span>
              </div>

              <div className="settings-section-title">Username</div>
              <div className="settings-card settings-card-plain settings-username-row">
                <span className="settings-at-icon">@</span>
                <span className="settings-username-text">
                  Create a username so others can find you on Arattai without your phone number.
                </span>
                <button className="settings-create-username">Create username</button>
              </div>
            </>
          )}

          {active === 'appearance' && <AppearanceSection darkMode={darkMode} onToggleDark={onToggleDark} />}
          {active === 'security' && <SecuritySection />}
          {active === 'calls' && <CallsSection />}
          {active === 'notifications' && <NotificationsSection />}
        </div>
      </div>
    </div>
  );
}

function SettingsToggle({ on, onToggle }) {
  return (
    <button className={`hm-toggle${on ? ' on' : ''}`} onClick={onToggle} style={{ flexShrink: 0 }}>
      <span className="hm-toggle-thumb" />
    </button>
  );
}

function SettingsRow({ label, sublabel, children }) {
  return (
    <div className="settings-row">
      <div className="settings-row-text">
        <div className="settings-row-label">{label}</div>
        {sublabel && <div className="settings-row-sub">{sublabel}</div>}
      </div>
      {children}
    </div>
  );
}

function AppearanceSection({ darkMode, onToggleDark }) {
  const [fontSize, setFontSize] = useState('medium');
  return (
    <>
      <div className="settings-section-title">Theme</div>
      <div className="settings-card">
        <SettingsRow label="Dark Mode" sublabel="Switch between dark and light theme">
          <SettingsToggle on={darkMode} onToggle={onToggleDark} />
        </SettingsRow>
      </div>
      <div className="settings-section-title">Text Size</div>
      <div className="settings-card">
        {['small', 'medium', 'large'].map(size => (
          <SettingsRow key={size} label={size.charAt(0).toUpperCase() + size.slice(1)}>
            <input
              type="radio"
              name="fontSize"
              checked={fontSize === size}
              onChange={() => setFontSize(size)}
              style={{ accentColor: '#4493f8', width: 16, height: 16 }}
            />
          </SettingsRow>
        ))}
      </div>
    </>
  );
}

function SecuritySection() {
  const [twoFactor, setTwoFactor] = useState(false);
  const [readReceipts, setReadReceipts] = useState(true);
  const [lastSeen, setLastSeen] = useState(true);
  return (
    <>
      <div className="settings-section-title">Security</div>
      <div className="settings-card">
        <SettingsRow label="Two-Factor Authentication" sublabel="Add extra security to your account">
          <SettingsToggle on={twoFactor} onToggle={() => setTwoFactor(o => !o)} />
        </SettingsRow>
      </div>
      <div className="settings-section-title">Privacy</div>
      <div className="settings-card">
        <SettingsRow label="Read Receipts" sublabel="Show when you've read messages">
          <SettingsToggle on={readReceipts} onToggle={() => setReadReceipts(o => !o)} />
        </SettingsRow>
        <SettingsRow label="Last Seen" sublabel="Show when you were last active">
          <SettingsToggle on={lastSeen} onToggle={() => setLastSeen(o => !o)} />
        </SettingsRow>
      </div>
      <div className="settings-section-title">Active Sessions</div>
      <div className="settings-card settings-card-plain">
        <div style={{ fontSize: 14, color: '#E8E8E8' }}>Chrome on Linux — Active now</div>
        <div style={{ fontSize: 12, color: '#666666', marginTop: 4 }}>This device</div>
      </div>
    </>
  );
}

function CallsSection() {
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [hd, setHd] = useState(false);
  return (
    <>
      <div className="settings-section-title">Audio</div>
      <div className="settings-card">
        <SettingsRow label="Noise Suppression" sublabel="Reduce background noise during calls">
          <SettingsToggle on={noiseSuppression} onToggle={() => setNoiseSuppression(o => !o)} />
        </SettingsRow>
      </div>
      <div className="settings-section-title">Video</div>
      <div className="settings-card">
        <SettingsRow label="HD Video" sublabel="Higher quality, uses more data">
          <SettingsToggle on={hd} onToggle={() => setHd(o => !o)} />
        </SettingsRow>
      </div>
    </>
  );
}

function NotificationsSection() {
  const [messages, setMessages] = useState(true);
  const [groups, setGroups] = useState(true);
  const [mentions, setMentions] = useState(true);
  const [sound, setSound] = useState(true);
  const [preview, setPreview] = useState(true);
  return (
    <>
      <div className="settings-section-title">Notify me about</div>
      <div className="settings-card">
        <SettingsRow label="Messages" sublabel="Direct message notifications">
          <SettingsToggle on={messages} onToggle={() => setMessages(o => !o)} />
        </SettingsRow>
        <SettingsRow label="Groups" sublabel="Group message notifications">
          <SettingsToggle on={groups} onToggle={() => setGroups(o => !o)} />
        </SettingsRow>
        <SettingsRow label="Mentions" sublabel="When someone @mentions you">
          <SettingsToggle on={mentions} onToggle={() => setMentions(o => !o)} />
        </SettingsRow>
      </div>
      <div className="settings-section-title">Notification Style</div>
      <div className="settings-card">
        <SettingsRow label="Sound" sublabel="Play sound for new notifications">
          <SettingsToggle on={sound} onToggle={() => setSound(o => !o)} />
        </SettingsRow>
        <SettingsRow label="Message Preview" sublabel="Show message content in notification">
          <SettingsToggle on={preview} onToggle={() => setPreview(o => !o)} />
        </SettingsRow>
      </div>
    </>
  );
}

function ProfileIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>;
}
function AppearanceIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a9 9 0 1 0 0 18A9 9 0 0 0 12 3zm0 16a7 7 0 1 1 0-14 7 7 0 0 1 0 14zm-1-11h2v6h-2zm0 8h2v2h-2z"/></svg>;
}
function SecurityIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>;
}
function CallsIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>;
}
function BellIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>;
}
function SignOutIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>;
}
function CameraIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 15.2A3.2 3.2 0 1 1 12 8.8a3.2 3.2 0 0 1 0 6.4zM9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9z"/></svg>;
}
