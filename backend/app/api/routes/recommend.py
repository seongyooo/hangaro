from datetime import datetime
from fastapi import APIRouter

from app.schemas.spot import RouteRequest, RouteResponse
from app.services.recommender import recommend_free, recommend_fixed_destination

router = APIRouter()


@router.post("", response_model=RouteResponse)
async def create_recommendation(req: RouteRequest):
    dt = datetime.fromisoformat(f"{req.date}T{req.start_time}")

    AREA_CODE = {"서울": "1", "부산": "6", "경주": "35", "제주": "39"}
    region_code = AREA_CODE.get(req.region, "1")

    if req.destination_id:
        return await recommend_fixed_destination(region_code, req.destination_id, dt, req.n_stops)
    return await recommend_free(region_code, dt, req.n_stops)
