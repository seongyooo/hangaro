/**
 * Canvas 2D — 링크 파티클 흐름 렌더러
 */
import { congestionColorRgba } from '../lib/congestionColor'

function getQuadraticPoint(from, mid, to, t) {
  return {
    x: (1 - t) ** 2 * from.x + 2 * (1 - t) * t * mid.x + t ** 2 * to.x,
    y: (1 - t) ** 2 * from.y + 2 * (1 - t) * t * mid.y + t ** 2 * to.y,
  }
}

export function drawLink(ctx, edge, nodes, progress) {
  const from = nodes.find((n) => n.id === edge.from)
  const to   = nodes.find((n) => n.id === edge.to)
  if (!from || !to) return

  const mid = {
    x: (from.x + to.x) / 2,
    y: Math.min(from.y, to.y) - 30,
  }

  // 베이스 곡선
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.quadraticCurveTo(mid.x, mid.y, to.x, to.y)
  ctx.strokeStyle = edge.isRecommended
    ? 'rgba(74, 222, 128, 0.35)'
    : congestionColorRgba(0.85, 0.2)
  ctx.setLineDash([8, 4])
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.setLineDash([])

  // 파티클 (추천 경로만)
  if (edge.isRecommended) {
    const pt = getQuadraticPoint(from, mid, to, progress % 1)
    ctx.beginPath()
    ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#4ade80'
    ctx.fill()
  }
}
