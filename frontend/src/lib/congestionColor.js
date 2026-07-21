/**
 * 혼잡도 점수(0~1) → 색상 / 라벨 변환 유틸
 * Canvas 2D, Three.js, CSS 모두에서 공통 사용
 */
export const CONGESTION_LEVELS = [
  { max: 0.3, color: '#4ade80', hex: 0x4ade80, label: '한적', cssClass: 'text-green-400' },
  { max: 0.5, color: '#facc15', hex: 0xfacc15, label: '여유', cssClass: 'text-yellow-400' },
  { max: 0.8, color: '#fb923c', hex: 0xfb923c, label: '보통', cssClass: 'text-orange-400' },
  { max: 1.1, color: '#ef4444', hex: 0xef4444, label: '혼잡', cssClass: 'text-red-400' },
]

export function getCongestionInfo(score) {
  return CONGESTION_LEVELS.find((l) => score < l.max) ?? CONGESTION_LEVELS.at(-1)
}

export function congestionColorRgba(score, alpha = 1) {
  const { color } = getCongestionInfo(score)
  // hex → rgba
  const r = parseInt(color.slice(1, 3), 16)
  const g = parseInt(color.slice(3, 5), 16)
  const b = parseInt(color.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export function congestionHex(score) {
  return getCongestionInfo(score).hex
}

/** 혼잡할수록 빠른 펄스 속도 (0.5 ~ 2.5) */
export function pulseSpeed(score) {
  return 0.5 + score * 2.0
}
