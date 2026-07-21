/**
 * Three.js 씬 초기화 및 관리
 * 줌 레벨 >= 14 일 때만 활성화
 */
import * as THREE from 'three'
import { createCongestionPillar } from './CongestionPillar'
import { createArcLink } from './ArcLink'

export class NetworkScene {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    this.renderer.setPixelRatio(window.devicePixelRatio)

    this.scene  = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000)
    this.camera.position.set(0, 200, 0)
    this.camera.lookAt(0, 0, 0)

    // 환경광 + 방향광
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight.position.set(1, 2, 1)
    this.scene.add(dirLight)

    this._pillars  = new Map()   // nodeId → Mesh
    this._arcLines = []
    this._particles = []
    this._animFrame = null
  }

  resize(w, h) {
    this.renderer.setSize(w, h, false)
    const aspect = w / h
    const s = 200
    this.camera.left   = -s * aspect
    this.camera.right  =  s * aspect
    this.camera.top    =  s
    this.camera.bottom = -s
    this.camera.updateProjectionMatrix()
  }

  /** 노드 목록으로 기둥 재생성 */
  updateNodes(nodes) {
    this._pillars.forEach((mesh) => this.scene.remove(mesh))
    this._pillars.clear()

    nodes.forEach((node) => {
      const mesh = createCongestionPillar(node.congestion)
      // Kakao Maps 픽셀 좌표 → Three.js 좌표 (별도 변환 함수 필요)
      mesh.position.set(node.threeX ?? 0, 0, node.threeZ ?? 0)
      this.scene.add(mesh)
      this._pillars.set(node.id, mesh)
    })
  }

  /** 엣지 목록으로 아크 링크 재생성 */
  updateEdges(edges, nodes) {
    this._arcLines.forEach((line) => this.scene.remove(line))
    this._arcLines = []

    const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]))
    edges.forEach((edge) => {
      const from = nodeMap[edge.from]
      const to   = nodeMap[edge.to]
      if (!from || !to) return
      const { line, curve } = createArcLink(
        new THREE.Vector3(from.threeX ?? 0, 0, from.threeZ ?? 0),
        new THREE.Vector3(to.threeX   ?? 0, 0, to.threeZ   ?? 0),
        edge.isRecommended,
      )
      this.scene.add(line)
      this._arcLines.push({ line, curve, isRecommended: edge.isRecommended })
    })
  }

  start() {
    const animate = () => {
      this._animFrame = requestAnimationFrame(animate)
      this.renderer.render(this.scene, this.camera)
    }
    animate()
  }

  stop() {
    if (this._animFrame) cancelAnimationFrame(this._animFrame)
  }

  dispose() {
    this.stop()
    this.renderer.dispose()
  }
}
