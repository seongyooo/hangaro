/**
 * KakaoMapView
 * - VITE_KAKAO_MAP_KEY 있으면 실제 카카오 지도 렌더링
 * - 없으면 MapCanvas 플레이스홀더로 폴백
 */
import { useEffect, useRef, useState } from 'react'
import MapCanvas from './MapCanvas'
import { LEVEL_COLOR, LEVEL_LABEL, MAP_BLOCKS } from '../../App'

const KAKAO_APP_KEY = import.meta.env.VITE_KAKAO_MAP_KEY ?? ''

// SDK는 index.html에서 로드됨 — window.kakao가 준비될 때까지 대기
let sdkPromise = null
function waitForKakaoSDK() {
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve, reject) => {
    // 이미 초기화된 경우
    if (window.kakao?.maps?.Map) { resolve(); return }
    // 스크립트는 로드됐지만 아직 maps.load() 호출 전
    if (window.kakao?.maps) { window.kakao.maps.load(resolve); return }

    // index.html 스크립트 로드 완료를 폴링으로 대기
    let waited = 0
    const timer = setInterval(() => {
      waited += 100
      if (window.kakao?.maps) {
        clearInterval(timer)
        window.kakao.maps.load(resolve)
      } else if (waited >= 10000) {
        clearInterval(timer)
        sdkPromise = null
        reject(new Error('Kakao SDK 로드 타임아웃 — 키와 도메인 등록을 확인하세요'))
      }
    }, 100)
  })
  return sdkPromise
}

const CENTER = { lat: 37.5760, lng: 126.9860 } // 경복궁 인근

export default function KakaoMapView({
  theme,
  nodes = [],
  showLocation = false,
  routeNodes = null,
  planColor = '#22c55e',
  centerOn = null,
  style,
  children,
}) {
  const mapDivRef     = useRef(null)
  const mapRef        = useRef(null)
  const overlaysRef   = useRef([])
  const polylineRef   = useRef(null)
  const locOverlayRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  // ── 지도 초기화 ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!KAKAO_APP_KEY) return
    let cancelled = false

    waitForKakaoSDK()
      .then(() => {
        if (cancelled || !mapDivRef.current || mapRef.current) return
        // DOM 레이아웃이 완료된 뒤 지도 생성
        requestAnimationFrame(() => {
          if (cancelled || !mapDivRef.current || mapRef.current) return
          try {
            const map = new window.kakao.maps.Map(mapDivRef.current, {
              center: new window.kakao.maps.LatLng(CENTER.lat, CENTER.lng),
              level: 5,
            })
            // 컨테이너 크기 반영
            map.relayout()
            mapRef.current = map
            setReady(true)
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
      // 언마운트 시 오버레이 정리
      overlaysRef.current.forEach((o) => o.setMap(null))
      if (polylineRef.current) polylineRef.current.setMap(null)
      if (locOverlayRef.current) locOverlayRef.current.setMap(null)
      mapRef.current = null
    }
  }, [])

  // ── 지도 중심 이동 (장소 선택 시) ───────────────────────────────────────────
  useEffect(() => {
    if (!ready || !mapRef.current || !centerOn) return
    mapRef.current.panTo(new window.kakao.maps.LatLng(centerOn.lat, centerOn.lng))
  }, [ready, centerOn])

  // 컨테이너 리사이즈 시 relayout
  useEffect(() => {
    if (!ready || !mapDivRef.current) return
    const ro = new ResizeObserver(() => mapRef.current?.relayout())
    ro.observe(mapDivRef.current)
    return () => ro.disconnect()
  }, [ready])

  // ── 혼잡도 노드 오버레이 ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready || !mapRef.current) return
    const kakao = window.kakao

    overlaysRef.current.forEach((o) => o.setMap(null))
    overlaysRef.current = []

    nodes.forEach((node) => {
      if (node.lat == null || node.lng == null) return

      const color    = node.color || LEVEL_COLOR[node.level] || '#22c55e'
      const pulseDur = node.pulseDur || '1.5s'

      const wrap = document.createElement('div')
      wrap.style.cssText = 'position:relative;width:14px;height:14px;cursor:pointer;'

      if (node.pulse !== false) {
        const ring = document.createElement('div')
        ring.className = 'pulse-ring'
        ring.style.cssText = `position:absolute;inset:-16px;border-radius:50%;border:2px solid ${color};animation-duration:${pulseDur};pointer-events:none;`
        wrap.appendChild(ring)
      }

      const dot = document.createElement('div')
      dot.style.cssText = `position:absolute;inset:0;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:white;`
      if (node.order != null) dot.textContent = String(node.order)
      wrap.appendChild(dot)

      if (node.showTip) {
        const tip = document.createElement('div')
        const label = node.levelLabel || LEVEL_LABEL[node.level] || ''
        tip.style.cssText = `position:absolute;bottom:22px;left:50%;transform:translateX(-50%);background:white;color:#111827;padding:6px 10px;border-radius:8px;font-size:11px;font-weight:600;white-space:nowrap;box-shadow:0 4px 14px rgba(0,0,0,.2);pointer-events:none;z-index:20;display:flex;flex-direction:column;gap:2px;`
        tip.innerHTML = `<span>${node.name}</span><span style="font-size:10px;font-weight:500;color:${color}">${label}</span>`
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

  // ── 경로 폴리라인 ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready || !mapRef.current) return
    const kakao = window.kakao

    if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null }

    if (routeNodes?.length >= 2) {
      const path = routeNodes
        .filter((n) => n.lat != null && n.lng != null)
        .map((n)  => new kakao.maps.LatLng(n.lat, n.lng))

      if (path.length >= 2) {
        const pl = new kakao.maps.Polyline({
          path,
          strokeWeight: 4,
          strokeColor: planColor,
          strokeOpacity: 0.9,
          strokeStyle: 'solid',
        })
        pl.setMap(mapRef.current)
        polylineRef.current = pl
      }
    }
  }, [ready, routeNodes, planColor])

  // ── 현재 위치 오버레이 ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready || !mapRef.current || !showLocation) return
    const kakao = window.kakao

    const render = (lat, lng) => {
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
        position: new kakao.maps.LatLng(lat, lng),
        content: wrap,
        yAnchor: 0.5,
        xAnchor: 0.5,
        zIndex: 10,
      })
      overlay.setMap(mapRef.current)
      locOverlayRef.current = overlay
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => render(pos.coords.latitude, pos.coords.longitude),
        ()    => render(37.5665, 126.9780)
      )
    } else {
      render(37.5665, 126.9780)
    }
  }, [ready, showLocation])

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
