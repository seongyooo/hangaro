import * as THREE from 'three'

/**
 * 아크 커브를 따라 흐르는 파티클
 * animate(t) 를 매 프레임 호출
 */
export class ParticleFlow {
  constructor(curve, scene, color = 0x4ade80) {
    this.curve = curve
    this._t    = 0

    const geo = new THREE.SphereGeometry(3, 8, 8)
    const mat = new THREE.MeshBasicMaterial({ color })
    this.mesh  = new THREE.Mesh(geo, mat)
    scene.add(this.mesh)
  }

  animate(delta) {
    this._t = (this._t + delta * 0.4) % 1
    const pos = this.curve.getPoint(this._t)
    this.mesh.position.copy(pos)
  }

  dispose(scene) {
    scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
  }
}
