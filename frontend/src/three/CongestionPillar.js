import * as THREE from 'three'
import { congestionHex } from '../lib/congestionColor'

/**
 * 혼잡도에 따라 높이가 달라지는 3D 기둥
 * congestion 0.0 → 낮은 초록 기둥
 * congestion 1.0 → 높은 빨간 기둥
 */
export function createCongestionPillar(congestion) {
  const height = Math.max(4, congestion * 80)
  const color  = congestionHex(congestion)

  const geo = new THREE.CylinderGeometry(5, 5, height, 16)
  const mat = new THREE.MeshPhongMaterial({
    color,
    transparent: true,
    opacity: 0.78,
    emissive: color,
    emissiveIntensity: 0.25,
  })

  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.y = height / 2   // 지면에서 솟아오르게
  return mesh
}
