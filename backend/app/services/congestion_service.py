"""
혼잡도 서비스

우선순위:
  1. TatsCnctrRateService (KT 이동통신 기반 ML 예측, 향후 30일)  ← 핵심
  2. 정적 패턴 모델 (폴백 — API 미등록 관광지 또는 API 장애 시)
"""
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path

from app.core.config import settings
from app.core.database import redis_client

logger = logging.getLogger(__name__)

_PATTERN_FILE = Path(__file__).parent.parent.parent.parent.parent / "data" / "congestion_patterns.json"
_PATTERNS: dict = json.loads(_PATTERN_FILE.read_text(encoding="utf-8")) if _PATTERN_FILE.exists() else {}

LABEL_MAP = [
    (0.0, 0.3, "한적"),
    (0.3, 0.5, "여유"),
    (0.5, 0.8, "보통"),
    (0.8, 1.1, "혼잡"),
]


def get_congestion_label(score: float) -> str:
    for lo, hi, label in LABEL_MAP:
        if lo <= score < hi:
            return label
    return "혼잡"


async def get_congestion(
    spot_id: str,
    category: str,
    dt: datetime,
    area_cd: str = "",
    sigungu_cd: str = "",
    tats_nm: str = "",
) -> float:
    """
    혼잡도 점수 반환 (0.0~1.0)

    1차: Redis 캐시 확인
    2차: TatsCnctrRateService API (area_cd + sigungu_cd + tats_nm 있을 때)
    3차: 정적 패턴 폴백
    """
    cache_key = f"congestion:{spot_id}:{dt.strftime('%Y%m%d%H')}"
    cached = await redis_client.get(cache_key)
    if cached:
        return float(cached)

    score = None

    # 1차: KT ML 예측 집중률 API
    if area_cd and sigungu_cd:
        score = await _get_kt_congestion(area_cd, sigungu_cd, tats_nm, dt)

    # 2차: 정적 패턴 폴백
    if score is None:
        score = _calc_static_score(category, dt)

    await redis_client.setex(cache_key, settings.CONGESTION_TTL, str(score))
    return score


async def _get_kt_congestion(
    area_cd: str, sigungu_cd: str, tats_nm: str, dt: datetime
) -> float | None:
    """
    TatsCnctrRateService 호출 → 해당 날짜 집중률 반환
    cnctrRate 0~100 → 0.0~1.0 정규화
    """
    try:
        from app.services.kto_api import get_concentration_rate
        items = await get_concentration_rate(area_cd, sigungu_cd, tats_nm, num_of_rows=30)
        if not items:
            return None

        target_ymd = dt.strftime("%Y%m%d")
        matched = next((i for i in items if i.get("baseYmd") == target_ymd), None)

        # 정확한 날짜 없으면 가장 가까운 날짜 사용
        if not matched:
            matched = items[0]

        rate = float(matched["cnctrRate"])
        return round(rate / 100, 3)   # 0.0~1.0

    except Exception as e:
        logger.warning(f"TatsCnctrRateService 호출 실패 ({tats_nm}): {e}")
        return None


def _calc_static_score(category: str, dt: datetime) -> float:
    """정적 패턴 폴백 — congestion_patterns.json 기반"""
    pattern = _PATTERNS.get(category, _PATTERNS.get("default", {}))
    day_type = "weekend" if dt.weekday() >= 5 else "weekday"
    hourly: list[float] = pattern.get(day_type, [0.5] * 24)
    return hourly[dt.hour] if dt.hour < len(hourly) else 0.5


async def get_30day_forecast(
    area_cd: str, sigungu_cd: str, tats_nm: str
) -> list[dict]:
    """
    향후 30일 집중률 전체 반환 — SpotDetail 타임라인 차트용
    반환: [{"date": "2026-07-21", "cnctrRate": 87.3, "congestion": 0.873, "label": "혼잡"}, ...]
    """
    try:
        from app.services.kto_api import get_concentration_rate
        items = await get_concentration_rate(area_cd, sigungu_cd, tats_nm, num_of_rows=30)
        return [
            {
                "date": f"{i['baseYmd'][:4]}-{i['baseYmd'][4:6]}-{i['baseYmd'][6:]}",
                "cnctrRate": float(i["cnctrRate"]),
                "congestion": round(float(i["cnctrRate"]) / 100, 3),
                "label": get_congestion_label(float(i["cnctrRate"]) / 100),
            }
            for i in items
        ]
    except Exception as e:
        logger.warning(f"30일 예측 조회 실패: {e}")
        return []


async def predict_clear_time(
    area_cd: str, sigungu_cd: str, tats_nm: str, category: str, from_dt: datetime
) -> datetime:
    """
    혼잡도가 0.5 이하로 떨어지는 가장 가까운 날짜 반환
    KT 예측 데이터 → 정적 패턴 순으로 시도
    """
    THRESHOLD = 0.5
    forecast = await get_30day_forecast(area_cd, sigungu_cd, tats_nm)

    if forecast:
        for item in forecast:
            item_dt = datetime.fromisoformat(item["date"])
            if item_dt >= from_dt and item["congestion"] < THRESHOLD:
                return item_dt

    # 폴백: 정적 패턴으로 당일 내 탐색
    for offset in range(0, 180, 30):
        candidate = from_dt + timedelta(minutes=offset)
        if _calc_static_score(category, candidate) < THRESHOLD:
            return candidate

    return from_dt
