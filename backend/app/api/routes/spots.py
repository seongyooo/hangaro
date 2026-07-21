from fastapi import APIRouter, Query

from app.services.kto_api import get_spots_by_location, search_keyword

router = APIRouter()


@router.get("/nearby")
async def nearby_spots(lat: float, lng: float, radius: int = Query(default=3000, le=5000)):
    return await get_spots_by_location(lat, lng, radius)


@router.get("/search")
async def search_spots(keyword: str, region: str = ""):
    AREA_CODE = {"서울": "1", "부산": "6", "경주": "35", "제주": "39"}
    area_code = AREA_CODE.get(region, "")
    return await search_keyword(keyword, area_code)
