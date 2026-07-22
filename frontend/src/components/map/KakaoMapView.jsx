/**
 * KakaoMapView
 * - GPS + SDK 병렬 로드 → GPS 위치로 지도 생성 (서울 선로딩 없음)
 * - idle 이벤트로 현재 지도 중심 추적 → 검색 기준으로 사용
 * - VITE_KAKAO_MAP_KEY 없으면 MapCanvas 플레이스홀더로 폴백
 */
import { useEffect, useRef, useState } from 'react'
import MapCanvas from './MapCanvas'
import { LEVEL_COLOR, LEVEL_LABEL, MAP_BLOCKS } from '../../App'

// ── 3D 막대 렌더링 헬퍼 ─────────────────────────────────────────────────────
const LEVEL_TO_SCORE = { quiet: 0.15, relaxed: 0.40, moderate: 0.65, crowded: 0.88 }

function hexRgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
}
function shadeHex(hex, amt) {
  return 'rgb(' + hexRgb(hex).map((v) => Math.max(0, Math.min(255, v + amt))).join(',') + ')'
}

function buildBarContent(node, index) {
  const score     = node.congestionScore ?? LEVEL_TO_SCORE[node.level] ?? 0.5
  const main      = node.color || '#10b981'
  const light     = shadeHex(main, 60)
  const side      = shadeHex(main, -50)
  const [r, g, b] = hexRgb(main)
  const glow      = `rgba(${r},${g},${b},0.38)`
  const barH      = Math.max(12, Math.round(score * 72))

  // ── 최상위 래퍼 ──────────────────────────────────────────────────
  const wrap = document.createElement('div')
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;pointer-events:none;'

  // ── 이름 칩 (막대 최상단) ────────────────────────────────────────
  const nameChip = document.createElement('div')
  nameChip.style.cssText = [
    'font-size:9px;font-weight:700;',
    `color:${main};`,
    'background:rgba(255,255,255,0.92);',
    'padding:2px 7px;border-radius:10px;margin-bottom:4px;',
    'white-space:nowrap;max-width:80px;overflow:hidden;text-overflow:ellipsis;text-align:center;',
    'box-shadow:0 2px 8px rgba(0,0,0,.1);',
  ].join('')
  nameChip.textContent = node.name || ''

  // ── 상단 캡 (3D 박스의 윗면처럼 보이게) ─────────────────────────
  const cap = document.createElement('div')
  cap.style.cssText = [
    'width:28px;height:6px;',
    `background:${light};`,
    'border-radius:3px 3px 0 0;',
    `box-shadow:6px -3px 0 ${side};`,
  ].join('')

  // ── 막대 본체 (전면 + 우측면 그림자로 3D 효과) ──────────────────
  const bar = document.createElement('div')
  bar.className = 'bar-grow'
  bar.style.cssText = [
    `width:22px;height:${barH}px;`,
    `background:linear-gradient(to bottom,${light} 0%,${main} 100%);`,
    `box-shadow:6px 0 0 ${side},0 8px 24px ${glow};`,
    'border-radius:0 0 2px 2px;',
    `animation-delay:${index * 90}ms;`,
    'transform-origin:bottom center;',
  ].join('')

  // ── 하단 여백 (기존 dot 노드를 가리지 않게) ─────────────────────
  const spacer = document.createElement('div')
  spacer.style.cssText = 'height:11px;'

  wrap.appendChild(nameChip)
  wrap.appendChild(cap)
  wrap.appendChild(bar)
  wrap.appendChild(spacer)
  return wrap
}

const KAKAO_APP_KEY = import.meta.env.VITE_KAKAO_MAP_KEY ?? ''
const SEOUL = { lat: 37.5665, lng: 126.9780 }

// SDK는 index.html에서 로드됨 — window.kakao가 준비될 때까지 대기
let sdkPromise = null
function waitForKakaoSDK() {
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve, reject) => {
    if (window.kakao?.maps?.Map) { resolve(); return }
    if (window.kakao?.maps) { window.kakao.maps.load(resolve); return }
    let waited = 0
    const timer = setInterval(() => {
      waited += 100
      if (window.kakao?.maps) {
        clearInterval(timer)
        window.kakao.maps.load(resolve)
      } else if (waited >= 10000) {
        clearInterval(timer)
        sdkPromise = null
        reject(new Error('Kakao SDK 로드 타임아웃'))
      }
    }, 100)
  })
  return sdkPromise
}

// GPS 현재 위치 요청 — maximumAge로 캐시 우선 사용 (빠름)
function requestGPS(timeoutMs = 5000) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude }),
      () => resolve(null),
      { timeout: timeoutMs, maximumAge: 300000, enableHighAccuracy: false }
    )
  })
}

