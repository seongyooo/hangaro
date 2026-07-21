import { useState, useRef, useCallback, useEffect } from 'react'
import MainPage from './pages/MainPage'
import SearchingPage from './pages/SearchingPage'
import ResultPage from './pages/ResultPage'

// ── Theme ────────────────────────────────────────────────────────────────────
export const LIGHT = {
  bg: '#ffffff',
  surface: '#f9fafb',
  text: '#111827',
  subtext: '#6b7280',
  border: '#e5e7eb',
  primary: '#22c55e',
  mapBg: '#eef2f0',
  mapGrid: 'rgba(17,24,39,0.05)',
  mapBlock: 'rgba(17,24,39,0.06)',
  headerGlass: 'rgba(255,255,255,0.55)',
}

export const DARK = {
  bg: '#0f172a',
  surface: '#1e293b',
  text: '#f8fafc',
  subtext: '#94a3b8',
  border: '#334155',
  primary: '#4ade80',
  mapBg: '#0b1424',
  mapGrid: 'rgba(148,163,184,0.08)',
  mapBlock: 'rgba(148,163,184,0.09)',
  headerGlass: 'rgba(15,23,42,0.55)',
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const LEVEL_COLOR = {
  quiet: '#16a34a',
  relaxed: '#ca8a04',
  moderate: '#ea580c',
  crowded: '#dc2626',
}

export const LEVEL_BADGE_BG = {
  quiet: '#dcfce7',
  relaxed: '#fef9c3',
  moderate: '#ffedd5',
  crowded: '#fee2e2',
}

export const LEVEL_LABEL = {
  quiet: 'Quiet',
  relaxed: 'Relaxed',
  moderate: 'Moderate',
  crowded: 'Crowded',
}

export const IDLE_NODES = [
  { id: 'gb', name: 'Gyeongbokgung',        lat: 37.5796, lng: 126.9770, x: 44, y: 30, level: 'crowded' },
  { id: 'bc', name: 'Bukchon Hanok Village', lat: 37.5826, lng: 126.9830, x: 58, y: 24, level: 'moderate' },
  { id: 'is', name: 'Insadong',              lat: 37.5740, lng: 126.9858, x: 62, y: 44, level: 'moderate' },
  { id: 'cd', name: 'Changdeokgung',         lat: 37.5794, lng: 126.9910, x: 70, y: 32, level: 'quiet' },
  { id: 'np', name: 'Naksan Park',           lat: 37.5804, lng: 127.0072, x: 80, y: 48, level: 'quiet' },
  { id: 'im', name: 'Ihwa Village',          lat: 37.5773, lng: 127.0070, x: 76, y: 62, level: 'relaxed' },
]

export const MAP_BLOCKS = [
  { x: 8, y: 14, w: 34, h: 22 },
  { x: 20, y: 40, w: 26, h: 18 },
  { x: 55, y: 12, w: 22, h: 16 },
  { x: 10, y: 66, w: 30, h: 20 },
  { x: 66, y: 70, w: 24, h: 16 },
  { x: 38, y: 70, w: 18, h: 14 },
  { x: 82, y: 20, w: 16, h: 14 },
  { x: 50, y: 52, w: 20, h: 14 },
  { x: 6, y: 88, w: 22, h: 10 },
  { x: 70, y: 44, w: 14, h: 12 },
]

export const RESULT_WAYPOINTS_BASE = [
  { id: 'cd', name: 'Changdeokgung', level: 'quiet', stay: '40 min', connectorType: 'walk', connectorTime: '15 min' },
  { id: 'np', name: 'Naksan Park', level: 'quiet', stay: '25 min', connectorType: 'transit', connectorTime: '10 min' },
  { id: 'im', name: 'Ihwa Mural Village', level: 'relaxed', stay: '35 min', connectorType: 'walk', connectorTime: '8 min' },
  { id: 'bc', name: 'Bukchon Hanok Village', level: 'moderate', stay: '30 min', connectorType: null, connectorTime: null },
]

export const PLAN_META = {
  A: { title: 'Plan A', metric: 'Min Crowd', color: '#22c55e', bgActive: '#22c55e' },
  B: { title: 'Plan B', metric: 'Shortest', color: '#3b82f6', bgActive: '#3b82f6' },
  C: { title: 'Plan C', metric: 'Hidden Gems', color: '#a855f7', bgActive: '#a855f7' },
}

export const LOADING_STAGES = [
  'Collecting tourist spot data...',
  'Analyzing congestion levels...',
  'Calculating optimal route...',
]


// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(false)
  const [screen, setScreen] = useState(1) // 1 | 2 | 3
  const [transport, setTransport] = useState('walk')
  const [destination, setDestination] = useState('')
  const [waypoints, setWaypoints] = useState([])
  const [tipNodeId, setTipNodeId] = useState(null)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingStage, setLoadingStage] = useState(0)
  const [plan, setPlan] = useState('A')
  const [bufferDismissed, setBufferDismissed] = useState(false)
  const [bufferApplied, setBufferApplied] = useState(false)
  const [resultWaypoints, setResultWaypoints] = useState(
    RESULT_WAYPOINTS_BASE.map((w, i) => ({ ...w, order: i + 1 }))
  )
  const [dragWpId, setDragWpId] = useState(null)

  const loadTimerRef = useRef(null)
  const theme = dark ? DARK : LIGHT

  const toggleDark = useCallback(() => setDark((d) => !d), [])

  const goToScreen = useCallback((n) => setScreen(n), [])

  const backToScreen1 = useCallback(() => {
    clearInterval(loadTimerRef.current)
    setScreen(1)
  }, [])

  const addWaypoint = useCallback(() => {
    setWaypoints((prev) => [
      ...prev,
      { id: `wp-${Date.now()}`, name: '', lat: null, lng: null },
    ])
  }, [])

  const removeWaypoint = useCallback((id) => {
    setWaypoints((prev) => prev.filter((w) => w.id !== id))
  }, [])

  const updateWaypoint = useCallback((id, data) => {
    setWaypoints((prev) => prev.map((w) => (w.id === id ? { ...w, ...data } : w)))
  }, [])

  const startSearch = useCallback(() => {
    clearInterval(loadTimerRef.current)
    setScreen(2)
    setLoadingProgress(0)
    setLoadingStage(0)
    const t0 = Date.now()
    const duration = 2200
    loadTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - t0
      const pct = Math.min(100, Math.round((elapsed / duration) * 100))
      const stage = pct < 34 ? 0 : pct < 67 ? 1 : 2
      setLoadingProgress(pct)
      setLoadingStage(stage)
      if (pct >= 100) {
        clearInterval(loadTimerRef.current)
        setTimeout(() => setScreen(3), 350)
      }
    }, 90)
  }, [])

  const cancelSearch = useCallback(() => {
    clearInterval(loadTimerRef.current)
    setScreen(1)
  }, [])

  const switchBufferRoute = useCallback(() => {
    setBufferApplied(true)
    setBufferDismissed(true)
  }, [])

  const keepOriginal = useCallback(() => {
    setBufferDismissed(true)
  }, [])

  const onWpPointerDown = useCallback((id, e) => {
    e.preventDefault()
    setDragWpId(id)
    let lastY = e.clientY
    const move = (ev) => {
      const delta = ev.clientY - lastY
      if (Math.abs(delta) < 36) return
      lastY = ev.clientY
      setResultWaypoints((prev) => {
        const list = [...prev]
        const idx = list.findIndex((w) => w.id === id)
        const swapIdx = delta > 0 ? idx + 1 : idx - 1
        if (swapIdx < 0 || swapIdx >= list.length) return prev
        ;[list[idx], list[swapIdx]] = [list[swapIdx], list[idx]]
        return list.map((w, i) => ({ ...w, order: i + 1 }))
      })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDragWpId(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [])

  // Clean up on unmount
  useEffect(() => {
    return () => clearInterval(loadTimerRef.current)
  }, [])

  const sharedProps = {
    dark,
    theme,
    toggleDark,
    goToScreen,
    backToScreen1,
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: theme.bg,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {screen === 1 && (
        <MainPage
          {...sharedProps}
          transport={transport}
          setTransport={setTransport}
          destination={destination}
          setDestination={setDestination}
          waypoints={waypoints}
          addWaypoint={addWaypoint}
          removeWaypoint={removeWaypoint}
          updateWaypoint={updateWaypoint}
          tipNodeId={tipNodeId}
          setTipNodeId={setTipNodeId}
          startSearch={startSearch}
        />
      )}
      {screen === 2 && (
        <SearchingPage
          {...sharedProps}
          loadingProgress={loadingProgress}
          loadingStage={loadingStage}
          cancelSearch={cancelSearch}
        />
      )}
      {screen === 3 && (
        <ResultPage
          {...sharedProps}
          plan={plan}
          setPlan={setPlan}
          bufferDismissed={bufferDismissed}
          bufferApplied={bufferApplied}
          switchBufferRoute={switchBufferRoute}
          keepOriginal={keepOriginal}
          resultWaypoints={resultWaypoints}
          dragWpId={dragWpId}
          onWpPointerDown={onWpPointerDown}
        />
      )}
    </div>
  )
}
