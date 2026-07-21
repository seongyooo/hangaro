from datetime import datetime
from fastapi import APIRouter

from app.services.congestion_service import get_congestion, get_congestion_label

router = APIRouter()


@router.get("/{spot_id}")
async def spot_congestion(spot_id: str, category: str = "attraction"):
    now = datetime.now()
    score = await get_congestion(spot_id, category, now)
    return {
        "spot_id": spot_id,
        "congestion": score,
        "label": get_congestion_label(score),
        "timestamp": now.isoformat(),
    }


@router.get("/{spot_id}/timeline")
async def congestion_timeline(spot_id: str, category: str = "attraction", date: str = ""):
    """시간대별 혼잡도 패턴 반환 (24시간)"""
    from datetime import timedelta
    base = datetime.fromisoformat(date) if date else datetime.now().replace(hour=0, minute=0, second=0)
    timeline = []
    for hour in range(24):
        dt = base + timedelta(hours=hour)
        score = await get_congestion(spot_id, category, dt)
        timeline.append({"hour": hour, "congestion": score, "label": get_congestion_label(score)})
    return {"spot_id": spot_id, "timeline": timeline}
