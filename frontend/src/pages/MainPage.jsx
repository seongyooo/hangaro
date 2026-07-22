import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import SmartMapView from '../components/map/SmartMapView'
import {
  WalkIcon, TransitIcon, CarIcon, MapPinIcon,
  PlusIcon, XIcon, SunIcon, MoonIcon, SidebarIcon,
} from '../components/ui/Icons'
import {
  IDLE_NODES,
  LEVEL_COLOR,
  LEVEL_LABEL,
} from '../App'

const DESKTOP_BREAKPOINT = 768

const TRANSPORT_MODES = [
  { id: 'walk',    label: 'Walk',    Icon: WalkIcon },
  { id: 'transit', label: 'Transit', Icon: TransitIcon },
  { id: 'car',     label: 'Car',     Icon: CarIcon },
]

export default function MainPage({
  theme,
  dark,
  toggleDark,
  transport,
  setTransport,
  userLocation,
  onLocationFound,
  onCenterChange,
  searchCenter,
  origin,
  setOrigin,
  destination,
  setDestination,
  setDestinationLatLng,
  waypoints,
  addWaypoint,
  removeWaypoint,
  updateWaypoint,
  tipNodeId,
  setTipNodeId,
  startSearch,
}) {
  const [isDesktop, setIsDesktop] = useState(
    () => window.innerWidth >= DESKTOP_BREAKPOINT
  )
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sheetH, setSheetH] = useState(() => Math.round(window.innerHeight * 0.5))
  const sheetDragRef = useRef(null)
  const panelRef = useRef(null)

  // Map interaction state (local to MainPage)
  const [destPin, setDestPin] = useState(null)   // { lat, lng, name } — 지도에 목적지 핀 표시용
  const [centerOn, setCenterOn] = useState(null)
  const [selectedSpot, setSelectedSpot] = useState(null)  // 클릭한 관광지 상세 패널

  useEffect(() => {
    const handle = () => setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT)
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [])

  const SHEET_CLOSED = 28  // 핸들 바만 보이는 최소 높이

  const getSnapPx = useCallback((containerH) => [
    SHEET_CLOSED,
    Math.round(containerH * 0.5),
    Math.round(containerH * 0.82),
  ], [])

  const onHandlePointerDown = useCallback((e) => {
    e.preventDefault()
    const containerH = window.innerHeight
    const snaps = getSnapPx(containerH)
    const startY = e.clientY
    const startH = sheetH ?? snaps[1]
    sheetDragRef.current = { startY, startH }

    const onMove = (ev) => {
      if (!sheetDragRef.current) return
      const delta = sheetDragRef.current.startY - ev.clientY
      const next = Math.max(SHEET_CLOSED, Math.min(containerH - 80, sheetDragRef.current.startH + delta))
      sheetDragRef.current.curH = next   // 현재 높이를 ref에 실시간 저장
      setSheetH(next)
    }
    const onUp = () => {
      if (!sheetDragRef.current) return
      const cur = sheetDragRef.current.curH ?? sheetDragRef.current.startH
      const snapped = snaps.reduce((a, b) =>
        Math.abs(b - cur) < Math.abs(a - cur) ? b : a
      )
      setSheetH(snapped)
      sheetDragRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [sheetH, getSnapPx])

  const handleDestinationSelect = useCallback((place) => {
    setDestination(place.name)
    setDestinationLatLng({ lat: place.lat, lng: place.lng })
    setDestPin({ lat: place.lat, lng: place.lng, name: place.name })
    setCenterOn({ lat: place.lat, lng: place.lng })
  }, [setDestination, setDestinationLatLng])

  const handleDestinationClear = useCallback(() => {
    setDestination('')
    setDestinationLatLng(null)
    setDestPin(null)
  }, [setDestination, setDestinationLatLng])

  const handleOriginSelect = useCallback((place) => {
    setOrigin({ lat: place.lat, lng: place.lng, name: place.name })
    setCenterOn({ lat: place.lat, lng: place.lng })
  }, [setOrigin])

  const handleOriginClear = useCallback(() => {
    setOrigin(null)
  }, [setOrigin])

  const handleWaypointSelect = useCallback((id, place) => {
    updateWaypoint(id, { name: place.name, lat: place.lat, lng: place.lng })
    setCenterOn({ lat: place.lat, lng: place.lng })
  }, [updateWaypoint])

  const hasDestOrWp = !!destination || waypoints.some((w) => w.name)
  const ctaLabel = hasDestOrWp ? 'Find Route' : 'Recommend Quiet Places'

  // Build map nodes
  const idleNodes = IDLE_NODES.map((n) => ({
    ...n,
    color: LEVEL_COLOR[n.level],
    levelLabel: LEVEL_LABEL[n.level],
    pulseDur: n.level === 'crowded' ? '0.9s' : n.level === 'moderate' ? '1.3s' : '2.1s',
    showTip: tipNodeId === n.id,
    onClick: () => {
      setTipNodeId(tipNodeId === n.id ? null : n.id)
      setSelectedSpot((prev) => (prev?.id === n.id ? null : n))
      // 모바일: 바텀시트 절반 높이로 열기
      if (!isDesktop && window.innerHeight) {
        setSheetH(Math.round(window.innerHeight * 0.5))
      }
    },
  }))

  // attractionPins: IDLE_NODES 기반 고정 데이터 — useMemo로 안정화
  // 렌더마다 새 배열이 생성되면 MapboxView에서 마커 전체 재생성 → 흔들림 + 이미지 재로딩 발생
  const attractionPins = useMemo(() =>
    IDLE_NODES.map((n) => ({
      id:    n.id,
      name:  n.name,
      lat:   n.lat,
      lng:   n.lng,
      level: n.level,
      image: n.image,
    })),
  []) // IDLE_NODES는 상수 — 의존성 없음

  const destNode = destPin
    ? [{
        id: '__dest__',
        lat: destPin.lat,
        lng: destPin.lng,
        name: destination,
        pulse: false,
        color: '#ef4444',
        showTip: true,
        levelLabel: 'Destination',
      }]
    : []

  const originNode = origin
    ? [{
        id: '__origin__',
        lat: origin.lat,
        lng: origin.lng,
        name: origin.name,
        pulse: false,
        color: '#8b5cf6',
        showTip: true,
        levelLabel: 'Starting Point',
      }]
    : []

  const wpNodes = waypoints
    .filter((w) => w.lat && w.lng)
    .map((w, i) => ({
      id: w.id,
      lat: w.lat,
      lng: w.lng,
      name: w.name,
      pulse: false,
      color: '#3b82f6',
      showTip: false,
      order: i + 1,
    }))

  const allNodes = [...idleNodes, ...originNode, ...destNode, ...wpNodes]

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* ── Header ── */}
      <header
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 18px 12px',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          background: theme.headerGlass,
        }}
      >
        <span style={{ fontSize: 19, fontWeight: 800, color: theme.text, letterSpacing: '-0.4px' }}>
          HanGaRo
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isDesktop && (
            <button
              onClick={() => setSidebarOpen((s) => !s)}
              title={sidebarOpen ? '패널 닫기' : '패널 열기'}
              style={{
                width: 34, height: 34, borderRadius: '50%',
                background: sidebarOpen ? theme.primary + '18' : theme.surface,
                border: `1px solid ${sidebarOpen ? theme.primary + '40' : theme.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
              aria-label="Toggle sidebar"
            >
              <SidebarIcon size={15} color={sidebarOpen ? theme.primary : theme.subtext} />
            </button>
          )}
          <button
            onClick={toggleDark}
            style={{
              width: 34, height: 34, borderRadius: '50%',
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
            aria-label="Toggle dark mode"
          >
            {dark
              ? <SunIcon size={15} color={theme.subtext} />
              : <MoonIcon size={15} color={theme.subtext} />}
          </button>
        </div>
      </header>

      {/* ── Map + Panel ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <SmartMapView
          theme={theme}
          dark={dark}
          nodes={allNodes}
          congestionBars={idleNodes}
          attractionPins={attractionPins}
          showLocation
          centerOn={centerOn}
          onLocationFound={onLocationFound}
          onCenterChange={onCenterChange}
          style={{ flex: 1, minWidth: 0 }}
        />

        {/* Desktop sidebar */}
        {isDesktop && sidebarOpen && (
          <div
            style={{
              width: 380,
              height: '100%',
              background: theme.bg,
              borderLeft: `1px solid ${theme.border}`,
              display: 'flex',
              flexDirection: 'column',
              paddingTop: 64,
              // overflow: visible so Place dropdown (position:fixed) isn't clipped
              overflow: 'visible',
            }}
          >
            {selectedSpot ? (
              <PlaceDetailPanel
                theme={theme}
                spot={selectedSpot}
                onClose={() => setSelectedSpot(null)}
              />
            ) : (
              <PanelContent
                theme={theme}
                transport={transport}
                setTransport={setTransport}
                searchCenter={searchCenter}
                userLocation={userLocation}
                origin={origin}
                onOriginSelect={handleOriginSelect}
                onOriginClear={handleOriginClear}
                destination={destination}
                onDestinationSelect={handleDestinationSelect}
                onDestinationClear={handleDestinationClear}
                waypoints={waypoints}
                onWaypointSelect={handleWaypointSelect}
                addWaypoint={addWaypoint}
                removeWaypoint={removeWaypoint}
                hasDestOrWp={hasDestOrWp}
                ctaLabel={ctaLabel}
                startSearch={startSearch}
              />
            )}
          </div>
        )}
      </div>

      {/* Mobile bottom sheet */}
      {!isDesktop && (
        <div
          ref={panelRef}
          style={{
            position: 'absolute',
            left: 0, right: 0, bottom: 0,
            height: sheetH,
            background: theme.bg,
            borderRadius: '20px 20px 0 0',
            boxShadow: '0 -12px 40px rgba(0,0,0,.18)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 20,
            touchAction: 'none',
            transition: sheetDragRef.current ? 'none' : 'height 0.25s ease',
          }}
        >
          <div
            onPointerDown={onHandlePointerDown}
            style={{ padding: '10px 0 4px', display: 'flex', justifyContent: 'center', cursor: 'grab' }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 3, background: theme.border }} />
          </div>
          <div style={{ flex: 1, overflow: 'hidden', display: sheetH <= SHEET_CLOSED ? 'none' : 'flex', flexDirection: 'column' }}>
            {selectedSpot ? (
              <PlaceDetailPanel
                theme={theme}
                spot={selectedSpot}
                onClose={() => setSelectedSpot(null)}
              />
            ) : (
              <PanelContent
                theme={theme}
                transport={transport}
                setTransport={setTransport}
                searchCenter={searchCenter}
                userLocation={userLocation}
                origin={origin}
                onOriginSelect={handleOriginSelect}
                onOriginClear={handleOriginClear}
                destination={destination}
                onDestinationSelect={handleDestinationSelect}
                onDestinationClear={handleDestinationClear}
                waypoints={waypoints}
                onWaypointSelect={handleWaypointSelect}
                addWaypoint={addWaypoint}
                removeWaypoint={removeWaypoint}
                hasDestOrWp={hasDestOrWp}
                ctaLabel={ctaLabel}
                startSearch={startSearch}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Origin Row ────────────────────────────────────────────────────────────────
function OriginRow({ theme, userLocation, searchCenter, origin, onOriginSelect, onOriginClear }) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <PlaceSearchInput
        theme={theme}
        placeholder="Search starting point..."
        value={origin?.name || ''}
        onSelect={(place) => { onOriginSelect(place); setEditing(false) }}
        onClear={() => { onOriginClear(); setEditing(false) }}
        userLocation={searchCenter}
        leadingSlot={
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#8b5cf6', flexShrink: 0 }} />
        }
      />
    )
  }

  const label = origin?.name || (userLocation ? 'My Location' : 'Getting location...')
  const isMyLoc = !origin

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: 12,
        padding: '11px 14px',
      }}
    >
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#8b5cf6', flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 14, color: isMyLoc ? theme.subtext : theme.text, fontStyle: isMyLoc ? 'italic' : 'normal' }}>
        {label}
      </span>
      <button
        onClick={() => setEditing(true)}
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: theme.primary,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '2px 4px',
          flexShrink: 0,
        }}
      >
        Change
      </button>
    </div>
  )
}

// ── Panel Content ─────────────────────────────────────────────────────────────
function PanelContent({
  theme,
  transport,
  setTransport,
  searchCenter,
  userLocation,
  origin,
  onOriginSelect,
  onOriginClear,
  destination,
  onDestinationSelect,
  onDestinationClear,
  waypoints,
  onWaypointSelect,
  addWaypoint,
  removeWaypoint,
  hasDestOrWp,
  ctaLabel,
  startSearch,
}) {
  return (
    <div
      style={{
        padding: '16px 18px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        flex: 1,
        overflowY: 'auto',
      }}
    >
      {/* Origin */}
      <OriginRow
        theme={theme}
        userLocation={userLocation}
        searchCenter={searchCenter}
        origin={origin}
        onOriginSelect={onOriginSelect}
        onOriginClear={onOriginClear}
      />

      {/* Transport tabs */}
      <div
        style={{
          display: 'flex',
          background: theme.surface,
          borderRadius: 12,
          padding: 3,
          gap: 2,
        }}
      >
        {TRANSPORT_MODES.map(({ id, label, Icon }) => {
          const active = transport === id
          return (
            <button
              key={id}
              onClick={() => setTransport(id)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                padding: '9px 0',
                borderRadius: 9,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                background: active ? theme.bg : 'transparent',
                color: active ? theme.text : theme.subtext,
                boxShadow: active ? '0 1px 4px rgba(0,0,0,.10)' : 'none',
                transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
              }}
            >
              <Icon size={17} color={active ? theme.text : theme.subtext} />
              {label}
            </button>
          )
        })}
      </div>

      {/* Destination search */}
      <PlaceSearchInput
        theme={theme}
        placeholder="Enter destination"
        value={destination}
        onSelect={onDestinationSelect}
        onClear={onDestinationClear}
        userLocation={searchCenter}
        leadingSlot={<MapPinIcon size={15} color={theme.subtext} />}
      />

      {/* Waypoints */}
      {waypoints.map((wp) =>
        wp.name ? (
          <div
            key={wp.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              borderRadius: 12,
              padding: '11px 14px',
            }}
          >
            <div
              style={{
                width: 8, height: 8, borderRadius: '50%',
                background: '#3b82f6', flexShrink: 0,
              }}
            />
            <span style={{ flex: 1, fontSize: 14, color: theme.text }}>{wp.name}</span>
            <button
              onClick={() => removeWaypoint(wp.id)}
              style={{ display: 'flex', cursor: 'pointer', background: 'none', border: 'none', padding: 2 }}
            >
              <XIcon size={13} color={theme.subtext} />
            </button>
          </div>
        ) : (
          <PlaceSearchInput
            key={wp.id}
            theme={theme}
            placeholder="Search a stop..."
            value=""
            onSelect={(place) => onWaypointSelect(wp.id, place)}
            onClear={() => removeWaypoint(wp.id)}
            userLocation={searchCenter}
            leadingSlot={
              <div
                style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#3b82f6', flexShrink: 0,
                }}
              />
            }
          />
        )
      )}

      {/* Add waypoint */}
      <button
        onClick={addWaypoint}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: theme.primary,
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          background: 'none',
          border: 'none',
          padding: 0,
          width: 'fit-content',
        }}
      >
        <PlusIcon size={14} color={theme.primary} />
        Add waypoint
      </button>

      {/* CTA */}
      <button
        onClick={startSearch}
        style={{
          marginTop: 'auto',
          background: theme.primary,
          color: 'white',
          padding: '15px 0',
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
          border: 'none',
          width: '100%',
          letterSpacing: '-0.1px',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
      >
        {ctaLabel}
      </button>
    </div>
  )
}

// ── Place Detail Panel ───────────────────────────────────────────────────────
const NEARBY_CATEGORIES = [
  { code: 'AT4', label: '관광명소' },
  { code: 'CE7', label: '카페' },
  { code: 'FD6', label: '음식점' },
  { code: 'AD5', label: '숙박' },
]

function PlaceDetailPanel({ theme, spot, onClose }) {
  const [activeTab, setActiveTab] = useState('AT4')
  const [nearbyResults, setNearbyResults] = useState([])
  const [loading, setLoading] = useState(false)

  const searchNearby = useCallback((categoryCode) => {
    const kakao = window.kakao
    if (!kakao?.maps) return

    const run = (services) => {
      if (!services?.Places) return
      const ps = new services.Places()
      setLoading(true)
      setNearbyResults([])
      ps.categorySearch(
        categoryCode,
        (data, status) => {
          setLoading(false)
          if (status === services.Status.OK) {
            setNearbyResults(data.slice(0, 6))
          }
        },
        {
          location: new kakao.maps.LatLng(spot.lat, spot.lng),
          radius: 800,
          sort: kakao.maps.services.SortBy?.DISTANCE,
        }
      )
    }

    if (kakao.maps.services?.Places) {
      run(kakao.maps.services)
    } else {
      kakao.maps.load(() => run(kakao.maps.services))
    }
  }, [spot])

  useEffect(() => {
    searchNearby(activeTab)
  }, [activeTab, searchNearby])

  const congestionColor = {
    quiet: '#10b981', relaxed: '#f59e0b', moderate: '#f97316', crowded: '#ef4444',
  }[spot.level] || '#6b7280'

  const congestionLabel = {
    quiet: '한적', relaxed: '여유', moderate: '보통', crowded: '혼잡',
  }[spot.level] || '보통'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${theme.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <button
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 8,
              background: theme.surface, border: `1px solid ${theme.border}`,
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <XIcon size={13} color={theme.subtext} />
          </button>
          <span style={{ fontSize: 15, fontWeight: 700, color: theme.text, flex: 1 }}>
            {spot.name}
          </span>
          <span
            style={{
              fontSize: 11, fontWeight: 700, color: congestionColor,
              background: congestionColor + '18',
              padding: '3px 8px', borderRadius: 20,
            }}
          >
            {congestionLabel}
          </span>
        </div>

        {/* Thumbnail */}
        {spot.image && (
          <img
            src={spot.image}
            alt={spot.name}
            style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 10 }}
          />
        )}
      </div>

      {/* Category tabs */}
      <div
        style={{
          display: 'flex', gap: 4, padding: '10px 16px 6px',
          borderBottom: `1px solid ${theme.border}`, flexShrink: 0,
          overflowX: 'auto',
        }}
      >
        {NEARBY_CATEGORIES.map(({ code, label }) => {
          const active = activeTab === code
          return (
            <button
              key={code}
              onClick={() => setActiveTab(code)}
              style={{
                padding: '5px 12px',
                borderRadius: 20,
                fontSize: 12, fontWeight: 600,
                cursor: 'pointer',
                border: `1px solid ${active ? theme.primary : theme.border}`,
                background: active ? theme.primary : 'transparent',
                color: active ? '#fff' : theme.subtext,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Nearby results */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 20px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 20, color: theme.subtext, fontSize: 13 }}>
            검색 중...
          </div>
        )}
        {!loading && nearbyResults.length === 0 && (
          <div style={{ textAlign: 'center', padding: 20, color: theme.subtext, fontSize: 13 }}>
            주변 장소를 찾을 수 없습니다.
          </div>
        )}
        {nearbyResults.map((place, i) => (
          <div
            key={place.id || i}
            style={{
              padding: '10px 0',
              borderBottom: i < nearbyResults.length - 1 ? `1px solid ${theme.border}` : 'none',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 3 }}>
              {place.place_name}
            </div>
            <div style={{ fontSize: 11, color: theme.subtext, marginBottom: place.distance ? 4 : 0 }}>
              {place.road_address_name || place.address_name}
            </div>
            {place.distance && (
              <div style={{ fontSize: 11, color: theme.primary, fontWeight: 600 }}>
                {Number(place.distance) >= 1000
                  ? `${(Number(place.distance) / 1000).toFixed(1)}km`
                  : `${place.distance}m`}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Place Search Input ────────────────────────────────────────────────────────
function PlaceSearchInput({ theme, placeholder, value, onSelect, onClear, leadingSlot, userLocation }) {
  const [query, setQuery] = useState(value || '')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [dropPos, setDropPos] = useState(null)
  const wrapRef = useRef(null)
  const dropRef = useRef(null)
  const timerRef = useRef(null)

  const calcPos = useCallback(() => {
    if (!wrapRef.current) return
    const r = wrapRef.current.getBoundingClientRect()
    setDropPos({ top: r.bottom + 4, left: r.left, width: r.width })
  }, [])

  // Close dropdown when clicking outside (both input wrapper AND dropdown)
  useEffect(() => {
    const handler = (e) => {
      const inWrap = wrapRef.current?.contains(e.target)
      const inDrop = dropRef.current?.contains(e.target)
      if (!inWrap && !inDrop) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Update dropdown position on scroll/resize
  useEffect(() => {
    if (!open) return
    const handle = () => calcPos()
    window.addEventListener('resize', handle)
    window.addEventListener('scroll', handle, true)
    return () => {
      window.removeEventListener('resize', handle)
      window.removeEventListener('scroll', handle, true)
    }
  }, [open, calcPos])

  const doSearch = useCallback((q) => {
    const kakao = window.kakao
    if (!kakao?.maps) {
      console.warn('[Search] window.kakao.maps 없음 — Kakao 스크립트 로드 확인 필요')
      setResults([])
      return
    }

    // 실제 검색 실행 (services가 준비된 후 호출)
    const runWithServices = (services) => {
      if (!services?.Places) {
        console.warn('[Search] kakao.maps.services.Places 없음 — load() 후에도 미초기화')
        setResults([])
        return
      }
      const ps = new services.Places()
      setSearching(true)

      // 정확도 기준 전국 검색
      // - radius + DISTANCE 조합은 주변 식당·가게가 실제 명소보다 상위에 오는 문제 있음
      // - ACCURACY(기본값) 사용 시 "서울역" → 서울역 역사가 1위로 정확히 노출됨
      ps.keywordSearch(q, (data, status) => {
        setSearching(false)
        if (status === services.Status.OK && data.length > 0) {
          setResults(data.slice(0, 5))
          calcPos()
          setOpen(true)
        } else {
          setResults([])
          setOpen(false)
        }
      })
    }

    const services = kakao.maps.services
    if (services?.Places) {
      runWithServices(services)
    } else {
      // autoload=false 모드: SDK 초기화 후 재실행
      console.log('[Search] kakao.maps.load() 호출 중...')
      kakao.maps.load(() => {
        console.log('[Search] kakao.maps.load() 완료')
        runWithServices(kakao.maps.services)
      })
    }
  }, [calcPos])

  const handleChange = (e) => {
    const v = e.target.value
    setQuery(v)
    clearTimeout(timerRef.current)
    if (v.trim()) {
      timerRef.current = setTimeout(() => doSearch(v), 300)
    } else {
      setResults([])
      setOpen(false)
    }
  }

  const handleSelect = (place) => {
    const name = place.place_name
    setQuery(name)
    setResults([])
    setOpen(false)
    onSelect({
      name,
      lat: parseFloat(place.y),
      lng: parseFloat(place.x),
      address: place.road_address_name || place.address_name,
    })
  }

  const handleClear = () => {
    setQuery('')
    setResults([])
    setOpen(false)
    onClear?.()
  }

  const showDropdown = open && results.length > 0 && dropPos

  return (
    <>
      <div
        ref={wrapRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: theme.surface,
          border: `1px solid ${showDropdown ? theme.primary : theme.border}`,
          borderRadius: 12,
          padding: '11px 14px',
          transition: 'border-color 0.15s',
        }}
      >
        {leadingSlot}
        <input
          value={query}
          onChange={handleChange}
          onFocus={() => {
            if (results.length > 0) { calcPos(); setOpen(true) }
          }}
          placeholder={placeholder}
          autoComplete="off"
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 14,
            color: theme.text,
          }}
        />
        {searching && (
          <div
            style={{
              width: 13, height: 13, borderRadius: '50%',
              border: `2px solid ${theme.border}`,
              borderTopColor: theme.primary,
              animation: 'spin 0.8s linear infinite',
              flexShrink: 0,
            }}
          />
        )}
        {query && !searching && (
          <button
            onClick={handleClear}
            style={{ display: 'flex', cursor: 'pointer', background: 'none', border: 'none', padding: 2 }}
          >
            <XIcon size={13} color={theme.subtext} />
          </button>
        )}
      </div>

      {showDropdown && createPortal(
        <div
          ref={dropRef}
          style={{
            position: 'fixed',
            top: dropPos.top,
            left: dropPos.left,
            width: dropPos.width,
            zIndex: 9999,
            background: theme.bg,
            border: `1px solid ${theme.primary}`,
            borderRadius: 12,
            boxShadow: '0 8px 28px rgba(0,0,0,.18)',
            overflow: 'hidden',
          }}
        >
          {results.map((place, i) => (
            <button
              key={place.id || i}
              onClick={() => handleSelect(place)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                width: '100%',
                padding: '10px 14px',
                gap: 3,
                background: 'none',
                border: 'none',
                borderBottom: i < results.length - 1 ? `1px solid ${theme.border}` : 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = theme.surface)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>
                {place.place_name}
              </span>
              {(place.road_address_name || place.address_name) && (
                <span style={{ fontSize: 11, color: theme.subtext }}>
                  {place.road_address_name || place.address_name}
                </span>
              )}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
