import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import SmartMapView from '../components/map/SmartMapView'
import {
  WalkIcon, TransitIcon, CarIcon, MapPinIcon,
  PlusIcon, XIcon, SunIcon, MoonIcon,
} from '../components/ui/Icons'
import {
  IDLE_NODES,
  LEVEL_COLOR,
  LEVEL_LABEL,
} from '../App'

const DESKTOP_BREAKPOINT = 768
const SHEET_CLOSED = 28

const TRANSPORT_MODES = [
  { id: 'walk',    label: '도보',    Icon: WalkIcon },
  { id: 'transit', label: '대중교통', Icon: TransitIcon },
  { id: 'car',     label: '차',      Icon: CarIcon },
]

const CONGESTION_DESC = {
  quiet:    '지금 방문하기 좋아요. 여유롭게 즐길 수 있어요.',
  relaxed:  '여유로운 편이에요. 좋은 방문 타이밍이에요.',
  moderate: '적당히 붐빕니다. 이른 아침이나 저녁 방문을 추천해요.',
  crowded:  '지금 매우 붐비고 있어요. Plan A 코스를 이용하면 혼잡이 풀릴 때 방문할 수 있어요.',
}

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
  const [sheetH, setSheetH] = useState(() => Math.round(window.innerHeight * 0.46))
  const sheetDragRef = useRef(null)

  const [destPin, setDestPin] = useState(null)
  const [centerOn, setCenterOn] = useState(null)
  const [selectedSpot, setSelectedSpot] = useState(null)

  useEffect(() => {
    const handle = () => setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT)
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [])

  const getSnapPx = useCallback((containerH) => [
    SHEET_CLOSED,
    Math.round(containerH * 0.46),
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
      sheetDragRef.current.curH = next
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

  const handlePinClick = useCallback((pin) => {
    setSelectedSpot((prev) => (prev?.id === pin.id ? null : pin))
    setTipNodeId((prev) => (prev === pin.id ? null : pin.id))
    if (!isDesktop) {
      setSheetH(Math.round(window.innerHeight * 0.46))
    }
  }, [isDesktop, setTipNodeId])

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

  const handleWaypointSelect = useCallback((id, place) => {
    updateWaypoint(id, { name: place.name, lat: place.lat, lng: place.lng })
    setCenterOn({ lat: place.lat, lng: place.lng })
  }, [updateWaypoint])

  const handleSetSpotAsDestination = useCallback((spot) => {
    setDestination(spot.name)
    setDestinationLatLng({ lat: spot.lat, lng: spot.lng })
    setDestPin({ lat: spot.lat, lng: spot.lng, name: spot.name })
    setCenterOn({ lat: spot.lat, lng: spot.lng })
    setSelectedSpot(null)
  }, [setDestination, setDestinationLatLng])

  const hasDestOrWp = !!destination || waypoints.some((w) => w.name)

  // Map nodes
  const idleNodes = IDLE_NODES.map((n) => ({
    ...n,
    color: LEVEL_COLOR[n.level],
    levelLabel: LEVEL_LABEL[n.level],
    pulseDur: n.level === 'crowded' ? '0.9s' : n.level === 'moderate' ? '1.3s' : '2.1s',
    showTip: tipNodeId === n.id,
    onClick: () => handlePinClick(n),
  }))

  const attractionPins = useMemo(() =>
    IDLE_NODES.map((n) => ({
      id:    n.id,
      name:  n.name,
      lat:   n.lat,
      lng:   n.lng,
      level: n.level,
      image: n.image,
    })),
  [])

  const destNode = destPin
    ? [{ id: '__dest__', lat: destPin.lat, lng: destPin.lng, name: destination,
         pulse: false, color: '#ef4444', showTip: true, levelLabel: '목적지' }]
    : []

  const allNodes = [...idleNodes, ...destNode]

  const mapPanel = (
    <SmartMapView
      theme={theme}
      dark={dark}
      nodes={allNodes}
      congestionBars={idleNodes}
      attractionPins={attractionPins}
      onPinClick={handlePinClick}
      showLocation
      centerOn={centerOn}
      onLocationFound={onLocationFound}
      onCenterChange={onCenterChange}
      style={{ flex: 1, minWidth: 0 }}
    />
  )

  const panelContent = selectedSpot ? (
    <SpotMiniPanel
      theme={theme}
      spot={selectedSpot}
      onClose={() => setSelectedSpot(null)}
      onSetDestination={handleSetSpotAsDestination}
    />
  ) : (
    <SearchPanel
      theme={theme}
      transport={transport}
      setTransport={setTransport}
      searchCenter={searchCenter}
      destination={destination}
      onDestinationSelect={handleDestinationSelect}
      onDestinationClear={handleDestinationClear}
      waypoints={waypoints}
      onWaypointSelect={handleWaypointSelect}
      addWaypoint={addWaypoint}
      removeWaypoint={removeWaypoint}
      hasDestOrWp={hasDestOrWp}
      startSearch={startSearch}
    />
  )

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Header */}
      <header style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px 10px',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        background: theme.headerGlass,
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: theme.text, letterSpacing: '-0.4px' }}>
            HanGaRo
          </div>
          <div style={{ fontSize: 11, color: theme.subtext, marginTop: 1 }}>
            실시간 혼잡도 기반 여행 코스 추천
          </div>
        </div>
        <button onClick={toggleDark} style={{
          width: 34, height: 34, borderRadius: '50%',
          background: theme.surface, border: `1px solid ${theme.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          {dark ? <SunIcon size={15} color={theme.subtext} /> : <MoonIcon size={15} color={theme.subtext} />}
        </button>
      </header>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {mapPanel}

        {/* Desktop sidebar */}
        {isDesktop && (
          <div style={{
            width: 360, height: '100%',
            background: theme.bg, borderLeft: `1px solid ${theme.border}`,
            display: 'flex', flexDirection: 'column',
            paddingTop: 64, overflow: 'visible',
          }}>
            {panelContent}
          </div>
        )}
      </div>

      {/* Mobile bottom sheet */}
      {!isDesktop && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          height: sheetH,
          background: theme.bg,
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -8px 32px rgba(0,0,0,.15)',
          display: 'flex', flexDirection: 'column', zIndex: 20,
          touchAction: 'none',
          transition: sheetDragRef.current ? 'none' : 'height 0.25s ease',
        }}>
          <div
            onPointerDown={onHandlePointerDown}
            style={{ padding: '10px 0 4px', display: 'flex', justifyContent: 'center', cursor: 'grab' }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 3, background: theme.border }} />
          </div>
          <div style={{
            flex: 1, overflow: 'hidden',
            display: sheetH <= SHEET_CLOSED ? 'none' : 'flex',
            flexDirection: 'column',
          }}>
            {panelContent}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Search Panel ──────────────────────────────────────────────────────────────
function SearchPanel({
  theme, transport, setTransport, searchCenter,
  destination, onDestinationSelect, onDestinationClear,
  waypoints, onWaypointSelect, addWaypoint, removeWaypoint,
  hasDestOrWp, startSearch,
}) {
  return (
    <div style={{
      padding: '20px 18px 24px', display: 'flex', flexDirection: 'column',
      gap: 14, flex: 1, overflowY: 'auto',
    }}>
      {/* Heading */}
      <div>
        <div style={{ fontSize: 17, fontWeight: 700, color: theme.text, marginBottom: 4 }}>
          어디 가고 싶으세요?
        </div>
        <div style={{ fontSize: 12, color: theme.subtext }}>
          목적지를 입력하거나, 바로 추천받을 수 있어요
        </div>
      </div>

      {/* Destination */}
      <PlaceSearchInput
        theme={theme}
        placeholder="목적지 검색..."
        value={destination}
        onSelect={onDestinationSelect}
        onClear={onDestinationClear}
        userLocation={searchCenter}
        leadingSlot={<MapPinIcon size={15} color={theme.primary} />}
      />

      {/* Waypoints */}
      {waypoints.map((wp) =>
        wp.name ? (
          <div key={wp.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: theme.surface, border: `1px solid ${theme.border}`,
            borderRadius: 12, padding: '11px 14px',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 14, color: theme.text }}>{wp.name}</span>
            <button onClick={() => removeWaypoint(wp.id)} style={{
              display: 'flex', cursor: 'pointer', background: 'none', border: 'none', padding: 2,
            }}>
              <XIcon size={13} color={theme.subtext} />
            </button>
          </div>
        ) : (
          <PlaceSearchInput
            key={wp.id} theme={theme} placeholder="경유지 검색..." value=""
            onSelect={(place) => onWaypointSelect(wp.id, place)}
            onClear={() => removeWaypoint(wp.id)}
            userLocation={searchCenter}
            leadingSlot={<div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />}
          />
        )
      )}

      {/* Add waypoint */}
      <button onClick={addWaypoint} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        color: theme.subtext, fontSize: 13, cursor: 'pointer',
        background: 'none', border: 'none', padding: 0, width: 'fit-content',
      }}>
        <PlusIcon size={13} color={theme.subtext} />
        경유지 추가
      </button>

      {/* Transport */}
      <div style={{ display: 'flex', background: theme.surface, borderRadius: 12, padding: 3, gap: 2 }}>
        {TRANSPORT_MODES.map(({ id, label, Icon }) => {
          const active = transport === id
          return (
            <button key={id} onClick={() => setTransport(id)} style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 4,
              padding: '8px 0', borderRadius: 9, fontSize: 11, fontWeight: 600,
              cursor: 'pointer', border: 'none',
              background: active ? theme.bg : 'transparent',
              color: active ? theme.text : theme.subtext,
              boxShadow: active ? '0 1px 4px rgba(0,0,0,.10)' : 'none',
              transition: 'all 0.15s',
            }}>
              <Icon size={16} color={active ? theme.text : theme.subtext} />
              {label}
            </button>
          )
        })}
      </div>

      {/* CTA */}
      <button onClick={startSearch} style={{
        marginTop: 4,
        background: theme.primary, color: 'white',
        padding: '15px 0', borderRadius: 12,
        fontSize: 14, fontWeight: 700, cursor: 'pointer', border: 'none', width: '100%',
      }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
      >
        {hasDestOrWp ? '경로 찾기 →' : '조용한 코스 추천받기 →'}
      </button>

      {/* Congestion legend */}
      <CongestionLegend theme={theme} />
    </div>
  )
}

// ── Spot Mini Panel ───────────────────────────────────────────────────────────
function SpotMiniPanel({ theme, spot, onClose, onSetDestination }) {
  const color   = LEVEL_COLOR[spot.level] || '#6b7280'
  const label   = LEVEL_LABEL[spot.level] || '보통'
  const desc    = CONGESTION_DESC[spot.level] || ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px 12px', display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: `1px solid ${theme.border}`,
      }}>
        <button onClick={onClose} style={{
          width: 30, height: 30, borderRadius: 8, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: theme.surface, border: `1px solid ${theme.border}`, cursor: 'pointer', flexShrink: 0,
        }}>
          <XIcon size={13} color={theme.subtext} />
        </button>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: theme.text }}>{spot.name}</span>
        <span style={{
          fontSize: 11, fontWeight: 700, color, background: color + '18',
          padding: '3px 10px', borderRadius: 20,
        }}>
          {label}
        </span>
      </div>

      {/* Image */}
      {spot.image && (
        <div style={{ position: 'relative', height: 150, overflow: 'hidden', flexShrink: 0 }}>
          <img
            src={spot.image} alt={spot.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          {/* Congestion overlay */}
          <div style={{
            position: 'absolute', bottom: 10, right: 10,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
            borderRadius: 20, padding: '4px 10px',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>현재 {label}</span>
          </div>
        </div>
      )}

      {/* Description */}
      <div style={{ padding: '16px', flex: 1 }}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: theme.text }}>{desc}</p>
      </div>

      {/* CTA */}
      <div style={{ padding: '0 16px 20px' }}>
        <button
          onClick={() => onSetDestination(spot)}
          style={{
            width: '100%', padding: '13px 0', borderRadius: 12,
            background: theme.primary, color: 'white',
            fontSize: 14, fontWeight: 700, cursor: 'pointer', border: 'none',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          {spot.name} 목적지로 설정 →
        </button>
      </div>
    </div>
  )
}

// ── Congestion Legend ─────────────────────────────────────────────────────────
function CongestionLegend({ theme }) {
  const items = [
    { label: '한적', color: '#10b981' },
    { label: '여유', color: '#f59e0b' },
    { label: '보통', color: '#f97316' },
    { label: '혼잡', color: '#ef4444' },
  ]
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 14, paddingTop: 4,
      borderTop: `1px solid ${theme.border}`, marginTop: 'auto',
    }}>
      <span style={{ fontSize: 11, color: theme.subtext }}>혼잡도</span>
      {items.map(({ label, color }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: theme.subtext }}>{label}</span>
        </div>
      ))}
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

  useEffect(() => {
    const handler = (e) => {
      const inWrap = wrapRef.current?.contains(e.target)
      const inDrop = dropRef.current?.contains(e.target)
      if (!inWrap && !inDrop) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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
    if (!kakao?.maps) return
    const runWithServices = (services) => {
      if (!services?.Places) return
      const ps = new services.Places()
      setSearching(true)
      ps.keywordSearch(q, (data, status) => {
        setSearching(false)
        if (status === services.Status.OK && data.length > 0) {
          setResults(data.slice(0, 5)); calcPos(); setOpen(true)
        } else {
          setResults([]); setOpen(false)
        }
      })
    }
    const services = kakao.maps.services
    if (services?.Places) runWithServices(services)
    else kakao.maps.load(() => runWithServices(kakao.maps.services))
  }, [calcPos])

  const handleChange = (e) => {
    const v = e.target.value; setQuery(v)
    clearTimeout(timerRef.current)
    if (v.trim()) timerRef.current = setTimeout(() => doSearch(v), 300)
    else { setResults([]); setOpen(false) }
  }

  const handleSelect = (place) => {
    setQuery(place.place_name); setResults([]); setOpen(false)
    onSelect({ name: place.place_name, lat: parseFloat(place.y), lng: parseFloat(place.x),
      address: place.road_address_name || place.address_name })
  }

  const handleClear = () => { setQuery(''); setResults([]); setOpen(false); onClear?.() }
  const showDropdown = open && results.length > 0 && dropPos

  return (
    <>
      <div ref={wrapRef} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: theme.surface, border: `1px solid ${showDropdown ? theme.primary : theme.border}`,
        borderRadius: 12, padding: '12px 14px', transition: 'border-color 0.15s',
      }}>
        {leadingSlot}
        <input
          value={query} onChange={handleChange}
          onFocus={() => { if (results.length > 0) { calcPos(); setOpen(true) } }}
          placeholder={placeholder} autoComplete="off"
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: theme.text }}
        />
        {searching && (
          <div style={{
            width: 13, height: 13, borderRadius: '50%',
            border: `2px solid ${theme.border}`, borderTopColor: theme.primary,
            animation: 'spin 0.8s linear infinite', flexShrink: 0,
          }} />
        )}
        {query && !searching && (
          <button onClick={handleClear} style={{ display: 'flex', cursor: 'pointer', background: 'none', border: 'none', padding: 2 }}>
            <XIcon size={13} color={theme.subtext} />
          </button>
        )}
      </div>

      {showDropdown && createPortal(
        <div ref={dropRef} style={{
          position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width,
          zIndex: 9999, background: theme.bg, border: `1px solid ${theme.primary}`,
          borderRadius: 12, boxShadow: '0 8px 28px rgba(0,0,0,.18)', overflow: 'hidden',
        }}>
          {results.map((place, i) => (
            <button key={place.id || i} onClick={() => handleSelect(place)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
              width: '100%', padding: '10px 14px', gap: 3, background: 'none', border: 'none',
              borderBottom: i < results.length - 1 ? `1px solid ${theme.border}` : 'none',
              cursor: 'pointer', textAlign: 'left',
            }}
              onMouseEnter={(e) => (e.currentTarget.style.background = theme.surface)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{place.place_name}</span>
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
