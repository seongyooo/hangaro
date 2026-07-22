import { useState, useRef, useCallback, useEffect } from 'react'
import KakaoMapView from '../components/map/KakaoMapView'
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
  const [sheetH, setSheetH] = useState(() => Math.round(window.innerHeight * 0.5))
  const sheetDragRef = useRef(null)
  const panelRef = useRef(null)

  // Map interaction state (local to MainPage)
  const [destPin, setDestPin] = useState(null)   // { lat, lng, name } — 지도에 목적지 핀 표시용
  const [centerOn, setCenterOn] = useState(null)

  useEffect(() => {
    const handle = () => setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT)
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [])

  const getSnapPx = useCallback((containerH) => [
    64,
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
      const next = Math.max(64, Math.min(containerH - 80, sheetDragRef.current.startH + delta))
      setSheetH(next)
    }
    const onUp = () => {
      if (!sheetDragRef.current) return
      const cur = sheetH ?? snaps[1]
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
    onClick: () => setTipNodeId(tipNodeId === n.id ? null : n.id),
  }))

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
        <button
          onClick={toggleDark}
          style={{
            width: 34, height: 34, borderRadius: '50%',
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: theme.subtext,
          }}
          aria-label="Toggle dark mode"
        >
          {dark
            ? <SunIcon size={15} color={theme.subtext} />
            : <MoonIcon size={15} color={theme.subtext} />}
        </button>
      </header>

      {/* ── Map + Panel ── */}
      <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden' }}>
        <KakaoMapView
          theme={theme}
          nodes={allNodes}
          showLocation
          centerOn={centerOn}
          onLocationFound={onLocationFound}
          onCenterChange={onCenterChange}
          style={{ flex: 1, height: '100%' }}
        />

        {/* Desktop sidebar */}
        {isDesktop && (
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
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
    const services = window.kakao?.maps?.services
    if (!services?.Places) { setResults([]); return }
    const ps = new services.Places()
    setSearching(true)

    const options = userLocation
      ? {
          location: new window.kakao.maps.LatLng(userLocation.lat, userLocation.lng),
          radius: 20000,                    // 20 km 이내 우선
          sort: services.SortBy.DISTANCE,   // 거리순 정렬
        }
      : {}

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
    }, options)
  }, [calcPos, userLocation])

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

      {showDropdown && (
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
        </div>
      )}
    </>
  )
}
