# Design System AgentFlow

Ce document formalise notre design system Tailwind, adapté aux besoins de nos utilisateurs.

## 1. Personas

- **Anne Dupont** (Assistante administrative)
  - Objectifs : rationaliser la saisie des factures, automatiser relances & reporting
  - Pain points : saisie manuelle chronophage, suivi dispersé

- **Jean Martin** (DSI PME)
  - Objectifs : sécuriser flux, garantir RGPD/SLA, centraliser connecteurs
  - Pain points : complexité technique, manque de ressources

- **Claire Leroy** (Directrice financière)
  - Objectifs : consolidation données comptables, visibilité trésorerie temps réel
  - Pain points : données éclatées, délais de reporting long

## 2. Principes de design

1. **Clarté & simplicité** : interface épurée, actions explicites.
2. **Cohérence** : mêmes styles, mêmes components ; charte couleur stable.
3. **Accessibilité** : contrastes suffisants, labels clairs, navigation clavier.
4. **Adapté au métier** : termes simples, focus sur reporting et alertes.

## 3. Design Tokens (tailwind.config.js)

### Couleurs
```js
colors: {
  primary: '#2563EB',   // bleu
  secondary: '#64748B', // gris foncé
  success: '#16A34A',   // vert
  warning: '#F59E0B',   // orange
  danger:  '#DC2626',   // rouge
  neutral: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
}
```

### Espacements (px)
```js
spacing: {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '32px',
  8: '40px',
}
```

### Typographie
```js
fontSize: {
  xs: ['12px', '16px'],
  sm: ['14px', '20px'],
  base: ['16px', '24px'],
  lg: ['18px', '28px'],
  xl: ['20px', '28px'],
  '2xl': ['24px', '32px'],
}
```

### Breakpoints
```js
screens: {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
}
```

## 4. Components

- **Button** : `bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-600`.
- **Input** : `border border-neutral-300 px-3 py-2 rounded-md focus:ring-primary`.
- **Card** : `bg-white shadow-sm rounded-lg p-4`.
- **DateRangePicker** : input group simple avec calendrier.
- **Chart** : fond clair, axes neutres, ligne `primary`.

> Les components doivent toujours respecter les tokens ci-dessus.

---
Révisions futures :
- Ajout mode dark
- Composants avancés (Table, Modal)
