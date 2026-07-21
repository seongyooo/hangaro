import { useEffect, useRef } from 'react'
import useMapStore from '../../store/useMapStore'
import { drawNode } from '../../canvas/PulseRenderer'
import { drawLink } from '../../canvas/LinkRenderer'

/**
 * Canvas 2D 오버레이 — 노드 펄스 + 링크 파티클
 * Kakao Maps div 위에 position: absolute 로 배치
 */
export default function Canvas2DOverlay({ width, height }) {
  const canvasRef  = useRef(null)
  const rafRef     = useRef(null)
  const nodes      = useMapStore((s) => s.nodes)
  const edges      = useMapStore((s) => s.edges)
  const courseIds  = useMapStore((s) => s.courseIds)
  const destId     = useMapStore((s) => s.destinationId)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let startTime = null

    const render = (ts) => {
      if (!startTime) startTime = ts
      const t = (ts - startTime) / 1000   // 경과 초

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // 링크 먼저 (노드 아래)
      edges.forEach((edge, i) => {
        drawLink(ctx, edge, nodes, t + i * 0.3)
      })

      // 노드 위에
      nodes.forEach((node) => {
        drawNode(ctx, {
          ...node,
          isDestination: node.id === destId,
        }, t)
      })

      rafRef.current = requestAnimationFrame(render)
    }

    rafRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(rafRef.current)
  }, [nodes, edges, destId])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute', inset: 0,
        pointerEvents: 'none',
        zIndex: 2,
      }}
    />
  )
}
