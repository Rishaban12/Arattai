# Arattai Chat App — React Frontend

A dark-themed real-time chat UI built with React, designed to integrate with a Java (Jakarta) backend over REST + WebSocket.

---

## Tech Stack

- **React 19** — UI framework
- **Build tooling** — Vite (recommended). The current setup uses `react-scripts` (Create React App), which is **deprecated and not officially compatible with React 19**. See [Migration](#migrating-off-cra) below.
- **Pure CSS** — no external UI library
- **Backend** — Java / Jakarta Servlets + WebSocket (separate repo, not included here)

---

## Project Structure

```
src/
├── components/
│   ├── Avatar.js                # User/group avatar with initials
│   ├── ChatArea.js              # Main chat window (messages, header, input)
│   ├── Sidebar.js               # Left chat list panel
│   ├── LandingPage.js           # Splash screen with logo animation
│   ├── SettingsPage.js          # Settings modal (Profile, Appearance, etc.)
│   ├── HamburgerMenu.js         # Bottom-left hamburger dropdown
│   ├── PlusMenu.js              # + button dropdown (New message/group/channel)
│   ├── NewGroupDialog.js        # Create new group dialog
│   ├── SubGroupModal.js         # SubGroups list modal
│   ├── CreateSubGroupDialog.js  # Create subgroup dialog
│   └── AddParticipantsDialog.js # Add participants dialog
├── data/
│   ├── mockData.js              # Sample chats, groups, subgroups, messages
│   ├── logo.png                 # Arattai app logo
│   └── ai-logo.png              # Arattai AI logo
├── lib/
│   ├── api.js                   # REST client (reads API base from env)
│   └── socket.js                # WebSocket client (connect, auth, reconnect)
├── App.js                       # Root component, routing, state
├── App.css                      # All styles (dark + light theme)
└── index.js                     # React entry point
public/
├── index.html
└── logo.png                     # Favicon
.env.example                     # Copy to .env.local and fill in
LICENSE                          # MIT
```

> `lib/api.js` and `lib/socket.js` are the integration seams. Until the backend is ready, they fall back to `data/mockData.js`.

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
# from the project root
cp .env.example .env.local      # then edit values
npm install
npm start                       # http://localhost:3000
```

### Production Build

```bash
npm run build                   # outputs to build/ (CRA) or dist/ (Vite)
```

Copy the build output into your Java web app's `webapp/` or `static/` directory.

---

## Configuration

All backend endpoints are read from environment variables — nothing is hardcoded. Copy `.env.example`:

```bash
# .env.example
REACT_APP_API_BASE_URL=http://localhost:8080/api
REACT_APP_WS_URL=ws://localhost:8080/ws
REACT_APP_USE_MOCKS=true        # set false once the backend is live
```

> CRA exposes only vars prefixed `REACT_APP_`. On Vite, switch the prefix to `VITE_` and read via `import.meta.env`.

---

## Backend Integration

This is a frontend-only app. Wiring it to the Java backend:

1. Set `REACT_APP_USE_MOCKS=false` and point the two URLs at your backend.
2. **REST** (`lib/api.js`) for non-realtime calls: login, group/subgroup CRUD, history paging. Attach the auth token (`Authorization: Bearer <jwt>`) to every request.
3. **WebSocket** (`lib/socket.js`) for realtime:
   - Open the socket *after* login; pass a short-lived token in the connect query (`?token=...`) or the first frame — cookies are unreliable coss-origin.
   - **Optimistic send:** generate a `client_msg_id` (UUID) per outgoing message, render it locally as "sending", then reconcile when the server echoes the same `client_msg_id`. This also makes the backend's idempotency/dedup work.
   - **Reconnect:** exponential backoff; on reconnect, re-fetch messages newer than the last known `message_id` to fill gaps.
   - **Presence/typing:** send a heartbeat every ~20s so server-side TTL keys don't mark you offline.
4. **State management:** with live sockets, lift chat/message state out of component state. Use React Context for small scale, or Zustand/Redux as message volume grows — components subscribe to the store, the socket layer writes to it.

---

## Migrating off CRA

`react-scripts` is in maintenance and unsupported on React 19; expect breakage on dependency upgrades. Recommended path is Vite:

1. `npm create vite@latest` (React + JS/TS template), copy `src/` and `public/` across.
2. Move `index.html` to project root, add `<script type="module" src="/src/index.js">`.
3. Rename env vars `REACT_APP_*` → `VITE_*`, read via `import.meta.env`.
4. Replace `react-scripts` scripts with `vite` / `vite build` / `vite preview`.

---

## Testing

```bash
npm test                        # add Vitest + React Testing Library
```

Suggested coverage: tab filtering logic, message reconciliation by `client_msg_id`, socket reconnect/backoff, theme toggle persistence.

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

## License

MIT — see [LICENSE](./LICENSE).