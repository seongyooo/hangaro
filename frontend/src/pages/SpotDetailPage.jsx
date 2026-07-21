import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { getCongestionInfo } from '../lib/congestionColor'

export default function SpotDetailPage() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const [timeline, setTimeline] = useState([])

  useEffect(() => {
    api.congestionTimeline(id).then(({ data }) => setTimeline(data.timeline))
  }, [id])

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <button onClick={() => navigate(-1)} className="mb-4">← 뒤로</button>
      <h2 className="text-xl font-bold mb-4">시간대별 혼잡도</h2>

      <div className="flex items-end gap-1 h-32">
        {timeline.map(({ hour, congestion }) => {
          const { color } = getCongestionInfo(congestion)
          return (
            <div key={hour} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t"
                style={{ height: `${congestion * 100}%`, backgroundColor: color }}
              />
              <span className="text-xs text-gray-500">{hour}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
