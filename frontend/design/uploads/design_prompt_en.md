# HanGaRo — UI Design Prompt

---

## Service Overview

**HanGaRo** is a real-time tourism congestion-based travel route recommendation web/app service.
The name means "Walk the quiet path" in Korean. It applies network traffic distribution algorithms to tourism,
suggesting optimal travel routes that avoid crowds.

**Target Users:** Independent travelers in their 20s–30s, MZ generation seeking crowd-free, personal experiences
**Service Type:** Mobile-responsive web (primary), with app expansion planned
**Design Reference Tone:** Functionality of Naver Maps + Kakao T, cleanliness of Toss

---

## Design Direction

- **Simple and intuitive** — the map is the hero, UI elements are minimal
- **Light mode default** / Dark mode supported (follows system setting)
- **Mobile first** — all key interactions placed within thumb-reach zones
- **Congestion color system** applied consistently throughout:
  - 🟢 Green: Quiet (0–30%)
  - 🟡 Yellow: Relaxed (30–50%)
  - 🟠 Orange: Moderate (50–80%)
  - 🔴 Red: Crowded (80–100%)

---

## Screen 1 — Main Map (Entry Screen)

### Layout
```
┌─────────────────────────┐
│  Status Bar              │
│  [HanGaRo Logo]  [☀️/🌙] │  ← Header (logo + dark mode toggle)
├─────────────────────────┤
│                          │
│                          │
│      Full-screen Map     │  ← Kakao Maps
│   (Current location dot) │
│   (Congestion pulse nodes│
│                          │
│                          │
│                          │
├─────────────────────────┤  ← Bottom Sheet (draggable)
│  ▬  (drag handle)        │
│  Transport: [🚶 Walk][🚌 Transit][🚗 Car]  │
│                          │
│  📍 Enter destination    │  ← Input field
│  + Add waypoint          │
│                          │
│  [    Find Route    ]    │  ← Primary CTA button
└─────────────────────────┘
```

### Detailed Specs

**Header**
- Left: HanGaRo logo (text or symbol + text)
- Right: Dark mode toggle icon
- Background: transparent or frosted glass blur (map visible through it)

**Congestion nodes on map**
- Circular pulse animation on each tourist spot
- Color + pulse speed varies by congestion level (faster and stronger when more crowded)
- Tap a node → tooltip shows place name + congestion label
- Current location: blue dot + ripple wave

**Bottom Sheet**
- Default: peek state — only drag handle visible at bottom
- Drag up: snaps to half-height → then full-height
- Background: white (light) / dark gray (dark), rounded top corners
- Elevated shadow effect as it rises

**Transport mode selector**
- Segment control: [🚶 Walk] [🚌 Transit] [🚗 Car]
- Selected tab highlighted with primary color

**Input fields**
- Destination field: 📍 icon + placeholder "Enter your destination"
- Waypoint fields: 🔵 icon + draggable to reorder
- `+ Add waypoint` text button with icon
- ✕ delete button on the right of each field
- Autocomplete dropdown: shows place name + congestion color dot

**When no destination is entered**
- CTA button changes from `Find Route` → `Recommend Quiet Places Nearby`

---

## Screen 2 — Searching Route (Loading)

### Layout
```
┌─────────────────────────┐
│      Full-screen Map     │
│                          │
│  Nodes activate in order │  ← Dijkstra search visualization
│  → Route turns green     │
│  → Particle flow starts  │
│                          │
├─────────────────────────┤
│  Analyzing congestion... │
│  ████████░░ 75%          │  ← Progress bar
└─────────────────────────┘
```

### Detailed Specs
- Search animation runs directly on the map
- Minimum 2-second animation guaranteed (even if API responds faster)
- Bottom text updates in 3 stages:
  1. "Collecting tourist spot data..."
  2. "Analyzing congestion levels..."
  3. "Calculating optimal route..."
- Cancel button placed small in the top-right corner

---

## Screen 3 — Result Screen

### Layout
```
┌─────────────────────────┐
│  ← [HanGaRo]  [💾][↗️]  │  ← Header (back + save + share)
├─────────────────────────┤
│  [Plan A: Min Crowd][B: Shortest][C: Hidden Gems]  │  ← Plan tabs
├─────────────────────────┤
│                          │
│   Map (route animation)  │  ← Height adjustable via swipe
│                          │
├────── swipe handle ──────┤
│  Congestion -61% ↓  Avg 0.28  │  ← Summary badges
│                          │
│  ⚠️ Gyeongbokgung alert card  │  ← Buffer routing suggestion (if applicable)
│                          │
│  ① Changdeokgung  🟢 Quiet   │
│     Walk 15 min →         │
│  ② Naksan Park    🟢 Quiet   │
│     Bus 10 min →          │
│  ③ Ihwa Mural Village 🟡 Relaxed │
│  ...                     │
│                          │
│  [  Search Again  ]      │
└─────────────────────────┘
```

### Detailed Specs

**Plan tabs**
- 3 tabs: A / B / C
- Each tab shows one key metric:
  - A: "Min congestion · Avg 0.28"
  - B: "30 min travel · Shortest distance"
  - C: "3 hidden gems included"
- Switching tabs updates the route color on the map

**Swipe ratio adjustment**
- Default: map 50% / list 50%
- Swipe up → map minimized (list fullscreen)
- Swipe down → map fullscreen (list hidden)

**Buffer routing alert card**
- Yellow background warning card
- "Gyeongbokgung is very crowded right now. We recommend visiting Seochon → Tonguido first, then heading to Gyeongbokgung."
- `Switch to This Route` (primary button) / `Keep Original` (text button)

**Waypoint cards**
- Number circle → place name → congestion badge (color)
- Second line: estimated time at location
- Between cards: transport icon + travel time (connecting line)
- Right side drag handle (≡) to reorder
- Reordering triggers live congestion recalculation → badge colors update

**Save / Share**
- Icon buttons in the header right
- Share: copy link or share via KakaoTalk

---

## Component Specs

### Congestion Badge
```
[🟢 Quiet]     bg: #dcfce7, text: #16a34a
[🟡 Relaxed]   bg: #fef9c3, text: #ca8a04
[🟠 Moderate]  bg: #ffedd5, text: #ea580c
[🔴 Crowded]   bg: #fee2e2, text: #dc2626
```

### Color Palette (Light Mode)
```
Primary:     #22c55e  (green — brand color, evokes tranquility)
Background:  #ffffff
Surface:     #f9fafb
Text:        #111827
SubText:     #6b7280
Border:      #e5e7eb
```

### Color Palette (Dark Mode)
```
Primary:     #4ade80
Background:  #0f172a
Surface:     #1e293b
Text:        #f8fafc
SubText:     #94a3b8
Border:      #334155
```

### Typography
```
App name:      Bold 20px
Section title: SemiBold 16px
Place name:    Medium 15px
Supporting:    Regular 13px
Label/Badge:   Medium 12px
```

### Buttons
```
Primary CTA:   bg Primary, white text, radius 12px, height 52px
Secondary:     border Border, text Text, radius 12px
Text Button:   no background, Primary color text
```

---

## Design Request

Please design the following 3 mobile screens based on the specs above.

1. **Screen 1 — Main Map**: Bottom Sheet in half-expanded state
2. **Screen 2 — Loading**: Mid-animation state during route search
3. **Screen 3 — Result**: Plan A selected + buffer routing alert card visible

**Device:** iPhone 14 Pro (393 × 852px)
**Light mode first**, dark mode version also requested
**Deliver as Figma frames**