export default function KakaoMapView({
  theme,
  nodes = [],
  showLocation = false,
  routeNodes = null,
  routePath = null,           // 실도로 경로 좌표 [{lat,lng},...] — 있으면 직선 대신 사용
  routeStrokeStyle = 'solid', // 선 스타일: 'solid'(실선) | 'longdash'(대중교통 점선)
  congestionBars = [],    // 3D 혼잡도 막대를 표시할 노드 [{lat,lng,name,level,congestionScore?},...]
  planColor = '#22c55e',
  centerOn = null,
  fitBoundsToNodes = false,
  onLocationFound = null,
  onCenterChange = null,
  style,
  children,
}) {
  const mapDivRef      = useRef(null)
  const mapRef         = useRef(null)
  const overlaysRef    = useRef([])
  const polylineRef    = useRef(null)
  const polylineGlowRef = useRef(null)  // 발광 레이어 (실도로 경로 위에 겹쳐서 글로우 효과)
  const barOverlaysRef  = useRef([])            // 3D 혼잡도 막대 오버레이 목록
  const locOverlayRef  = useRef(null)
  const [ready, setReady]     = useState(false)
  const [error, setError]     = useState(null)
  const [gpsLoc, setGpsLoc]   = useState(null)  // GPS 해결 후 blue dot 트리거

  // ── 지도 초기화 (GPS + SDK 병렬) ────────────────────────────────────────────
  useEffect(() => {
    if (!KAKAO_APP_KEY) return
    let cancelled = false

    // GPS는 showLocation일 때만, 최대 3초까지 기다린 뒤 지도 생성
    const gpsPromise = showLocation
      ? Promise.race([requestGPS(5000), new Promise((r) => setTimeout(() => r(null), 3000))])
      : Promise.resolve(null)

    Promise.all([waitForKakaoSDK(), gpsPromise])
      .then(([, gpsPos]) => {
        if (cancelled || !mapDivRef.current || mapRef.current) return

        const initialCenter = gpsPos || SEOUL

        requestAnimationFrame(() => {
          if (cancelled || !mapDivRef.current || mapRef.current) return
          try {
            const kakao = window.kakao
            const map = new kakao.maps.Map(mapDivRef.current, {
              center: new kakao.maps.LatLng(initialCenter.lat, initialCenter.lng),
              level: 5,
            })
            map.relayout()
            mapRef.current = map
            setReady(true)

            // 지도 이동 완료(idle) 시 현재 중심 좌표 전달
            if (onCenterChange) {
              kakao.maps.event.addListener(map, 'idle', () => {
                const c = map.getCenter()
                onCenterChange(c.getLat(), c.getLng())
              })
              // 초기 중심도 바로 전달
              onCenterChange(initialCenter.lat, initialCenter.lng)
            }

            if (gpsPos) {
              setGpsLoc(gpsPos)
              onLocationFound?.(gpsPos.lat, gpsPos.lng)
            } else if (showLocation) {
              // 3초 안에 GPS 응답 없으면 백그라운드에서 계속 기다림
              requestGPS(10000).then((pos) => {
                if (!pos || cancelled || !mapRef.current) return
                mapRef.current.setCenter(
                  new window.kakao.maps.LatLng(pos.lat, pos.lng)
                )
                setGpsLoc(pos)
                onLocationFound?.(pos.lat, pos.lng)
                onCenterChange?.(pos.lat, pos.lng)
              })
            }
          } catch (e) {
            console.error('[KakaoMapView] Map creation failed:', e)
            setError(e.message || 'Map creation failed')
          }
        })
      })
      .catch((e) => {
        console.error('[KakaoMapView] SDK load failed:', e)
        setError('SDK load failed — 도메인이 등록되었는지 확인하세요')
      })

    return () => {
      cancelled = true
      overlaysRef.current.forEach((o) => o.setMap(null))
      barOverlaysRef.current.forEach((o) => o.setMap(null))
      if (polylineGlowRef.current) polylineGlowRef.current.setMap(null)
      if (polylineRef.current) polylineRef.current.setMap(null)
      if (locOverlayRef.current) locOverlayRef.current.setMap(null)
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 지도 중심 이동 (장소 선택 시) ───────────────────────────────────────────
  useEffect(() => {
    if (!ready || !mapRef.current || !centerOn) return
    mapRef.current.panTo(new window.kakao.maps.LatLng(centerOn.lat, centerOn.lng))
  }, [ready, centerOn])

  // ── 컨테이너 리사이즈 ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready || !mapDivRef.current) return
    const ro = new ResizeObserver(() => mapRef.current?.relayout())
    ro.observe(mapDivRef.current)
    return () => ro.disconnect()
  }, [ready])

  // ── 현재 위치 오버레이 (파란 점) ────────────────────────────────────────────
  useEffect(() => {
    if (!ready || !mapRef.current || !showLocation || !gpsLoc) return
    const kakao = window.kakao

    if (locOverlayRef.current) locOverlayRef.current.setMap(null)

    const wrap = document.createElement('div')
    wrap.style.cssText = 'position:relative;width:14px;height:14px;'

    const ring = document.createElement('div')
    ring.className = 'ripple-wave'
    ring.style.cssText = 'position:absolute;inset:-14px;border-radius:50%;border:2px solid #3b82f6;pointer-events:none;'
    wrap.appendChild(ring)

    const dot = document.createElement('div')
    dot.style.cssText = 'position:absolute;inset:0;border-radius:50%;background:#3b82f6;border:2px solid white;box-shadow:0 2px 6px rgba(59,130,246,.5);'
    wrap.appendChild(dot)

    const overlay = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(gpsLoc.lat, gpsLoc.lng),
      content: wrap,
      yAnchor: 0.5,
      xAnchor: 0.5,
      zIndex: 10,
    })
    overlay.setMap(mapRef.current)
    locOverlayRef.current = overlay
  }, [ready, showLocation, gpsLoc])

  // ── 혼잡도 노드 오버레이 ──────────────────────────────────────────────────
  useEffect(() => {
    if (!ready || !mapRef.current) return
    const kakao = window.kakao

    overlaysRef.current.forEach((o) => o.setMap(null))
    overlaysRef.current = []

    nodes.forEach((node) => {
      if (node.lat == null || node.lng == null) return

      const color    = node.color || LEVEL_COLOR[node.level] || '#10b981'
      const pulseDur = node.pulseDur || '2s'
      const hasOrder = node.order != null
      const dotSize  = hasOrder ? 34 : 18

      const wrap = document.createElement('div')
      wrap.style.cssText = `position:relative;width:${dotSize}px;height:${dotSize}px;cursor:pointer;`

      // 혼잡도 펄스 노드 — 파문 2겹으로 생동감 부여
      if (node.pulse !== false && !hasOrder) {
        const ring1 = document.createElement('div')
        ring1.className = 'pulse-ring'
        ring1.style.cssText = `position:absolute;inset:-14px;border-radius:50%;background:${color}28;animation-duration:${pulseDur};pointer-events:none;`
        wrap.appendChild(ring1)

        const ring2 = document.createElement('div')
        ring2.className = 'pulse-ring-delay'
        ring2.style.cssText = `position:absolute;inset:-8px;border-radius:50%;background:${color}38;animation-duration:${pulseDur};pointer-events:none;`
        wrap.appendChild(ring2)
      }

      const dot = document.createElement('div')
      if (hasOrder) {
        // 경로 번호 마커 — 크고 선명하게, 색상 글로우
        dot.style.cssText = [
          'position:absolute;inset:0;border-radius:50%;',
          `background:${color};`,
          'border:3px solid white;',
          `box-shadow:0 0 0 1.5px ${color}50,0 4px 18px ${color}70,0 2px 8px rgba(0,0,0,.22);`,
          'display:flex;align-items:center;justify-content:center;',
          'font-size:13px;font-weight:800;color:white;letter-spacing:-0.5px;',
        ].join('')
        dot.textContent = String(node.order)
      } else {
        // 혼잡도 펄스 마커 — 컴팩트
        dot.style.cssText = [
          'position:absolute;inset:0;border-radius:50%;',
          `background:${color};`,
          'border:2.5px solid white;',
          `box-shadow:0 2px 10px ${color}80,0 1px 4px rgba(0,0,0,.18);`,
        ].join('')
      }
      wrap.appendChild(dot)

      if (node.showTip) {
        const label = node.levelLabel || LEVEL_LABEL[node.level] || ''
        const tip = document.createElement('div')
        tip.style.cssText = [
          'position:absolute;bottom:calc(100% + 10px);left:50%;transform:translateX(-50%);',
          'background:white;padding:7px 12px;border-radius:10px;',
          'white-space:nowrap;pointer-events:none;z-index:20;',
          'display:flex;flex-direction:column;align-items:center;gap:2px;',
          'box-shadow:0 8px 24px rgba(0,0,0,.13),0 2px 8px rgba(0,0,0,.08);',
        ].join('')
        // 말풍선 꼬리
        tip.innerHTML = [
          `<span style="font-size:12px;font-weight:700;color:#111827">${node.name}</span>`,
          `<span style="font-size:10.5px;font-weight:600;color:${color}">${label}</span>`,
          `<div style="position:absolute;bottom:-5px;left:50%;transform:translateX(-50%);`,
          `width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;`,
          `border-top:5px solid white;"></div>`,
        ].join('')
        wrap.appendChild(tip)
      }

      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(node.lat, node.lng),
        content: wrap,
        yAnchor: 0.5,
        xAnchor: 0.5,
        zIndex: 5,
      })
      overlay.setMap(mapRef.current)
      overlaysRef.current.push(overlay)

      if (node.onClick) wrap.addEventListener('click', node.onClick)
    })
  }, [ready, nodes])

  // ── 3D 혼잡도 막대 오버레이 ─────────────────────────────────────────────
  useEffect(() => {
    if (!ready || !mapRef.current) return
    const kakao = window.kakao

    barOverlaysRef.current.forEach((o) => o.setMap(null))
    barOverlaysRef.current = []

    congestionBars.forEach((node, idx) => {
      if (node.lat == null || node.lng == null) return

      const content = buildBarContent(node, idx)
      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(node.lat, node.lng),
        content,
        yAnchor: 1.0,   // 하단이 좌표에 닿음 → 막대가 위로 솟아오름
        xAnchor: 0.5,
        zIndex: 4,      // dot 노드(zIndex 5)보다 아래
      })
      overlay.setMap(mapRef.current)
      barOverlaysRef.current.push(overlay)
    })
  }, [ready, congestionBars])

  // ── 경로 폴리라인 ─────────────────────────────────────────────────────────
  // routePath(실도로) 우선, 없으면 routeNodes 직선 폴백
  useEffect(() => {
    if (!ready || !mapRef.current) return
    const kakao = window.kakao

    if (polylineGlowRef.current) { polylineGlowRef.current.setMap(null); polylineGlowRef.current = null }
    if (polylineRef.current)     { polylineRef.current.setMap(null);     polylineRef.current = null }

    // 실도로 경로(routePath) 우선, 없으면 노드 직선 연결 폴백
    const rawPath = routePath?.length >= 2
      ? routePath
      : routeNodes?.filter((n) => n.lat != null && n.lng != null)

    if (rawPath?.length >= 2) {
      const path = rawPath.map((p) => new kakao.maps.LatLng(p.lat, p.lng))

      // 발광 레이어 — 두껍고 반투명하게 깔아서 네온 글로우 효과
      const glow = new kakao.maps.Polyline({
        path,
        strokeWeight: 16,
        strokeColor: planColor,
        strokeOpacity: 0.12,
        strokeStyle: 'solid',
      })
      glow.setMap(mapRef.current)
      polylineGlowRef.current = glow

      // 메인 라인
      const pl = new kakao.maps.Polyline({
        path,
        strokeWeight: routePath ? 5 : 4,
        strokeColor: planColor,
        strokeOpacity: 0.92,
        strokeStyle: routeStrokeStyle,
      })
      pl.setMap(mapRef.current)
      polylineRef.current = pl
    }
  }, [ready, routeNodes, routePath, planColor, routeStrokeStyle])

  // ── routeNodes 전체를 화면에 맞추기 ─────────────────────────────────────────
  useEffect(() => {
    if (!ready || !mapRef.current || !fitBoundsToNodes || !routeNodes?.length) return
    const kakao = window.kakao
    const bounds = new kakao.maps.LatLngBounds()
    routeNodes
      .filter((n) => n.lat != null && n.lng != null)
      .forEach((n) => bounds.extend(new kakao.maps.LatLng(n.lat, n.lng)))
    try { mapRef.current.setBounds(bounds, 80) } catch (_) {}
  }, [ready, fitBoundsToNodes, routeNodes])

  // ── 키 없음: 플레이스홀더 폴백 ──────────────────────────────────────────────
  if (!KAKAO_APP_KEY) {
    return (
      <MapCanvas
        theme={theme}
        nodes={nodes}
        mapBlocks={MAP_BLOCKS}
        showLocation={showLocation}
        style={style}
      >
        {children}
      </MapCanvas>
    )
  }

  // ── 에러 상태 ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div
        style={{
          position: 'relative', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: theme.mapBg, color: theme.subtext,
          fontSize: 12, gap: 6, textAlign: 'center',
          padding: 20,
          ...style,
        }}
      >
        <div style={{ fontWeight: 700, color: theme.text }}>지도를 불러올 수 없습니다</div>
        <div style={{ fontSize: 11 }}>{error}</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>
          카카오 개발자 콘솔 → 앱 → 플랫폼 → Web → 사이트 도메인에<br />
          <code style={{ background: theme.surface, padding: '1px 6px', borderRadius: 4 }}>
            http://localhost:3000
          </code>
          이 등록되어 있는지 확인하세요.
        </div>
        {children}
      </div>
    )
  }

  // ── 카카오 지도 ──────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', overflow: 'hidden', ...style }}>
      <div ref={mapDivRef} style={{ width: '100%', height: '100%' }} />

      {!ready && (
        <div
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: theme.mapBg, color: theme.subtext,
            fontSize: 13, gap: 8,
          }}
        >
          <div
            style={{
              width: 16, height: 16,
              border: `2px solid ${theme.border}`,
              borderTopColor: theme.primary,
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          Loading map...
        </div>
      )}

      {children}
    </div>
  )
}
