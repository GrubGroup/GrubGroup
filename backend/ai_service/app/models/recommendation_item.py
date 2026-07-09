"""SQLModel read-side mirror of Prisma join table "RecommendationItem"."""

from sqlmodel import Field, SQLModel


class RecommendationItem(SQLModel, table=True):
    """One recommended restaurant with score/justification; mirrors Prisma model RecommendationItem."""

    __tablename__ = "RecommendationItem"

    id: int | None = Field(default=None, primary_key=True)
    recommendation_id: int = Field(foreign_key="Recommendation.id")
    restaurant_id: int = Field(foreign_key="Restaurant.id")
    match_score: float | None = None
    justification: str | None = None
