"""pgvector similarity search with metadata filtering."""

import math

from sqlalchemy import TEXT, cast
from sqlalchemy.dialects.postgresql import ARRAY
from sqlmodel import select

from app.db.session import async_session_factory
from app.models.restaurant import Restaurant

# Approximate miles per degree of latitude (constant); longitude is scaled by
# cos(latitude) since meridians converge toward the poles.
_MILES_PER_DEG_LAT = 69.0


async def similarity_search(
    query_embedding: list[float],
    *,
    limit: int = 20,
    required_dietary_tags: list[str] | None = None,
    price_max: float | None = None,
    center: tuple[float, float] | None = None,
    radius_miles: float | None = None,
) -> list[tuple[Restaurant, float]]:
    """Return (restaurant, cosine_distance) pairs nearest to `query_embedding`.

    Hard filters are pushed into SQL WHERE: rows with a NULL embedding are
    skipped, `dietary_tags` must contain ALL `required_dietary_tags` (array
    `@>`), `price_avg` must be <= `price_max` when given, and a bounding-box
    lat/long prefilter is applied when `center` + `radius_miles` are given.
    Ordered ascending by pgvector cosine distance (`<=>`).
    """
    distance = Restaurant.embedding.cosine_distance(query_embedding)

    statement = (
        select(Restaurant, distance.label("distance"))
        .where(Restaurant.embedding.is_not(None))
        .order_by(distance.asc())
        .limit(limit)
    )

    if required_dietary_tags:
        # `@>` (contains): the row's dietary_tags must be a superset of the
        # required tags, i.e. every required tag is present. Cast the bound
        # param to text[] — Prisma created dietary_tags as text[], and Postgres
        # has no `text[] @> varchar[]` operator (element types must match).
        statement = statement.where(
            Restaurant.dietary_tags.op("@>")(
                cast(required_dietary_tags, ARRAY(TEXT))
            )
        )

    if price_max is not None:
        statement = statement.where(Restaurant.price_avg <= price_max)

    if center is not None and radius_miles is not None:
        lat, lon = center
        lat_delta = radius_miles / _MILES_PER_DEG_LAT
        # Guard against a degenerate cos() near the poles before dividing.
        cos_lat = math.cos(math.radians(lat))
        lon_scale = _MILES_PER_DEG_LAT * max(abs(cos_lat), 1e-6)
        lon_delta = radius_miles / lon_scale
        statement = statement.where(
            Restaurant.lat.is_not(None),
            Restaurant.long.is_not(None),
            Restaurant.lat >= lat - lat_delta,
            Restaurant.lat <= lat + lat_delta,
            Restaurant.long >= lon - lon_delta,
            Restaurant.long <= lon + lon_delta,
        )

    async with async_session_factory() as session:
        result = await session.execute(statement)
        return [(row.Restaurant, row.distance) for row in result.all()]


async def retrieve_for_query(
    query_text: str, **kwargs
) -> list[tuple[Restaurant, float]]:
    """Embed `query_text` (1024-dim) then run `similarity_search` with `kwargs`."""
    # Imported lazily so a missing/misconfigured embeddings provider fails here
    # at call time rather than at module import.
    from app.ai.rag.embeddings import embed_text

    query_embedding = await embed_text(query_text)
    return await similarity_search(query_embedding, **kwargs)
