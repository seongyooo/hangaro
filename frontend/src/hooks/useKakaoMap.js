import { useEffect, useRef, useState } from 'react'
import useMapStore from '../store/useMapStore'

const KAKAO_APP_KEY = import.meta.env.VITE_KAKAO_MAP_KEY ?? ''

/**
 * 카카오맵 SDK 동적 로드 + 지도 초기화
 */
function loadKakaoScript() {
  return new Promise((resolve, reject) => {
    if (window.kakao?.maps) return resolve()

    const script = document.createElement('script')
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_APP_KEY}&autoload=false`
    script.onload = () => window.kakao.maps.load(resolve)
    script.onerror = reject
    document.head.appendChild(script)
  })
}

export function useKakaoMap(mapRef, { lat = 37.5665, lng = 126.978, zoom = 5 } = {}) {
  const mapInstanceRef = useRef(null)
  const setZoomLevel   = useMapStore((s) => s.setZoomLevel)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!KAKAO_APP_KEY) {
      console.warn('VITE_KAKAO_MAP_KEY 환경변수가 없습니다. .env 파일을 확인하세요.')
      return
    }

    loadKakaoScript()
      .then(() => {
        if (!mapRef.current) return
        const map = new window.kakao.maps.Map(mapRef.current, {
          center: new window.kakao.maps.LatLng(lat, lng),
          level: zoom,
        })
        mapInstanceRef.current = map
        window.kakao.maps.event.addListener(map, 'zoom_changed', () => {
          setZoomLevel(map.getLevel())
        })
        setReady(true)
      })
      .catch((e) => console.error('카카오맵 로드 실패:', e))
  }, [])

  const latLngToPixel = (spotLat, spotLng) => {
    const map = mapInstanceRef.current
    if (!map) return { x: 0, y: 0 }
    const proj   = map.getProjection()
    const point  = proj.pointFromCoords(new window.kakao.maps.LatLng(spotLat, spotLng))
    const origin = proj.pointFromCoords(map.getBounds().getSouthWest())
    return { x: point.x - origin.x, y: point.y - origin.y }
  }

  return { mapInstance: mapInstanceRef, latLngToPixel, ready }
}
