import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import useMapStore from '../store/useMapStore'

const REGIONS   = ['서울', '부산', '경주', '제주']
const STYLES    = ['culture', 'nature', 'food', 'activity']
const TRANSPORTS = ['walk', 'bus', 'car']

export default function RecommendPage() {
  const navigate     = useNavigate()
  const setDestination = useMapStore((s) => s.setDestination)

  const [form, setForm] = useState({
    region: '서울', date: '', start_time: '10:00',
    style: 'culture', transport: 'walk', n_stops: 5,
    destination_id: '',
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = { ...form }
      if (!payload.destination_id) delete payload.destination_id
      const { data } = await api.recommend(payload)
      if (form.destination_id) setDestination(form.destination_id)
      navigate('/recommend/result', { state: { result: data } })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <h2 className="text-xl font-bold mb-6">코스 추천</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 지역 */}
        <label className="block">
          <span className="text-sm text-gray-400">지역</span>
          <select
            className="mt-1 w-full bg-gray-800 rounded px-3 py-2"
            value={form.region}
            onChange={(e) => setForm({ ...form, region: e.target.value })}
          >
            {REGIONS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>

        {/* 날짜 / 시간 */}
        <label className="block">
          <span className="text-sm text-gray-400">날짜</span>
          <input
            type="date" required
            className="mt-1 w-full bg-gray-800 rounded px-3 py-2"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </label>

        {/* 목적지 고정 (선택) */}
        <label className="block">
          <span className="text-sm text-gray-400">목적지 고정 (선택 — 혼잡해도 이 곳에 가고 싶다면)</span>
          <input
            type="text" placeholder="관광지 ID 또는 검색"
            className="mt-1 w-full bg-gray-800 rounded px-3 py-2"
            value={form.destination_id}
            onChange={(e) => setForm({ ...form, destination_id: e.target.value })}
          />
        </label>

        <button
          type="submit" disabled={loading}
          className="w-full py-3 bg-green-500 rounded-xl font-semibold disabled:opacity-50"
        >
          {loading ? '분석 중...' : '추천 코스 보기'}
        </button>
      </form>
    </div>
  )
}
