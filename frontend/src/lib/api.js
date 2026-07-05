const BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    // credentials: 'include' sends HttpOnly cookies on every request
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let message = `API error ${res.status}`;
    try {
      const data = await res.json();
      if (data && data.error) message = data.error;
    } catch (_) { /* body not JSON */ }
    throw new Error(message);
  }
  return res.json();
}

export const api = {
  // ── Auth (cookies managed by the browser — no token storage in JS) ────────
  login: (email, password) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),
  signup: (name, username, email, password) => request('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name, username, email, password }),
  }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  refreshSession: () => request('/auth/refresh', { method: 'POST' }),
  getMe: () => request('/users/me'),
  getPresence: (userId) => request(`/presence/${userId}`),

  // ── Chat ─────────────────────────────────────────────────────────────────
  getConversations: () => request('/conversations'),
  deleteConversation: (chatId) => request(`/conversations/${encodeURIComponent(chatId)}`, { method: 'DELETE' }),
  getMessages: (chatId) => request(`/chats/${chatId}/messages`),
  sendMessage: (chatId, text) => request(`/chats/${chatId}/messages`, { method: 'POST', body: JSON.stringify({ text }) }),
  getGroups: () => request('/groups'),
  getSubGroups: (groupId) => request(`/groups/${groupId}/subgroups`),
  createGroup: (data) => request('/groups', { method: 'POST', body: JSON.stringify(data) }),
  createSubGroup: (groupId, data) => request(`/groups/${groupId}/subgroups`, { method: 'POST', body: JSON.stringify(data) }),
  getGroupMembers: (groupId) => request(`/groups/${groupId}/members`),
  addGroupMember: (groupId, userId, role = 'member') => request(`/groups/${groupId}/members`, { method: 'POST', body: JSON.stringify({ userId, role }) }),
  addSubGroupMember: (subGroupId, userId) => request(`/subgroups/${subGroupId}/members`, { method: 'POST', body: JSON.stringify({ userId }) }),
  getContacts: () => request('/contacts'),

  // AI endpoints always use relative paths so the dev-server proxy (setupProxy.js)
  // can intercept them when the Java backend is not running.

  // messages = [{ role: 'user'|'assistant', content: string }, ...]
  sendAiMessage: async (messages) => {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
    if (!res.ok) throw new Error('AI error ' + res.status);
    const data = await res.json();
    return data.reply;
  },

  // text: string, mode: 'polish'|'summarize'|'formal'|'casual'|'translate'|'fixCode'|'shorten'|'expand'
  transformMessage: async (text, mode) => {
    const res = await fetch('/api/ai/transform', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, mode }),
    });
    if (!res.ok) throw new Error('Transform error ' + res.status);
    const data = await res.json();
    return data.result;
  },
};
