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
import { LEVEL_COLOR, LEVEL_LABEL } from '../../App'

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

// ── Callout 카드 마커 빌더 ───────────────────────────────────────────────────
// 구조: 3D CSS perspective 카드 → 수직 stem → 좌표 dot
// hover transform 없음 — Mapbox 마커 위치 계산과 충돌 방지
function buildCalloutEl(pin, color) {
  // ── 최상위 래퍼: pointer-events none, 레이아웃만 담당 ──────────────────
  const wrap = document.createElement('div')
  wrap.style.cssText = [
    'display:flex;flex-direction:column;align-items:center;',
    'pointer-events:none;',   // 마우스 이벤트는 카드에서만
  ].join('')

  // ── 카드: 3D perspective 기울기 ──────────────────────────────────────────
  const card = document.createElement('div')
  card.style.cssText = [
    'width:130px;border-radius:14px;overflow:hidden;',
    'pointer-events:auto;cursor:pointer;',
    // 3D perspective — 카드가 공중에서 앞으로 기울어 보이는 효과
    'transform:perspective(500px) rotateX(6deg);',
    'transform-origin:bottom center;',
    // 깊이감 그림자 (여러 레이어)
    'box-shadow:',
    '  0 2px 0 rgba(0,0,0,0.06),',
    '  0 6px 16px rgba(0,0,0,0.18),',
    '  0 20px 40px rgba(0,0,0,0.22);',
    // 등장 애니메이션
    'animation:calloutFadeIn 0.45s cubic-bezier(0.34,1.4,0.64,1) both;',
  ].join('')

  // 클릭 이벤트가 지도로 전파되지 않도록 차단
  card.addEventListener('mousedown', (e) => e.stopPropagation())
  card.addEventListener('click',     (e) => e.stopPropagation())

  // ── 사진 영역 ────────────────────────────────────────────────────────────
  const photoWrap = document.createElement('div')
  photoWrap.style.cssText = 'position:relative;width:130px;height:86px;overflow:hidden;background:#1e293b;'

  if (pin.image) {
    const img = document.createElement('img')
    img.src   = pin.image
    img.alt   = pin.name
    // loading=lazy: 뷰포트 밖에서는 로딩하지 않음
    img.loading = 'lazy'
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;'
    photoWrap.appendChild(img)
  }

  // 사진 위 그라데이션 오버레이 — 텍스트 가독성 확보
  const overlay = document.createElement('div')
  overlay.style.cssText = [
    'position:absolute;inset:0;',
    'background:linear-gradient(to bottom,transparent 25%,rgba(0,0,0,0.72) 100%);',
  ].join('')
  photoWrap.appendChild(overlay)

  // ── 이름 + 혼잡도 배지 (사진 위 오버레이) ────────────────────────────────
  const infoRow = document.createElement('div')
  infoRow.style.cssText = [
    'position:absolute;bottom:0;left:0;right:0;',
    'padding:7px 9px 8px;',
    'display:flex;align-items:flex-end;justify-content:space-between;gap:4px;',
  ].join('')

  const nameEl = document.createElement('span')
  nameEl.style.cssText = [
    'font-size:12px;font-weight:800;color:white;',
    'letter-spacing:-0.4px;line-height:1.25;',
    'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
    'text-shadow:0 1px 4px rgba(0,0,0,0.5);',
  ].join('')
  nameEl.textContent = pin.name

  const badge = document.createElement('span')
  badge.style.cssText = [
    `background:${color};color:white;`,
    'font-size:9.5px;font-weight:700;',
    'padding:2px 6px;border-radius:6px;flex-shrink:0;',
    'letter-spacing:-0.2px;',
  ].join('')
  badge.textContent = LEVEL_LABEL[pin.level] || ''

  infoRow.appendChild(nameEl)
  infoRow.appendChild(badge)
  photoWrap.appendChild(infoRow)
  card.appendChild(photoWrap)

  // ── 수직 stem ─────────────────────────────────────────────────────────────
  const stem = document.createElement('div')
  stem.style.cssText = [
    'width:2px;height:28px;',
    `background:linear-gradient(to bottom,${color}dd,${color}11);`,
  ].join('')

  // ── 좌표 dot ──────────────────────────────────────────────────────────────
  const dot = document.createElement('div')
  dot.style.cssText = [
    'width:8px;height:8px;border-radius:50%;flex-shrink:0;',
    `background:${color};border:2px solid white;`,
    `box-shadow:0 0 0 2px ${color}44,0 2px 6px ${color}66;`,
  ].join('')

  wrap.appendChild(card)
  wrap.appendChild(stem)
  wrap.appendChild(dot)
  return wrap
}

export default function MapboxView({
  theme,
  dark         = false,
  nodes        = [],
  congestionBars = [],
  attractionPins = [],   // 관광지 callout 카드 핀 [{id,name,lat,lng,image,level},...]
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
  const calloutRef    = useRef([])   // callout 카드 마커 목록
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
      // 대한민국 영역으로 패닝 제한
      maxBounds: [[124.5, 33.0], [132.0, 38.9]],
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
      calloutRef.current.forEach((m) => m.remove())
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

  // ── 관광지 Callout 카드 마커 생성 ───────────────────────────────────────
  const CALLOUT_MIN_ZOOM = 13  // 이 줌 레벨 미만에서는 카드 숨김

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return

    calloutRef.current.forEach((m) => m.remove())
    calloutRef.current = []

    const visible = map.getZoom() >= CALLOUT_MIN_ZOOM

    attractionPins
      .filter((p) => p.lat != null && p.lng != null)
      .forEach((pin) => {
        const color = LEVEL_COLOR[pin.level] || '#10b981'
        const el = buildCalloutEl(pin, color)

        el.style.display = visible ? 'flex' : 'none'

        if (pin.onClick) el.addEventListener('click', (e) => { e.stopPropagation(); pin.onClick() })

        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([pin.lng, pin.lat])
          .addTo(map)
        calloutRef.current.push(marker)
      })
  }, [ready, attractionPins])

  // ── 줌아웃 시 callout 카드 숨김 ──────────────────────────────────────────
  // 'zoom' 이벤트: 스크롤 중에도 실시간 발화 → 즉각 숨김/표시
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return

    const onZoom = () => {
      const show = map.getZoom() >= CALLOUT_MIN_ZOOM
      calloutRef.current.forEach((m) => {
        m.getElement().style.display = show ? 'flex' : 'none'
      })
    }

    map.on('zoom', onZoom)
    return () => map.off('zoom', onZoom)
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

    // congestionBars 또는 attractionPins로 이미 표현된 노드는 중복 표시 안 함
    const barIds = new Set([
      ...congestionBars.map((b) => b.id),
      ...attractionPins.map((p) => p.id),
    ])

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
  }, [ready, nodes, congestionBars, attractionPins])

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
