# Arattai Chat App — React Frontend

A modern dark-themed chat application UI built with React, designed to integrate with a Java Servlet backend.

---

## Tech Stack

- **React 19** — UI framework
- **react-scripts** — Build tooling (CRA)
- **Pure CSS** — No external UI libraries
- **Java Servlets** — Backend (separate, not included here)

---

## Project Structure

```
src/
├── components/
│   ├── Avatar.js              # User/group avatar with initials
│   ├── ChatArea.js            # Main chat window (messages, header, input)
│   ├── Sidebar.js             # Left chat list panel
│   ├── LandingPage.js         # Splash screen with logo animation
│   ├── SettingsPage.js        # Settings modal (Profile, Appearance, etc.)
│   ├── HamburgerMenu.js       # Bottom-left hamburger dropdown
│   ├── PlusMenu.js            # + button dropdown (New message/group/channel)
│   ├── NewGroupDialog.js      # Create new group dialog
│   ├── SubGroupModal.js       # SubGroups list modal
│   ├── CreateSubGroupDialog.js # Create subgroup dialog
│   └── AddParticipantsDialog.js # Add participants dialog
├── data/
│   ├── mockData.js            # Sample chats, groups, subgroups, messages
│   ├── logo.png               # Arattai app logo
│   └── ai-logo.png            # Arattai AI logo
├── App.js                     # Root component, routing, state
├── App.css                    # All styles (dark + light theme)
└── index.js                   # React entry point
public/
├── index.html
└── logo.png                   # Favicon
```

---

## Features

| Feature | Description |
|---|---|
| Landing page | Logo zoom-in/out animation, auto-transitions to app |
| Sidebar | Chat list with tabs: Chats, Channels, Direct, Groups, SubGroups |
| Chat tabs | Filters list by type (direct / group / subgroup) |
| Message area | Bubbles, link previews, unread bar, date separators, system messages |
| Search | Click search icon → inline search bar below header with ↑↓ navigation |
| SubGroups | Create subgroups from group menu → bell icon shows subgroup panel |
| Bell panel | Groups show their subgroups; subgroups show main group + siblings |
| Arattai AI | Dedicated AI chat — logo spins on new messages, no call/search/dots icons |
| New Group | + button → New group dialog → Add participants → group created |
| Settings | Click avatar (R) → Profile, Appearance, Security, Calls, Notifications |
| Hamburger | Contacts, Settings shortcut, Dark/Light mode toggle |
| Dark/Light mode | Full theme switch via hamburger toggle |
| Call icons | Phone + video icons shown only for direct (non-group, non-AI) chats |

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Install & Run

```bash
cd /home/rishaban/Documents/Arattai
npm install
npm start
```

Opens at **http://localhost:3000**

### Production Build

```bash
npm run build
```

Outputs to `build/` — copy contents into your Java web app's `webapp/` or `static/` directory.

---

## Color Tokens

| Token | Hex | Usage |
|---|---|---|
| bg-main | `#1D1D1D` | Chat area background |
| bg-panel | `#2B2B2B` | Message bubbles, cards |
| bg-side | `#202020` | Sidebar |
| bg-input | `#2A2A2A` | Input box |
| bg-nav | `#181818` | Top nav / header |
| border | `#3A3A3A` | Dividers |
| accent | `#4493f8` | Buttons, links, badges |
| amber | `#D29922` | Unread messages bar |

---

## Backend Integration

This is a **frontend-only** React app. To connect with the Java Servlet backend:

1. Run `npm run build`
2. Deploy the `build/` folder inside your servlet project
3. Replace mock data in `src/data/mockData.js` with real API calls (`fetch`/`axios`)
4. Wire WebSocket or polling for real-time messages

---

## License

MIT
