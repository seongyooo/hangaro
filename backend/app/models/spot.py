from sqlalchemy import Column, String, Float, Integer
from sqlalchemy.dialects.postgresql import ARRAY
from geoalchemy2 import Geometry

from app.core.database import Base


class Spot(Base):
    __tablename__ = "spots"

    id            = Column(String, primary_key=True)   # KTO contentid
    name          = Column(String, nullable=False)
    category      = Column(String)                     # palace / park / museum / market
    address       = Column(String)
    lat           = Column(Float, nullable=False)
    lng           = Column(Float, nullable=False)
    location      = Column(Geometry("POINT", srid=4326))
    thumbnail_url = Column(String)
    rating        = Column(Float, default=0.0)
    visit_duration = Column(Integer, default=60)       # 분
    ingress_nodes  = Column(ARRAY(String), default=[]) # 복수 진입 게이트 ID
