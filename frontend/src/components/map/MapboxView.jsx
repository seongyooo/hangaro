/**
 * MapboxView — Mapbox GL JS 기반 진짜 3D 지도
 *
 * 기능:
 * - pitch 50° 기본값 + 우클릭 드래그·두 손가락으로 3D 시점 자유 조작
 * - 건물 fill-extrusion 3D 렌더링
 * - 혼잡도 막대: fill-extrusion 3D 블록 (0 → 최종 높이 애니메이션)
 * - 경로: 발광 레이어 + 메인 라인 (실도로 GeoJSON)
 * - 노드: HTML 마커 (번호, 출발지, 목적지 등)
 * - GPS 현재 위치 파란 점
 *
 * 토큰 설정: frontend/.env → VITE_MAPBOX_TOKEN=pk.ey...
 */
import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { LEVEL_COLOR } from '../../App'

const MAPBOX_TOKEN   = import.meta.env.VITE_MAPBOX_TOKEN ?? ''
const SEOUL          = { lat: 37.5665, lng: 126.9780 }
const LEVEL_TO_SCORE = { quiet: 0.15, relaxed: 0.40, moderate: 0.65, crowded: 0.88 }

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────

/** lat/lng 중심 ± sizeM 미터 정사각형 폴리곤 좌표 반환 (GeoJSON ring 형식) */
function squarePolygon(lat, lng, sizeM = 42) {
  const dLat = sizeM / 111320
  const dLng = sizeM / (111320 * Math.cos((lat * Math.PI) / 180))
  const h = dLat / 2, w = dLng / 2
  return [
    [lng - w, lat - h], [lng + w, lat - h],
    [lng + w, lat + h], [lng - w, lat + h],
    [lng - w, lat - h],
  ]
}

