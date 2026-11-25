/**
 * Navigation route metadata shared between desktop topbar and mobile drawer.
 */

export const PRIMARY_NAV_ITEMS = [
  { id: 'dashboard', path: '/dashboard', label: 'דאשבורד פיננסי' },
  { id: 'review', path: '/review', label: 'בקרת חשבוניות' },
  { id: 'sandbox', path: '/sandbox', label: 'טסטר חילוץ' },
];

export const SECONDARY_NAV_ITEMS = [
  {
    id: 'prompts',
    path: '/prompts',
    label: 'ניהול פרומפטים',
    description: 'עריכה ובדיקת פרומפטים של מנוע החילוץ',
  },
  {
    id: 'regression',
    path: '/regression',
    label: 'בדיקות רגרסיה',
    description: 'מבחני דיוק ומדדי איכות על פני גרסאות',
  },
  {
    id: 'labeling',
    path: '/labeling',
    label: 'תיוג מסמכים',
    description: 'בניית מאגר מסמכים מוזהב (Golden Dataset)',
  },
];

export const ADMIN_NAV_ITEM = {
  id: 'admin-users',
  path: '/admin/users',
  label: 'ניהול משתמשים',
  description: 'אישור משתמשים חדשים וניהול הרשאות מנהל',
};

export const MENU_ANIMATION_SPEED_MS = 350;
