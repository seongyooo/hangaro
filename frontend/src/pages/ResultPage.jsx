import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import SmartMapView from '../components/map/SmartMapView'
import CongestionBadge from '../components/ui/CongestionBadge'
import { fetchRouteGeometry } from '../lib/routing'
import {
  ChevronLeftIcon,
  WalkIcon, TransitIcon, CarIcon,
  GripIcon,
} from '../components/ui/Icons'
import {
  IDLE_NODES,
  PLAN_META,
  LEVEL_COLOR,
} from '../App'

const DESKTOP_BREAKPOINT = 768
const LABEL_TO_LEVEL = { '한적': 'quiet', '여유': 'relaxed', '보통': 'moderate', '혼잡': 'crowded' }

function ConnectorIcon({ type, color }) {
  if (type === 'walk') return <WalkIcon size={12} color={color} />
  if (type === 'transit') return <TransitIcon size={12} color={color} />
  if (type === 'car') return <CarIcon size={12} color={color} />
  return null
}

export default function ResultPage({
  theme,
  dark,
  backToScreen1,
  plan,
  setPlan,
  bufferDismissed,
  bufferApplied,
  switchBufferRoute,
  keepOriginal,
  resultWaypoints,
  resultSpots = [],
  originNode = null,
  apiStats = null,
  apiPlans = null,       // { A: CoursePlan, B: CoursePlan, C: CoursePlan }
  transport = 'walk',
  dragWpId,
  onWpPointerDown,
}) {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= DESKTOP_BREAKPOINT)
  const [mapH, setMapH] = useState(220)
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
      setMapH(Math.max(80, Math.min(560, splitDragRef.current.startH + ev.clientY - splitDragRef.current.startY)))
    }
    const onUp = () => {
      splitDragRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [mapH])

  const planMeta   = PLAN_META[plan]
  const planColor  = planMeta.color
  const hasRealSpots = resultSpots.length > 0

  const nodesResult = useMemo(() => hasRealSpots
    ? resultSpots.map((spot, i) => ({
        id: spot.id, name: spot.name, lat: spot.lat, lng: spot.lng,
        order: i + 1,
        color: LEVEL_COLOR[LABEL_TO_LEVEL[spot.congestion_label]] || planColor,
        level: LABEL_TO_LEVEL[spot.congestion_label] || 'moderate',
        pulse: false, showTip: false,
      }))
    : IDLE_NODES.slice(0, 4).map((n, i) => ({ ...n, order: i + 1, color: planColor, pulse: false, showTip: false })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [hasRealSpots, resultSpots])

  const originAlreadyInSpots = hasRealSpots && resultSpots[0]?.id === '__origin__'
  const routeNodes = useMemo(() => hasRealSpots
    ? (originAlreadyInSpots
        ? nodesResult
        : [...(originNode ? [{ ...originNode, id: '__origin__' }] : []), ...nodesResult])
    : IDLE_NODES.slice(0, 4),
  [hasRealSpots, originAlreadyInSpots, originNode, nodesResult])

  const [routePath, setRoutePath] = useState(null)
  const routeCoordKey = useMemo(() =>
    routeNodes.filter((n) => n.lat != null && n.lng != null)
      .map((n) => `${n.lat.toFixed(5)},${n.lng.toFixed(5)}`).join('|'),
  [routeNodes])

  useEffect(() => {
    if (!hasRealSpots || !routeCoordKey) { setRoutePath(null); return }
    let cancelled = false
    fetchRouteGeometry(routeNodes, transport).then((path) => {
      if (!cancelled && path) setRoutePath(path)
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeCoordKey, transport])

  const routeStrokeStyle = transport === 'transit' ? 'longdash' : 'solid'

  // Buffer routing message (from API Plan A, or demo)
  const bufferMessage = apiPlans?.['A']?.message ?? null
  const showBufferAlert = plan === 'A' && !bufferDismissed && (bufferMessage || bufferApplied)

  // Stats
  const activePlanStats = apiPlans?.[plan]
  const congestionAvg   = bufferApplied ? 0.19
    : activePlanStats?.total_congestion_avg ?? apiStats?.congestion_avg
    ?? (plan === 'A' ? 0.28 : plan === 'B' ? 0.41 : 0.33)
  const reductionPct    = bufferApplied ? 73
    : activePlanStats?.congestion_reduction_pct ?? apiStats?.reduction_pct
    ?? (plan === 'A' ? 68 : plan === 'B' ? 30 : 52)

  // ── Sub-components ──────────────────────────────────────────────────────────

  const MapArea = ({ style }) => (
    <SmartMapView
      theme={theme} dark={dark} nodes={nodesResult}
      showLocation={false} routeNodes={routeNodes}
      routePath={routePath} routeStrokeStyle={routeStrokeStyle}
      planColor={planColor} fitBoundsToNodes={hasRealSpots}
      style={{ width: '100%', height: '100%', ...style }}
    />
  )

  /** 버퍼 라우팅 배너 — 오버투어리즘 핵심 기능 */
  const BufferBanner = () => {
    if (!showBufferAlert) return null
    return (
      <div style={{
        background: dark ? 'rgba(120,53,15,0.25)' : '#fffbeb',
        border: `1.5px solid ${dark ? '#f59e0b88' : '#f59e0b'}`,
        borderRadius: 14, padding: '14px 16px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>⚠️</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: dark ? '#fbbf24' : '#92400e', marginBottom: 4 }}>
              목적지가 지금 혼잡해요
            </div>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: dark ? '#fcd34d' : '#78350f' }}>
              {bufferMessage || 'Plan A 코스는 혼잡이 풀릴 때까지 근처 숨은 명소를 먼저 들르도록 동선을 자동 조정했어요.'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={switchBufferRoute} style={{
            flex: 1, background: '#b45309', color: 'white',
            fontSize: 12.5, fontWeight: 700, padding: '9px 0',
            borderRadius: 8, cursor: 'pointer', border: 'none',
          }}>
            이 코스로 바꾸기
          </button>
          <button onClick={keepOriginal} style={{
            color: dark ? '#fbbf24' : '#92400e', fontSize: 12.5, fontWeight: 600,
            padding: '9px 12px', cursor: 'pointer', background: 'none', border: 'none',
          }}>
            원래대로
          </button>
        </div>
      </div>
    )
  }

  /** Plan A/B/C 비교 카드 */
  const PlanCards = () => (
    <div>
      <div style={{ fontSize: 11.5, color: theme.subtext, marginBottom: 8, fontWeight: 600 }}>
        코스 비교 — 탭해서 전환
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {Object.entries(PLAN_META).map(([key, pm]) => {
          const active  = plan === key
          const stats   = apiPlans?.[key]
          const avg     = stats?.total_congestion_avg ?? (key === 'A' ? 0.28 : key === 'B' ? 0.41 : 0.33)
          const redPct  = stats?.congestion_reduction_pct ?? (key === 'A' ? 68 : key === 'B' ? 30 : 52)

          return (
            <button key={key} onClick={() => setPlan(key)} style={{
              flex: 1, padding: '10px 10px 12px',
              borderRadius: 12, cursor: 'pointer', textAlign: 'left',
              border: `2px solid ${active ? pm.color : theme.border}`,
              background: active ? pm.color + '12' : theme.surface,
              transition: 'all 0.15s',
            }}>
              {/* Plan label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: active ? pm.color : theme.border,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 800, color: active ? 'white' : theme.subtext,
                  flexShrink: 0,
                }}>
                  {key}
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: active ? pm.color : theme.subtext }}>
                  {pm.metric}
                </span>
              </div>

              {/* Congestion bar */}
              <div style={{ height: 3, borderRadius: 2, background: theme.border, marginBottom: 5 }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  width: `${Math.round(avg * 100)}%`,
                  background: avg < 0.35 ? '#10b981' : avg < 0.55 ? '#f59e0b' : '#ef4444',
                  transition: 'width 0.5s ease',
                }} />
              </div>

              {/* Stats */}
              <div style={{ fontSize: 13, fontWeight: 800, color: active ? pm.color : theme.text }}>
                {Math.round(avg * 100)}%
              </div>
              <div style={{ fontSize: 10, color: theme.subtext, marginTop: 1 }}>
                {redPct > 0 ? `−${Math.round(redPct)}% 절감` : `+${Math.round(Math.abs(redPct))}%`}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )

  /** 현재 플랜 통계 요약 */
  const StatSummary = () => (
    <div style={{
      display: 'flex', gap: 8,
      background: planColor + '0e',
      border: `1px solid ${planColor}30`,
      borderRadius: 12, padding: '12px 14px',
      alignItems: 'center',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: planColor + '20',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, flexShrink: 0,
      }}>
        {plan === 'A' ? '🌿' : plan === 'B' ? '⚡' : '🔭'}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: planColor }}>{planMeta.title} — {planMeta.metric}</div>
        <div style={{ fontSize: 11, color: theme.subtext, marginTop: 2 }}>
          평균 혼잡도 {Math.round(congestionAvg * 100)}% · 일반 코스 대비 {Math.round(reductionPct)}% 절감
        </div>
      </div>
    </div>
  )

  /** 장소 목록 */
  const WaypointList = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {resultWaypoints.map((rw, i) => (
        <div key={rw.id}>
          <div
            onPointerDown={(e) => onWpPointerDown(rw.id, e)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: theme.surface, borderRadius: 10, padding: '10px 12px',
              opacity: dragWpId === rw.id ? 0.4 : 1,
              touchAction: 'none', cursor: 'default', transition: 'opacity 0.15s',
            }}
          >
            <div style={{
              width: 22, height: 22, borderRadius: '50%', background: theme.bg,
              border: `1.5px solid ${theme.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10.5, fontWeight: 700, color: theme.text, flexShrink: 0,
            }}>
              {i + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13.5, fontWeight: 600, color: theme.text,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {rw.name}
              </div>
              {rw.stay && <div style={{ fontSize: 11, color: theme.subtext, marginTop: 1 }}>~{rw.stay}</div>}
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
              padding: '4px 0 4px 20px', color: theme.subtext,
            }}>
              <ConnectorIcon type={rw.connectorType} color={theme.subtext} />
              <span style={{ fontSize: 10.5 }}>{rw.connectorTime}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )

  const SearchAgainBtn = () => (
    <button onClick={backToScreen1} style={{
      textAlign: 'center', padding: '12px 0', borderRadius: 10,
      border: `1px solid ${theme.border}`, color: theme.text,
      fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
      background: 'transparent', width: '100%',
    }}
      onMouseEnter={(e) => (e.currentTarget.style.background = theme.surface)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      ← 다시 검색
    </button>
  )

  // ── Desktop layout ────────────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
        {/* Header */}
        <header style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 20px', borderBottom: `1px solid ${theme.border}`,
          flexShrink: 0, background: theme.bg,
        }}>
          <button onClick={backToScreen1} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: 8,
            background: 'none', border: `1px solid ${theme.border}`, cursor: 'pointer',
          }}>
            <ChevronLeftIcon size={16} color={theme.text} />
          </button>
          <span style={{ fontSize: 17, fontWeight: 800, color: theme.text }}>HanGaRo</span>
          <span style={{ fontSize: 12, color: theme.subtext, marginLeft: 4 }}>추천 결과</span>
        </header>

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
          {/* Map */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <MapArea style={{}} />
          </div>

          {/* Sidebar */}
          <div style={{
            width: 380, height: '100%', background: theme.bg,
            borderLeft: `1px solid ${theme.border}`,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{
              flex: 1, overflowY: 'auto',
              padding: '16px 16px 24px',
              display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              <BufferBanner />
              <PlanCards />
              <StatSummary />
              <WaypointList />
              <SearchAgainBtn />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Mobile layout ─────────────────────────────────────────────────────────────
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg, overflow: 'hidden' }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 16px 8px', flexShrink: 0,
      }}>
        <button onClick={backToScreen1} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32, borderRadius: 8,
          background: 'none', border: `1px solid ${theme.border}`, cursor: 'pointer',
        }}>
          <ChevronLeftIcon size={16} color={theme.text} />
        </button>
        <span style={{ fontSize: 16, fontWeight: 800, color: theme.text }}>HanGaRo</span>
        <span style={{ fontSize: 11, color: theme.subtext }}>추천 결과</span>
      </header>

      {/* Buffer alert (if applicable) */}
      {showBufferAlert && (
        <div style={{ padding: '0 16px 8px', flexShrink: 0 }}>
          <BufferBanner />
        </div>
      )}

      {/* Map */}
      <div style={{ height: mapH, flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
        <MapArea style={{}} />
      </div>

      {/* Drag handle */}
      <div onPointerDown={onSplitPointerDown} style={{
        display: 'flex', justifyContent: 'center', padding: '7px 0',
        cursor: 'row-resize', background: theme.bg, flexShrink: 0,
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 3, background: theme.border }} />
      </div>

      {/* Scrollable panel */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <PlanCards />
        <StatSummary />
        {!showBufferAlert && <BufferBanner />}
        <WaypointList />
        <SearchAgainBtn />
      </div>
    </div>
  )
}
