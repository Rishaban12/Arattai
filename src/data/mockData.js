export const contacts = [
  {
    id: 'c1', name: 'Tamilselvan', avatar: null, type: 'direct',
    lastMessage: 'github.odt', time: 'Yesterday', verified: true,
    previewMeta: { you: true, fileType: 'doc' },
  },
  {
    id: 'c2', name: 'Pocket', avatar: null, type: 'direct',
    lastMessage: 'Ather340Teardown_Guide1.docx', time: 'Yesterday',
    previewMeta: { fileType: 'doc' },
  },
  {
    id: 'c3', name: 'Jeni', avatar: null, type: 'direct',
    lastMessage: 'Charge port', time: 'Yesterday', verified: true,
    previewMeta: { fileType: 'image' },
  },
  {
    id: 'c4', name: 'Tamil', avatar: null, type: 'direct',
    lastMessage: 'atma.zip', time: 'June 18', verified: true,
    previewMeta: { you: true, fileType: 'zip' },
  },
  {
    id: 'c5', name: 'Nadi', avatar: null, type: 'direct',
    lastMessage: '', time: 'May 25', verified: true,
    previewMeta: {},
  },
  {
    id: 'c6', name: 'Tamilselvi Zoho', avatar: null, type: 'direct',
    lastMessage: '', time: 'May 20', verified: true,
    previewMeta: {},
  },
];

export const groups = [
  {
    id: 'g1',
    name: 'Velaikku poda',
    avatar: null,
    participants: 56,
    lastMessage: 'https://docs.google.com/for...',
    time: 'Yesterday',
    unread: 2,
    type: 'group',
    subGroups: ['sg1', 'sg2'],
    previewMeta: { sender: 'Vijayapriya V' },
    messages: [
      {
        id: 'm1',
        sender: 'Someone',
        text: 'welcome/2219eda1-aabf-494e-88de-cabec4f8ada9?utm_source=sp_auto_dm&utm_referrer=sp_auto_dm&fbclid=PAVERTVgSI1PJleHRuA2FlbQIxMABzcnRjBmFwcF9pZA81NjcwNjczNDMzNTI0MjcAAaeK8c5oGbYhca5BDXe_rp0I4naqgpZJxDOEAK989LjVGt9v_4Mu63M6bmYzxA_aem_pFTFPQhqsyGu_NOdL8z7Xg',
        time: '10:15 AM',
        isLink: true,
        linkPreview: {
          title: 'TestGorilla',
          domain: 'app.testgorilla.com',
          icon: 'T',
        },
      },
      { id: 'm_unread', isUnreadBar: true, text: '2 unread messages' },
      {
        id: 'm2',
        sender: 'Kalai',
        text: '',
        time: '12:54 PM',
        linkPreview: {
          title: 'Custom Software Engineer',
          desc: 'Learn more about applying for Custom Software Engineer position at Accenture.',
          domain: 'accenture.com',
          icon: '>',
          iconBg: '#a855f7',
        },
      },
      {
        id: 'm3',
        sender: 'Vijayapriya V',
        forwardedBy: 'Vijayapriya V',
        text: 'https://docs.google.com/forms/d/e/1FAIpQLSdZpxH4IKW6uVSTPYsPSCLuXEa4VUQ5tWflo3PioQbwVlacag/formResponse',
        time: '06:32 PM',
        isLink: true,
      },
    ],
  },
  {
    id: 'g2',
    name: '22 projects',
    avatar: null,
    participants: 22,
    lastMessage: 'Image',
    time: 'June 17',
    unread: 0,
    type: 'group',
    subGroups: [],
    previewMeta: { sender: 'Venkatesh', fileType: 'image' },
    messages: [],
  },
];

export const subGroups = [
  {
    id: 'sg1',
    name: 'My SubGroup 1',
    parentGroupId: 'g1',
    participants: 2,
    avatar: null,
    type: 'subgroup',
    messages: [
      { id: 'sm1', sender: '__system__', text: 'You have created this subgroup', time: '', isSystem: true, dateLabel: 'Monday, May 11' },
      { id: 'sm2', sender: '__system__', text: 'Tamilsetvi joined via invite link', time: '', isSystem: true, isLink: true },
    ],
    otherSubGroups: ['sg2'],
  },
  {
    id: 'sg2',
    name: 'My SubGroup 2',
    parentGroupId: 'g1',
    participants: 2,
    avatar: null,
    type: 'subgroup',
    messages: [
      { id: 'sm3', sender: '__system__', text: 'You have created this subgroup', time: '', isSystem: true, dateLabel: 'Monday, May 11' },
      { id: 'sm4', sender: '__system__', text: 'Tamilsetvi joined via invite link', time: '', isSystem: true, isLink: true },
    ],
    otherSubGroups: ['sg1'],
  },
];

export const groupMembersForAdd = [
  { id: 'u1', name: 'Tamilselvi', avatar: null },
  { id: 'u2', name: 'Haritha', avatar: null },
  { id: 'u3', name: 'Tamilselvan', avatar: null },
  { id: 'u4', name: 'Harish', avatar: null },
  { id: 'u5', name: 'Asick', avatar: null },
  { id: 'u6', name: 'Sandy', avatar: null },
];

export const senderColors = {
  Asick: '#f87171',
  Rishab: '#fb923c',
  Tamilselvan: '#facc15',
  Harish: '#4ade80',
  Tamilselvi: '#60a5fa',
  'Indu san': '#c084fc',
  Haritha: '#34d399',
  Kalai: '#fb923c',
  'Vijayapriya V': '#818cf8',
  Someone: '#94a3b8',
};

export function getSenderColor(name) {
  if (senderColors[name]) return senderColors[name];
  const colors = ['#f87171','#fb923c','#facc15','#4ade80','#60a5fa','#c084fc','#34d399','#f472b6'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function getInitial(name) {
  return name ? name.charAt(0).toUpperCase() : '?';
}

export function getAvatarColor(name) {
  const colors = ['#2563eb','#7c3aed','#db2777','#0891b2','#059669','#d97706','#dc2626','#9333ea'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
