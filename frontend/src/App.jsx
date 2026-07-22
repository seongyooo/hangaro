import { useState, useRef, useCallback, useEffect } from 'react'
import MainPage from './pages/MainPage'
import SearchingPage from './pages/SearchingPage'
import ResultPage from './pages/ResultPage'
import { api } from './lib/api'

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


// ── 좌표 → 지역 자동 감지 ─────────────────────────────────────────────────────
function detectRegion(lat, lng) {
  if (lat >= 33.2 && lat <= 33.6 && lng >= 126.1 && lng <= 126.9) return '제주'
  if (lat >= 35.0 && lat <= 35.3 && lng >= 128.9 && lng <= 129.4) return '부산'
  if (lat >= 35.7 && lat <= 36.1 && lng >= 129.0 && lng <= 129.5) return '경주'
  return '서울'
}

// ── API response → ResultPage waypoint format ─────────────────────────────────
const CONGESTION_LABEL_TO_LEVEL = {
  '한적': 'quiet',
  '여유': 'relaxed',
  '보통': 'moderate',
  '혼잡': 'crowded',
}

const CONNECTOR_TIME = { walk: '12 min', transit: '10 min', car: '7 min' }

function spotsToWaypoints(spots, transport) {
  return spots.map((spot, i) => ({
    id: spot.id,
    name: spot.name,
    level: CONGESTION_LABEL_TO_LEVEL[spot.congestion_label] || 'moderate',
    stay: `${spot.visit_duration} min`,
    connectorType: i < spots.length - 1 ? transport : null,
    connectorTime: i < spots.length - 1 ? CONNECTOR_TIME[transport] : null,
    order: i + 1,
  }))
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(false)
  const [screen, setScreen] = useState(1) // 1 | 2 | 3
  const [transport, setTransport] = useState('walk')
  // 위치 상태
  const [userLocation, setUserLocation] = useState(null)      // { lat, lng } — GPS
  const [mapCenter, setMapCenter] = useState(null)            // { lat, lng } — 현재 지도 중심 (검색 기준)
  const [origin, setOrigin] = useState(null)                  // { lat, lng, name } | null = My Location
  const [destinationLatLng, setDestinationLatLng] = useState(null) // { lat, lng }
  const [destination, setDestination] = useState('')
  const [waypoints, setWaypoints] = useState([])
  // API 결과
  const [resultSpots, setResultSpots] = useState([])          // 실제 관광지 (lat/lng 포함)
  const [apiStats, setApiStats] = useState(null)              // { congestion_avg, reduction_pct }
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

  const startSearch = useCallback(async () => {
    clearInterval(loadTimerRef.current)
    setScreen(2)
    setLoadingProgress(0)
    setLoadingStage(0)

    const t0 = Date.now()
    loadTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - t0
      const pct = Math.min(90, Math.round((elapsed / 2500) * 90))
      setLoadingProgress(pct)
      setLoadingStage(pct < 34 ? 0 : pct < 67 ? 1 : 2)
    }, 90)

    // 출발지 좌표 결정: 선택된 origin > GPS > 서울 기본값
    const srcLoc = origin || userLocation || { lat: 37.5665, lng: 126.9780 }
    // 지역은 목적지(있으면) 또는 출발지 좌표 기반 자동 감지
    const refLoc = destinationLatLng || srcLoc
    const region = detectRegion(refLoc.lat, refLoc.lng)

    const now = new Date()
    const date = now.toISOString().slice(0, 10)
    const start_time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    try {
      const response = await api.recommend({
        region,
        date,
        start_time,
        style: 'culture',
        transport,
        n_stops: 5,
      })

      clearInterval(loadTimerRef.current)
      setLoadingProgress(100)
      setLoadingStage(2)

      const { spots, total_congestion_avg, congestion_reduction_pct } = response.data
      setResultSpots(spots)
      setApiStats({ congestion_avg: total_congestion_avg, reduction_pct: congestion_reduction_pct })

      const newWaypoints = spotsToWaypoints(spots, transport)
      if (newWaypoints.length > 0) setResultWaypoints(newWaypoints)
    } catch (err) {
      console.warn('[HanGaRo] 백엔드 연결 실패, 데모 데이터 사용:', err.message)
      clearInterval(loadTimerRef.current)
      setLoadingProgress(100)
      setLoadingStage(2)
      setResultSpots([])
      setApiStats(null)
      setResultWaypoints(RESULT_WAYPOINTS_BASE.map((w, i) => ({ ...w, order: i + 1 })))
    }

    setTimeout(() => setScreen(3), 350)
  }, [transport, origin, userLocation, destinationLatLng])

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
          userLocation={userLocation}
          onLocationFound={(lat, lng) => {
            setUserLocation({ lat, lng })
            setMapCenter((prev) => prev ?? { lat, lng }) // 최초 1회만 초기화
          }}
          onCenterChange={(lat, lng) => setMapCenter({ lat, lng })}
          searchCenter={mapCenter}
          origin={origin}
          setOrigin={setOrigin}
          destination={destination}
          setDestination={setDestination}
          setDestinationLatLng={setDestinationLatLng}
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
          resultSpots={resultSpots}
          originNode={origin || userLocation}
          apiStats={apiStats}
          dragWpId={dragWpId}
          onWpPointerDown={onWpPointerDown}
        />
      )}
    </div>
  )
}