/** 노드 마커 HTML 요소 생성 */
function buildMarkerEl(node) {
  const color = node.color || LEVEL_COLOR[node.level] || '#10b981'
  const size  = node.order != null ? 34 : 18
  const el    = document.createElement('div')
  el.style.cssText = [
    `width:${size}px;height:${size}px;border-radius:50%;`,
    `background:${color};border:3px solid white;cursor:pointer;`,
    `box-shadow:0 0 0 1.5px ${color}50,0 4px 18px ${color}70,0 2px 8px rgba(0,0,0,.22);`,
    'display:flex;align-items:center;justify-content:center;',
    'font-size:13px;font-weight:800;color:white;',
  ].join('')
  if (node.order != null) el.textContent = String(node.order)
  return el
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────

export default function MapboxView({
  theme,
  dark         = false,
  nodes        = [],
  congestionBars = [],
  showLocation = false,
  routeNodes   = null,
  routePath    = null,
  routeStrokeStyle = 'solid',
  planColor    = '#10b981',
  centerOn     = null,
  fitBoundsToNodes = false,
  onLocationFound  = null,
  onCenterChange   = null,
  style,
  children,
}) {
  const containerRef  = useRef(null)
  const mapRef        = useRef(null)
  const markersRef    = useRef([])
  const locMarkerRef  = useRef(null)
  const [ready, setReady] = useState(false)

  // ── 지도 초기화 ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!MAPBOX_TOKEN || !containerRef.current || mapRef.current) return

    mapboxgl.accessToken = MAPBOX_TOKEN

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: dark
        ? 'mapbox://styles/mapbox/dark-v11'
        : 'mapbox://styles/mapbox/streets-v12',
      center:    [SEOUL.lng, SEOUL.lat],
      zoom:      14,
      pitch:     50,
      bearing:   -10,
      antialias: true,
    })

    // 피치·방향 조작 컨트롤 (우상단) — 나침반, 줌, 피치 슬라이더
    map.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true }),
      'top-right',
    )

    map.on('load', () => {
      // 텍스트 레이어 직전에 fill-extrusion 삽입 → 도로명 텍스트가 가려지지 않음
      const firstLabelId = map.getStyle().layers.find(
        (l) => l.type === 'symbol' && l.layout?.['text-field'],
      )?.id

      // ── 건물 3D 렌더링 ──────────────────────────────────────────────────
      map.addLayer({
        id: 'hgr-3d-buildings',
        source: 'composite', 'source-layer': 'building',
        filter: ['==', 'extrude', 'true'],
        type: 'fill-extrusion',
        minzoom: 14,
        paint: {
          'fill-extrusion-color': dark ? '#1e2d3d' : '#c8d6e0',
          'fill-extrusion-height': [
            'interpolate', ['linear'], ['zoom'], 14, 0, 14.1, ['get', 'height'],
          ],
          'fill-extrusion-base': [
            'interpolate', ['linear'], ['zoom'], 14, 0, 14.1, ['get', 'min_height'],
          ],
          'fill-extrusion-opacity': dark ? 0.85 : 0.5,
        },
      }, firstLabelId)

      // ── 혼잡도 막대 소스 + 레이어 ────────────────────────────────────────
      map.addSource('hgr-bars', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'hgr-bars',
        type: 'fill-extrusion',
        source: 'hgr-bars',
        paint: {
          'fill-extrusion-color':   ['get', 'color'],
          'fill-extrusion-height':  ['get', 'height'],
          'fill-extrusion-base':    0,
          'fill-extrusion-opacity': 0.88,
          'fill-extrusion-vertical-gradient': true,
          // Mapbox 내장 트랜지션으로 부드럽게 성장
          'fill-extrusion-height-transition':  { duration: 900, delay: 80 },
          'fill-extrusion-opacity-transition': { duration: 600, delay: 0 },
        },
      }, firstLabelId)

      // ── 경로 발광 레이어 ──────────────────────────────────────────────────
      map.addSource('hgr-route-glow', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } },
      })
      map.addLayer({
        id: 'hgr-route-glow',
        type: 'line', source: 'hgr-route-glow',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': planColor, 'line-width': 16, 'line-opacity': 0.14, 'line-blur': 8 },
      })

      // ── 경로 메인 라인 ────────────────────────────────────────────────────
      map.addSource('hgr-route', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } },
      })
      map.addLayer({
        id: 'hgr-route',
        type: 'line', source: 'hgr-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color':     planColor,
          'line-width':     5,
          'line-opacity':   0.92,
          'line-dasharray': routeStrokeStyle === 'longdash' ? [4, 2] : [1],
        },
      })

      // 지도 이동 완료 시 현재 중심 좌표 전달
      if (onCenterChange) {
        map.on('moveend', () => {
          const c = map.getCenter()
          onCenterChange(c.lat, c.lng)
        })
        const c = map.getCenter()
        onCenterChange(c.lat, c.lng)
      }

      setReady(true)
    })

    // GPS 콜백이 참조할 수 있도록 load 이벤트 등록 전에 먼저 저장
    mapRef.current = map

    // GPS 현재 위치
    if (showLocation) {
      navigator.geolocation?.getCurrentPosition(
        ({ coords }) => {
          // cleanup 이후(map.remove() 호출됨)에 콜백이 늦게 도착하면 무시
          if (!mapRef.current) return
          const pos = { lat: coords.latitude, lng: coords.longitude }
          mapRef.current.setCenter([pos.lng, pos.lat])
          onLocationFound?.(pos.lat, pos.lng)

          const el = document.createElement('div')
          el.style.cssText = [
            'width:16px;height:16px;border-radius:50%;',
            'background:#3b82f6;border:3px solid white;',
            'box-shadow:0 2px 12px rgba(59,130,246,.75);',
          ].join('')
          locMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat([pos.lng, pos.lat])
            .addTo(mapRef.current)
        },
        () => {},
        { timeout: 8000, maximumAge: 300000 },
      )
    }

    return () => {
      markersRef.current.forEach((m) => m.remove())
      locMarkerRef.current?.remove()
      map.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 컨테이너 리사이즈 감지 → 지도 canvas 크기 갱신 ──────────────────────────
  // flex 레이아웃 확정 후 Mapbox가 올바른 크기로 렌더링되게 함
  useEffect(() => {
    if (!ready || !containerRef.current) return
    const ro = new ResizeObserver(() => {
      mapRef.current?.resize()
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [ready])

  // ── centerOn 변경 → 지도 이동 ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !centerOn) return
    mapRef.current.flyTo({ center: [centerOn.lng, centerOn.lat], duration: 700 })
  }, [centerOn])

  // ── 혼잡도 막대 업데이트 ───────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map?.getSource('hgr-bars')) return

    const features = congestionBars
      .filter((n) => n.lat != null && n.lng != null)
      .map((n) => ({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [squarePolygon(n.lat, n.lng, 42)] },
        properties: {
          height: Math.max(20, Math.round(
            (n.congestionScore ?? LEVEL_TO_SCORE[n.level] ?? 0.5) * 210,
          )),
          color: n.color || LEVEL_COLOR[n.level] || '#10b981',
        },
      }))

    // 높이 0 → 데이터 세팅 → 최종 높이 (Mapbox 트랜지션이 성장 애니메이션 처리)
    map.setPaintProperty('hgr-bars', 'fill-extrusion-height', 0)
    map.setPaintProperty('hgr-bars', 'fill-extrusion-opacity', 0)
    map.getSource('hgr-bars').setData({ type: 'FeatureCollection', features })

    // 두 프레임 대기 후 최종값으로 전환 → transition 발동
    requestAnimationFrame(() => requestAnimationFrame(() => {
      map.setPaintProperty('hgr-bars', 'fill-extrusion-height', ['get', 'height'])
      map.setPaintProperty('hgr-bars', 'fill-extrusion-opacity', 0.88)
    }))
  }, [ready, congestionBars])

  // ── 노드 HTML 마커 업데이트 ────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return

    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    // congestionBars로 이미 표현된 노드는 HTML 마커로 중복 표시 안 함
    const barIds = new Set(congestionBars.map((b) => b.id))

    nodes
      .filter((n) => !barIds.has(n.id) && n.lat != null && n.lng != null)
      .forEach((node) => {
        const el = buildMarkerEl(node)
        if (node.onClick) el.addEventListener('click', node.onClick)
        const m = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([node.lng, node.lat])
          .addTo(map)
        markersRef.current.push(m)
      })
  }, [ready, nodes, congestionBars])

  // ── 경로 업데이트 ─────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map?.getSource('hgr-route')) return

    const raw    = routePath?.length >= 2
      ? routePath
      : routeNodes?.filter((n) => n.lat != null && n.lng != null) ?? []
    const coords = raw.map((p) => [p.lng, p.lat])
    const geojson = { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } }

    map.getSource('hgr-route').setData(geojson)
    map.getSource('hgr-route-glow').setData(geojson)
    map.setPaintProperty('hgr-route', 'line-color', planColor)
    map.setPaintProperty('hgr-route-glow', 'line-color', planColor)
    map.setPaintProperty('hgr-route', 'line-dasharray',
      routeStrokeStyle === 'longdash' ? [4, 2] : [1])
  }, [ready, routeNodes, routePath, planColor, routeStrokeStyle])

  // ── fitBounds ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !fitBoundsToNodes || !routeNodes?.length) return
    const bounds = new mapboxgl.LngLatBounds()
    routeNodes.filter((n) => n.lat != null).forEach((n) => bounds.extend([n.lng, n.lat]))
    try { map.fitBounds(bounds, { padding: 100, pitch: 50, duration: 900 }) } catch (_) {}
  }, [ready, fitBoundsToNodes, routeNodes])

  // ── 토큰 없음 안내 ────────────────────────────────────────────────────────
  if (!MAPBOX_TOKEN) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: theme?.mapBg ?? '#eef2f0',
        color: theme?.subtext ?? '#6b7280',
        fontSize: 12, gap: 8, padding: 24, textAlign: 'center',
        ...style,
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: theme?.text ?? '#111827' }}>
          3D 지도 설정 필요
        </div>
        <div>mapbox.com에서 무료 계정을 만들고 토큰을 발급받으세요</div>
        <code style={{
          background: theme?.surface ?? '#f9fafb',
          padding: '4px 10px', borderRadius: 6, fontSize: 11, marginTop: 4,
        }}>
          frontend/.env → VITE_MAPBOX_TOKEN=pk.ey...
        </code>
        {children}
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden', alignSelf: 'stretch', ...style }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      {children}
    </div>
  )
}
