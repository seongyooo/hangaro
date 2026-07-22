import { useState, useRef, useCallback, useEffect } from 'react'
import KakaoMapView from '../components/map/KakaoMapView'
import CongestionBadge from '../components/ui/CongestionBadge'
import {
  ChevronLeftIcon, ChevronRightIcon,
  SaveIcon, ShareIcon, AlertIcon,
  WalkIcon, TransitIcon, CarIcon,
  GripIcon, SidebarIcon,
} from '../components/ui/Icons'
import {
  IDLE_NODES,
  PLAN_META,
  LEVEL_COLOR,
} from '../App'

const DESKTOP_BREAKPOINT = 768

function ConnectorIcon({ type, color }) {
  if (type === 'walk') return <WalkIcon size={13} color={color} />
  if (type === 'transit') return <TransitIcon size={13} color={color} />
  if (type === 'car') return <CarIcon size={13} color={color} />
  return null
}

const LABEL_TO_LEVEL = { '한적': 'quiet', '여유': 'relaxed', '보통': 'moderate', '혼잡': 'crowded' }

export default function ResultPage({
  theme,
  dark,
  toggleDark,
  backToScreen1,
  plan,
  setPlan,
  bufferDismissed,
  bufferApplied,
  switchBufferRoute,
  keepOriginal,
  resultWaypoints,
  resultSpots = [],       // API 실제 관광지 (lat/lng/congestion_label 포함)
  originNode = null,      // { lat, lng } 출발지
  apiStats = null,        // { congestion_avg, reduction_pct }
  dragWpId,
  onWpPointerDown,
}) {
  const [isDesktop, setIsDesktop] = useState(
    () => window.innerWidth >= DESKTOP_BREAKPOINT
  )
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Mobile map height (draggable split)
  const [mapH, setMapH] = useState(240)
  const splitDragRef = useRef(null)

  useEffect(() => {
    const handle = () => setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT)
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [])

  const onSplitPointerDown = useCallback((e) => {
    e.preventDefault()
    splitDragRef.current = { startY: e.clientY, startH: mapH }
    const onMove = (ev) => {
      if (!splitDragRef.current) return
      const delta = ev.clientY - splitDragRef.current.startY
      setMapH(Math.max(80, Math.min(560, splitDragRef.current.startH + delta)))
    }
    const onUp = () => {
      splitDragRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [mapH])

  const planMeta = PLAN_META[plan]
  const planColor = planMeta.color

  // 실제 API 결과가 있으면 사용, 없으면 IDLE_NODES 데모 폴백
  const hasRealSpots = resultSpots.length > 0
  const nodesResult = hasRealSpots
    ? resultSpots.map((spot, i) => ({
        id: spot.id,
        name: spot.name,
        lat: spot.lat,
        lng: spot.lng,
        order: i + 1,
        color: LEVEL_COLOR[LABEL_TO_LEVEL[spot.congestion_label]] || planColor,
        level: LABEL_TO_LEVEL[spot.congestion_label] || 'moderate',
        pulse: false,
        showTip: false,
      }))
    : IDLE_NODES.slice(0, 4).map((n, i) => ({
        ...n,
        order: i + 1,
        color: planColor,
        pulse: false,
        showTip: false,
      }))

  // 폴리라인: 출발지 + 관광지 순서
  const routeNodes = hasRealSpots
    ? [...(originNode ? [{ ...originNode, id: '__origin__' }] : []), ...nodesResult]
    : IDLE_NODES.slice(0, 4)

  const congestionVal = bufferApplied
    ? '−73%'
    : apiStats
      ? `${apiStats.reduction_pct > 0 ? '−' : '+'}${Math.abs(apiStats.reduction_pct).toFixed(1)}%`
      : '−61%'
  const avgVal = bufferApplied
    ? '0.19'
    : apiStats
      ? apiStats.congestion_avg.toFixed(2)
      : plan === 'A' ? '0.28' : plan === 'B' ? '0.41' : '0.33'
  const showBufferAlert = plan === 'A' && !bufferDismissed

  // ── Shared sub-components ────────────────────────────────────────────────────

  const MapArea = ({ style }) => (
    <div style={{ position: 'relative', overflow: 'hidden', ...style }}>
      <KakaoMapView
        theme={theme}
        nodes={nodesResult}
        showLocation={false}
        routeNodes={routeNodes}
        planColor={planColor}
        fitBoundsToNodes={hasRealSpots}
        style={{ width: '100%', height: '100%' }}
      />

      {/* Desktop sidebar toggle */}
      {isDesktop && (
        <button
          onClick={() => setSidebarOpen((s) => !s)}
          title={sidebarOpen ? 'Hide panel' : 'Show panel'}
          style={{
            position: 'absolute',
            right: 12,
            top: 12,
            width: 34,
            height: 34,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: theme.bg,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,.12)',
            zIndex: 10,
          }}
        >
          <SidebarIcon size={16} color={sidebarOpen ? theme.text : theme.subtext} />
        </button>
      )}
    </div>
  )

  const PlanTabs = () => (
    <div style={{ display: 'flex', gap: 6 }}>
      {Object.entries(PLAN_META).map(([key, pm]) => {
        const active = plan === key
        return (
          <button
            key={key}
            onClick={() => setPlan(key)}
            style={{
              flex: 1,
              padding: '9px 6px',
              borderRadius: 10,
              cursor: 'pointer',
              textAlign: 'center',
              border: `1px solid ${active ? pm.color : theme.border}`,
              background: active ? pm.color : 'transparent',
              transition: 'background 0.15s, border-color 0.15s',
            }}
          >
            <div style={{ fontSize: 11.5, fontWeight: 700, color: active ? '#fff' : theme.text }}>
              {pm.title}
            </div>
            <div style={{ fontSize: 10, color: active ? 'rgba(255,255,255,0.8)' : theme.subtext, marginTop: 2 }}>
              {pm.metric}
            </div>
          </button>
        )
      })}
    </div>
  )

  const StatsBadges = () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <div style={{ flex: 1, background: theme.surface, borderRadius: 10, padding: '10px 12px' }}>
        <div style={{ fontSize: 10.5, color: theme.subtext, marginBottom: 3 }}>Congestion</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: theme.primary }}>{congestionVal}</div>
      </div>
      <div style={{ flex: 1, background: theme.surface, borderRadius: 10, padding: '10px 12px' }}>
        <div style={{ fontSize: 10.5, color: theme.subtext, marginBottom: 3 }}>Avg. crowd</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: theme.text }}>{avgVal}</div>
      </div>
    </div>
  )

  const BufferAlert = () => (
    showBufferAlert ? (
      <div
        style={{
          background: dark ? 'rgba(202,138,4,0.12)' : '#fffbeb',
          border: `1px solid ${dark ? 'rgba(202,138,4,0.3)' : '#fde68a'}`,
          borderRadius: 12,
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <AlertIcon size={15} color="#b45309" />
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: dark ? '#fbbf24' : '#92400e', fontWeight: 500 }}>
            Gyeongbokgung is very crowded right now. Consider visiting Seochon → Tonguido first.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={switchBufferRoute}
            style={{
              flex: 1,
              background: '#b45309',
              color: 'white',
              fontSize: 12,
              fontWeight: 700,
              padding: '8px 0',
              borderRadius: 8,
              cursor: 'pointer',
              border: 'none',
            }}
          >
            Switch Route
          </button>
          <button
            onClick={keepOriginal}
            style={{
              color: dark ? '#fbbf24' : '#92400e',
              fontSize: 12,
              fontWeight: 600,
              padding: '8px 10px',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
            }}
          >
            Keep Original
          </button>
        </div>
      </div>
    ) : null
  )

  const WaypointList = () => (
    <>
      {resultWaypoints.map((rw, i) => (
        <div key={rw.id}>
          <div
            onPointerDown={(e) => onWpPointerDown(rw.id, e)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: theme.surface,
              borderRadius: 10,
              padding: '10px 12px',
              opacity: dragWpId === rw.id ? 0.5 : 1,
              touchAction: 'none',
              cursor: 'default',
              transition: 'opacity 0.15s',
            }}
          >
            {/* Index circle */}
            <div
              style={{
                width: 22, height: 22, borderRadius: '50%',
                background: theme.bg,
                border: `1.5px solid ${theme.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10.5, fontWeight: 700, color: theme.text, flexShrink: 0,
              }}
            >
              {i + 1}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 14, fontWeight: 600, color: theme.text,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {rw.name}
              </div>
              <div style={{ fontSize: 11, color: theme.subtext, marginTop: 2 }}>
                Stay ~{rw.stay}
              </div>
            </div>

            <CongestionBadge level={rw.level} />

            <div style={{ cursor: 'grab', color: theme.subtext, flexShrink: 0 }}>
              <GripIcon size={14} color={theme.subtext} />
            </div>
          </div>

          {/* Connector */}
          {rw.connectorType && i < resultWaypoints.length - 1 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 0 5px 18px',
              color: theme.subtext,
            }}>
              <ConnectorIcon type={rw.connectorType} color={theme.subtext} />
              <span style={{ fontSize: 11 }}>{rw.connectorTime}</span>
            </div>
          )}
        </div>
      ))}
    </>
  )

  const SearchAgainBtn = () => (
    <button
      onClick={backToScreen1}
      style={{
        textAlign: 'center',
        padding: '13px 0',
        borderRadius: 10,
        border: `1px solid ${theme.border}`,
        color: theme.text,
        fontSize: 13.5,
        fontWeight: 600,
        cursor: 'pointer',
        background: 'transparent',
        width: '100%',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = theme.surface)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      Search Again
    </button>
  )

  // ── Desktop layout ────────────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
        {/* Desktop header */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: `1px solid ${theme.border}`,
            flexShrink: 0,
            background: theme.bg,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={backToScreen1}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: 8,
                background: 'none', border: `1px solid ${theme.border}`,
                cursor: 'pointer', color: theme.text,
              }}
              aria-label="Back"
            >
              <ChevronLeftIcon size={16} color={theme.text} />
            </button>
            <span style={{ fontSize: 17, fontWeight: 800, color: theme.text, letterSpacing: '-0.3px' }}>
              HanGaRo
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconBtn onClick={() => {}} title="Save" theme={theme}>
              <SaveIcon size={16} color={theme.subtext} />
            </IconBtn>
            <IconBtn onClick={() => {}} title="Share" theme={theme}>
              <ShareIcon size={16} color={theme.subtext} />
            </IconBtn>
          </div>
        </header>

        {/* Desktop body: map + sidebar */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Map */}
          <MapArea style={{ flex: 1, height: '100%' }} />

          {/* Sidebar */}
          {sidebarOpen && (
            <div
              style={{
                width: 380,
                height: '100%',
                background: theme.bg,
                borderLeft: `1px solid ${theme.border}`,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Sidebar top: plan tabs */}
              <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${theme.border}`, flexShrink: 0 }}>
                <PlanTabs />
              </div>

              {/* Scrollable content */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '14px 16px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <StatsBadges />
                <BufferAlert />
                <WaypointList />
                <div style={{ marginTop: 4 }}>
                  <SearchAgainBtn />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Mobile layout ─────────────────────────────────────────────────────────────
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg, overflow: 'hidden' }}>
      {/* Mobile header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px 10px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={backToScreen1}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 8,
              background: 'none', border: `1px solid ${theme.border}`,
              cursor: 'pointer',
            }}
            aria-label="Back"
          >
            <ChevronLeftIcon size={16} color={theme.text} />
          </button>
          <span style={{ fontSize: 16, fontWeight: 800, color: theme.text, letterSpacing: '-0.3px' }}>
            HanGaRo
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <IconBtn onClick={() => {}} title="Save" theme={theme}>
            <SaveIcon size={15} color={theme.subtext} />
          </IconBtn>
          <IconBtn onClick={() => {}} title="Share" theme={theme}>
            <ShareIcon size={15} color={theme.subtext} />
          </IconBtn>
        </div>
      </header>

      {/* Plan tabs */}
      <div style={{ padding: '0 16px 10px', flexShrink: 0 }}>
        <PlanTabs />
      </div>

      {/* Map */}
      <div style={{ height: mapH, flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
        <MapArea style={{ width: '100%', height: '100%' }} />
      </div>

      {/* Drag handle */}
      <div
        onPointerDown={onSplitPointerDown}
        style={{
          display: 'flex', justifyContent: 'center',
          padding: '7px 0', cursor: 'row-resize',
          background: theme.bg, flexShrink: 0,
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 3, background: theme.border }} />
      </div>

      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <StatsBadges />
        <BufferAlert />
        <WaypointList />
        <div style={{ marginTop: 2 }}>
          <SearchAgainBtn />
        </div>
      </div>
    </div>
  )
}

function IconBtn({ onClick, title, theme, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 32, height: 32,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'none',
        border: `1px solid ${theme.border}`,
        borderRadius: 8,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}
