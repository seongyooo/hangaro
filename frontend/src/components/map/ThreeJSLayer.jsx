import { useRef } from 'react'
import { useThreeJS } from '../../hooks/useThreeJS'

/**
 * Three.js WebGL 레이어
 * 줌 >= 14 일 때만 보임 (useThreeJS 내부에서 제어)
 */
export default function ThreeJSLayer({ width, height }) {
  const canvasRef = useRef(null)
  useThreeJS(canvasRef)

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute', inset: 0,
        pointerEvents: 'none',
        zIndex: 3,
        display: 'none',   // useThreeJS가 is3DEnabled에 따라 토글
      }}
    />
  )
}
