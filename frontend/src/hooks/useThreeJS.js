import { useEffect, useRef } from 'react'
import { NetworkScene } from '../three/NetworkScene'
import useMapStore from '../store/useMapStore'

/**
 * Three.js NetworkScene 생명주기 관리
 * canvasRef: <canvas> ref (position: absolute, Kakao Maps 위)
 */
export function useThreeJS(canvasRef) {
  const sceneRef   = useRef(null)
  const is3DEnabled = useMapStore((s) => s.is3DEnabled)
  const nodes      = useMapStore((s) => s.nodes)
  const edges      = useMapStore((s) => s.edges)

  // 씬 초기화 / 정리
  useEffect(() => {
    if (!canvasRef.current) return
    const scene = new NetworkScene(canvasRef.current)
    sceneRef.current = scene

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      scene.resize(width, height)
    })
    ro.observe(canvasRef.current.parentElement)

    return () => {
      ro.disconnect()
      scene.dispose()
    }
  }, [])

  // 3D 활성/비활성 전환
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    is3DEnabled ? scene.start() : scene.stop()
    if (canvasRef.current) {
      canvasRef.current.style.display = is3DEnabled ? 'block' : 'none'
    }
  }, [is3DEnabled])

  // 노드 / 엣지 변경 시 씬 업데이트
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene || !is3DEnabled) return
    scene.updateNodes(nodes)
    scene.updateEdges(edges, nodes)
  }, [nodes, edges, is3DEnabled])

  return { sceneRef }
}
