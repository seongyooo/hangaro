import * as THREE from 'three'

/**
 * 두 노드를 잇는 포물선 아크 링크
 * isRecommended: true → 초록 / false → 빨강 반투명
 */
export function createArcLink(fromVec3, toVec3, isRecommended) {
  const mid = new THREE.Vector3(
    (fromVec3.x + toVec3.x) / 2,
    60,                            // 아크 정점 높이
    (fromVec3.z + toVec3.z) / 2,
  )

  const curve  = new THREE.QuadraticBezierCurve3(fromVec3, mid, toVec3)
  const points = curve.getPoints(60)
  const geo    = new THREE.BufferGeometry().setFromPoints(points)
  const mat    = new THREE.LineBasicMaterial({
    color:       isRecommended ? 0x4ade80 : 0xef4444,
    transparent: true,
    opacity:     isRecommended ? 0.85 : 0.3,
  })

  return { line: new THREE.Line(geo, mat), curve }
}
