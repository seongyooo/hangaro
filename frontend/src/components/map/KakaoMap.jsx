import { useRef, useState, useEffect } from 'react'
import { useKakaoMap } from '../../hooks/useKakaoMap'
import Canvas2DOverlay from './Canvas2DOverlay'
import ThreeJSLayer    from './ThreeJSLayer'

const HAS_KEY = !!import.meta.env.VITE_KAKAO_MAP_KEY

export default function KakaoMap({ className = '' }) {
  const mapDivRef  = useRef(null)
  const wrapperRef = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  const { ready } = useKakaoMap(mapDivRef)

  useEffect(() => {
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ w: Math.floor(width), h: Math.floor(height) })
    })
    if (wrapperRef.current) ro.observe(wrapperRef.current)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={wrapperRef} className={`relative overflow-hidden bg-gray-800 ${className}`}>

      {/* 카카오맵 키 없을 때 안내 */}
      {!HAS_KEY && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 text-sm gap-2 z-10">
          <span className="text-2xl">🗺️</span>
          <p>카카오맵 키 미설정</p>
          <p className="text-xs text-gray-500">.env 파일에 VITE_KAKAO_MAP_KEY 추가 필요</p>
        </div>
      )}

      {/* 1. Kakao Maps 베이스 */}
      <div ref={mapDivRef} style={{ width: '100%', height: '100%' }} />

      {/* 2. Canvas 2D 오버레이 */}
      {ready && <Canvas2DOverlay width={size.w} height={size.h} />}

      {/* 3. Three.js WebGL 레이어 */}
      {ready && <ThreeJSLayer width={size.w} height={size.h} />}
    </div>
  )
}
