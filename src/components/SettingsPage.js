import React, { useState } from 'react';

const menuItems = [
  { key: 'profile', label: 'Profile', icon: <ProfileIcon /> },
  { key: 'appearance', label: 'Appearance', icon: <AppearanceIcon /> },
  { key: 'security', label: 'Security & privacy', icon: <SecurityIcon /> },
  { key: 'calls', label: 'Calls & meetings', icon: <CallsIcon /> },
  { key: 'notifications', label: 'Notifications', icon: <BellIcon /> },
];

export default function SettingsPage({ onClose }) {
  const [active, setActive] = useState('profile');
  const [name, setName] = useState('Rishaban');
  const [bio, setBio] = useState("Hello! I'm using Arattai");

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
          <button className="settings-menu-item settings-signout">
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
                  <label className="settings-field-label">Bio <span className="required-star">*</span></label>
                  <textarea
                    className="settings-textarea"
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    rows={3}
                  />
                </div>
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

          {active === 'appearance' && (
            <div className="settings-placeholder">
              <div className="settings-section-title">Appearance</div>
              <div className="settings-card settings-card-plain">
                <span style={{ color: '#9E9E9E', fontSize: 14 }}>Theme and display settings coming soon.</span>
              </div>
            </div>
          )}

          {active === 'security' && (
            <div className="settings-placeholder">
              <div className="settings-section-title">Security & Privacy</div>
              <div className="settings-card settings-card-plain">
                <span style={{ color: '#9E9E9E', fontSize: 14 }}>Security settings coming soon.</span>
              </div>
            </div>
          )}

          {active === 'calls' && (
            <div className="settings-placeholder">
              <div className="settings-section-title">Calls & Meetings</div>
              <div className="settings-card settings-card-plain">
                <span style={{ color: '#9E9E9E', fontSize: 14 }}>Call settings coming soon.</span>
              </div>
            </div>
          )}

          {active === 'notifications' && (
            <div className="settings-placeholder">
              <div className="settings-section-title">Notifications</div>
              <div className="settings-card settings-card-plain">
                <span style={{ color: '#9E9E9E', fontSize: 14 }}>Notification settings coming soon.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
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
