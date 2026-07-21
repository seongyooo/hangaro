/**
 * Canvas 2D — 노드 펄스 렌더러
 * requestAnimationFrame 루프에서 매 프레임 호출
 */
import { congestionColorRgba, pulseSpeed } from '../lib/congestionColor'

export function drawNode(ctx, node, t) {
  const { x, y, congestion, isDestination } = node
  const speed = pulseSpeed(congestion)
  const phase = (t * speed) % 1
  const maxRadius = 28 + congestion * 18

  // 파동 링
  ctx.beginPath()
  ctx.arc(x, y, maxRadius * phase, 0, Math.PI * 2)
  ctx.strokeStyle = congestionColorRgba(congestion, 1 - phase)
  ctx.lineWidth = 2
  ctx.stroke()

  // 코어 원
  ctx.beginPath()
  ctx.arc(x, y, 10, 0, Math.PI * 2)
  ctx.fillStyle = isDestination ? '#ffffff' : congestionColorRgba(congestion)
  ctx.fill()

  // 목적지 외곽 강조
  if (isDestination) {
    ctx.beginPath()
    ctx.arc(x, y, 16, 0, Math.PI * 2)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2.5
    ctx.stroke()
  }
}
