"""Seed 50+ mock restaurants (with embeddings) into the Prisma-owned DB; idempotent by name."""

from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.ai.rag.embeddings import embed_text
from app.db.session import async_session_factory
from app.models.restaurant import Restaurant

# City anchor: downtown San Francisco. Each restaurant jitters slightly around this
# so lat/long look like a plausible urban cluster without a real geocoder.
_SF_LAT = 37.7749
_SF_LON = -122.4194


def _mock_restaurants() -> list[dict]:
    """Return 50+ hand-authored mock restaurants with varied tags/price/geo/rating."""
    # (name, description, cuisine_tags, dietary_tags, price_avg, rating, hours)
    rows: list[tuple] = [
        (
            "Golden Bowl Ramen",
            "Slow-simmered tonkotsu and shoyu ramen with house-made noodles and a "
            "quiet counter for solo diners.",
            ["japanese", "ramen", "noodles"],
            [],
            22.0,
            4.6,
            "Mon-Sun 11:00-22:00",
        ),
        (
            "Verde Vegan Kitchen",
            "Bright, plant-forward bowls and jackfruit tacos in a sunlit corner space.",
            ["californian", "bowls", "mexican"],
            ["vegan", "vegetarian", "gluten_free"],
            18.0,
            4.7,
            "Tue-Sun 10:00-21:00",
        ),
        (
            "La Nonna Trattoria",
            "Family-run trattoria serving hand-rolled pasta, wood-fired pizza, and "
            "a long Italian wine list.",
            ["italian", "pizza", "pasta"],
            ["vegetarian"],
            34.0,
            4.5,
            "Wed-Mon 17:00-23:00",
        ),
        (
            "Marina Sushi Bar",
            "Omakase and nigiri from a small, reservation-only bar near the water.",
            ["japanese", "sushi", "seafood"],
            ["gluten_free"],
            78.0,
            4.8,
            "Tue-Sat 18:00-22:30",
        ),
        (
            "Taqueria El Farol",
            "No-frills taqueria famous for al pastor tacos and giant burritos.",
            ["mexican", "tacos"],
            [],
            13.0,
            4.4,
            "Mon-Sun 09:00-23:00",
        ),
        (
            "Saffron House",
            "North Indian curries, tandoori grills, and fresh naan in a warm dining room.",
            ["indian", "curry"],
            ["vegetarian", "vegan", "halal"],
            27.0,
            4.6,
            "Mon-Sun 11:30-22:00",
        ),
        (
            "Blue Anchor Seafood",
            "Daily catch, cioppino, and a raw bar overlooking the bay.",
            ["seafood", "american"],
            ["gluten_free"],
            52.0,
            4.5,
            "Wed-Sun 16:00-22:00",
        ),
        (
            "Le Petit Bistro",
            "Classic French bistro plates, steak frites, and an intimate candlelit room.",
            ["french", "bistro"],
            ["vegetarian"],
            61.0,
            4.7,
            "Tue-Sat 17:30-23:00",
        ),
        (
            "Seoul Grill BBQ",
            "Tabletop Korean barbecue with banchan, bibimbap, and soju cocktails.",
            ["korean", "bbq", "grill"],
            [],
            41.0,
            4.6,
            "Mon-Sun 16:00-24:00",
        ),
        (
            "Green Leaf Salad Co",
            "Build-your-own salads and grain bowls with locally sourced produce.",
            ["healthy", "salads", "bowls"],
            ["vegan", "vegetarian", "gluten_free", "nut_free"],
            15.0,
            4.3,
            "Mon-Fri 08:00-19:00",
        ),
        (
            "Dragon Pearl Dim Sum",
            "Cart-service dim sum, roast duck, and Cantonese classics for big tables.",
            ["chinese", "cantonese", "dim_sum"],
            [],
            29.0,
            4.5,
            "Mon-Sun 10:00-21:00",
        ),
        (
            "Casa Mediterranea",
            "Mezze platters, grilled halloumi, and slow-roasted lamb from the Levant.",
            ["mediterranean", "middle_eastern"],
            ["vegetarian", "halal", "gluten_free"],
            33.0,
            4.6,
            "Tue-Sun 12:00-22:00",
        ),
        (
            "Smokehouse 49",
            "Texas-style brisket, pulled pork, and ribs smoked over oak for 14 hours.",
            ["american", "bbq", "southern"],
            [],
            37.0,
            4.7,
            "Wed-Sun 11:00-21:00",
        ),
        (
            "Pho Saigon",
            "Steaming bowls of pho, vermicelli, and Vietnamese iced coffee.",
            ["vietnamese", "noodles", "soup"],
            ["gluten_free"],
            16.0,
            4.5,
            "Mon-Sun 10:00-21:30",
        ),
        (
            "The Vegan Diner",
            "Retro diner reimagined with plant-based burgers, shakes, and loaded fries.",
            ["american", "diner", "burgers"],
            ["vegan", "vegetarian"],
            21.0,
            4.4,
            "Mon-Sun 08:00-22:00",
        ),
        (
            "Napoli Pizzeria",
            "Neapolitan pizza from a 900-degree wood oven, blistered and bubbling.",
            ["italian", "pizza"],
            ["vegetarian"],
            24.0,
            4.6,
            "Tue-Sun 12:00-23:00",
        ),
        (
            "Tokyo Tempura",
            "Delicate tempura, soba, and a serene tatami-seating experience.",
            ["japanese", "tempura", "noodles"],
            ["vegetarian"],
            45.0,
            4.5,
            "Wed-Mon 17:00-22:00",
        ),
        (
            "El Jardin Mexicano",
            "Upscale Mexican with mole poblano, mezcal flights, and a garden patio.",
            ["mexican", "fine_dining"],
            ["vegetarian", "gluten_free"],
            48.0,
            4.7,
            "Tue-Sun 16:00-23:00",
        ),
        (
            "Curry & Kebab House",
            "Halal Pakistani grill: seekh kebabs, biryani, and buttery garlic naan.",
            ["pakistani", "indian", "grill"],
            ["halal"],
            23.0,
            4.5,
            "Mon-Sun 11:00-23:00",
        ),
        (
            "The Breakfast Club",
            "All-day brunch: fluffy pancakes, shakshuka, and bottomless coffee.",
            ["american", "brunch", "cafe"],
            ["vegetarian"],
            19.0,
            4.4,
            "Mon-Sun 07:00-15:00",
        ),
        (
            "Bangkok Street",
            "Fiery Thai street food, pad see ew, and coconut curries.",
            ["thai", "street_food", "curry"],
            ["vegan", "vegetarian", "gluten_free"],
            20.0,
            4.6,
            "Mon-Sun 11:00-22:00",
        ),
        (
            "Athena Greek Taverna",
            "Souvlaki, spanakopita, and a proper flaming saganaki tableside.",
            ["greek", "mediterranean"],
            ["vegetarian", "gluten_free"],
            31.0,
            4.5,
            "Tue-Sun 12:00-22:00",
        ),
        (
            "Prime Cut Steakhouse",
            "Dry-aged steaks, a deep bourbon shelf, and white-tablecloth service.",
            ["american", "steakhouse", "fine_dining"],
            ["gluten_free"],
            95.0,
            4.8,
            "Mon-Sat 17:00-23:00",
        ),
        (
            "Little Havana",
            "Cuban sandwiches, ropa vieja, and mojitos with live weekend music.",
            ["cuban", "latin"],
            [],
            26.0,
            4.4,
            "Wed-Sun 12:00-24:00",
        ),
        (
            "Sakura Kosher Deli",
            "Kosher-certified deli with pastrami, matzo ball soup, and rye.",
            ["deli", "jewish", "american"],
            ["kosher"],
            17.0,
            4.3,
            "Sun-Fri 08:00-18:00",
        ),
        (
            "Fusion Poke Lab",
            "Custom poke bowls, spicy tuna, and seaweed salads made to order.",
            ["hawaiian", "poke", "seafood"],
            ["gluten_free", "nut_free"],
            18.0,
            4.5,
            "Mon-Sun 11:00-21:00",
        ),
        (
            "Trattoria del Mare",
            "Coastal Italian: linguine alle vongole, branzino, and limoncello.",
            ["italian", "seafood"],
            ["gluten_free"],
            57.0,
            4.6,
            "Tue-Sun 17:00-22:30",
        ),
        (
            "The Falafel Cart",
            "Crispy falafel wraps, hummus, and shawarma from a beloved corner spot.",
            ["middle_eastern", "street_food"],
            ["vegan", "vegetarian", "halal"],
            11.0,
            4.5,
            "Mon-Sat 10:00-20:00",
        ),
        (
            "Maple & Oak Farmhouse",
            "Seasonal farm-to-table tasting menus with foraged garnishes.",
            ["american", "farm_to_table", "fine_dining"],
            ["vegetarian", "gluten_free"],
            110.0,
            4.9,
            "Thu-Sun 18:00-22:00",
        ),
        (
            "Shanghai Noodle House",
            "Hand-pulled noodles, xiao long bao, and scallion pancakes.",
            ["chinese", "noodles", "dumplings"],
            ["vegetarian"],
            19.0,
            4.5,
            "Mon-Sun 11:00-22:00",
        ),
        (
            "The Garden Cafe",
            "Light lunches, quiches, and pastries on a leafy sidewalk terrace.",
            ["cafe", "french", "bakery"],
            ["vegetarian", "nut_free"],
            16.0,
            4.3,
            "Mon-Sun 08:00-17:00",
        ),
        (
            "Baja Fish Tacos",
            "Beer-battered fish tacos, ceviche, and margaritas by the pitcher.",
            ["mexican", "seafood", "tacos"],
            ["gluten_free"],
            17.0,
            4.4,
            "Mon-Sun 11:00-22:00",
        ),
        (
            "Himalaya Momo",
            "Nepali dumplings, thukpa, and hearty dal bhat platters.",
            ["nepali", "tibetan", "dumplings"],
            ["vegetarian", "vegan"],
            15.0,
            4.6,
            "Tue-Sun 11:30-21:30",
        ),
        (
            "The Rooftop Grill",
            "Skyline views, sharing plates, and craft cocktails at golden hour.",
            ["american", "small_plates", "bar"],
            ["vegetarian"],
            44.0,
            4.4,
            "Wed-Sun 16:00-24:00",
        ),
        (
            "Osteria Bianca",
            "Northern Italian risotto, truffle tagliatelle, and Barolo pours.",
            ["italian", "fine_dining"],
            ["vegetarian", "gluten_free"],
            68.0,
            4.7,
            "Tue-Sat 17:30-22:30",
        ),
        (
            "Banh Mi Corner",
            "Crackly-crust banh mi, spring rolls, and lemongrass tofu.",
            ["vietnamese", "sandwiches", "street_food"],
            ["vegan", "vegetarian"],
            12.0,
            4.5,
            "Mon-Sat 09:00-19:00",
        ),
        (
            "Tandoori Nights",
            "Sizzling tandoor platters, paneer tikka, and mango lassi.",
            ["indian", "grill", "curry"],
            ["vegetarian", "halal", "gluten_free"],
            28.0,
            4.6,
            "Mon-Sun 12:00-23:00",
        ),
        (
            "The Waffle Window",
            "Liege waffles, savory and sweet, plus single-origin drip coffee.",
            ["cafe", "brunch", "dessert"],
            ["vegetarian", "nut_free"],
            13.0,
            4.4,
            "Mon-Sun 07:30-16:00",
        ),
        (
            "Cantina 88",
            "Tex-Mex fajitas, loaded nachos, and a tequila wall.",
            ["mexican", "tex_mex", "bar"],
            ["vegetarian"],
            25.0,
            4.3,
            "Mon-Sun 11:00-24:00",
        ),
        (
            "Kyoto Kaiseki",
            "Multi-course seasonal kaiseki in a hushed, minimalist room.",
            ["japanese", "kaiseki", "fine_dining"],
            ["vegetarian", "gluten_free"],
            120.0,
            4.9,
            "Thu-Sun 18:00-21:30",
        ),
        (
            "Smashburger Social",
            "Griddled smashburgers, crinkle fries, and spiked milkshakes.",
            ["american", "burgers", "bar"],
            [],
            18.0,
            4.4,
            "Mon-Sun 11:00-23:00",
        ),
        (
            "Cafe Con Leche",
            "Spanish tapas, paella for two, and sangria on a tiled patio.",
            ["spanish", "tapas"],
            ["vegetarian", "gluten_free"],
            39.0,
            4.5,
            "Tue-Sun 16:00-23:00",
        ),
        (
            "The Noodle Republic",
            "Pan-Asian noodles: laksa, drunken noodles, and dan dan.",
            ["asian", "noodles", "fusion"],
            ["vegan", "vegetarian"],
            17.0,
            4.4,
            "Mon-Sun 11:00-22:00",
        ),
        (
            "Harvest Table",
            "Vegetarian fine dining with a rotating produce-driven menu.",
            ["vegetarian", "fine_dining", "californian"],
            ["vegetarian", "vegan", "gluten_free", "nut_free"],
            72.0,
            4.8,
            "Wed-Sun 17:30-22:00",
        ),
        (
            "Guac & Roll",
            "Fast-casual burrito bowls with a killer housemade guacamole bar.",
            ["mexican", "fast_casual", "bowls"],
            ["vegan", "vegetarian", "gluten_free"],
            14.0,
            4.3,
            "Mon-Sun 10:30-22:00",
        ),
        (
            "The Oyster Bar",
            "West Coast oysters, chowder, and crisp Muscadet by the glass.",
            ["seafood", "raw_bar"],
            ["gluten_free"],
            49.0,
            4.6,
            "Tue-Sun 15:00-23:00",
        ),
        (
            "Berlin Doner",
            "Turkish-German doner kebabs, currywurst, and pilsner on tap.",
            ["german", "turkish", "street_food"],
            ["halal"],
            15.0,
            4.4,
            "Mon-Sun 11:00-24:00",
        ),
        (
            "Lotus Vegetarian",
            "Buddhist-inspired vegetarian dim sum and mock-meat classics.",
            ["chinese", "vegetarian", "dim_sum"],
            ["vegan", "vegetarian"],
            22.0,
            4.5,
            "Tue-Sun 11:00-21:00",
        ),
        (
            "The Grain Bar",
            "Warm grain bowls, house pickles, and cold-pressed juices.",
            ["healthy", "bowls", "cafe"],
            ["vegan", "vegetarian", "gluten_free", "nut_free"],
            16.0,
            4.3,
            "Mon-Fri 08:00-18:00",
        ),
        (
            "Fiorella Roman Kitchen",
            "Cacio e pepe, supplì, and negronis in a lively neighborhood spot.",
            ["italian", "roman", "pizza"],
            ["vegetarian"],
            36.0,
            4.6,
            "Mon-Sun 17:00-23:00",
        ),
        (
            "Seoul Fried Chicken",
            "Double-fried Korean chicken, gochujang wings, and cold beer.",
            ["korean", "chicken", "bar"],
            [],
            21.0,
            4.7,
            "Mon-Sun 12:00-24:00",
        ),
        (
            "Casablanca Tagine",
            "Moroccan tagines, couscous royale, and mint tea service.",
            ["moroccan", "middle_eastern"],
            ["vegetarian", "vegan", "halal", "gluten_free"],
            34.0,
            4.5,
            "Tue-Sun 17:00-22:30",
        ),
        (
            "The Pancake Mill",
            "Old-school breakfast counter with sourdough pancakes and hash.",
            ["american", "brunch", "diner"],
            ["vegetarian"],
            14.0,
            4.4,
            "Mon-Sun 06:30-14:00",
        ),
        (
            "Umami Burger Lab",
            "Chef-driven burgers, truffle fries, and a serious veggie patty.",
            ["american", "burgers", "gastropub"],
            ["vegetarian"],
            27.0,
            4.5,
            "Mon-Sun 11:00-23:00",
        ),
    ]

    restaurants: list[dict] = []
    for index, (name, description, cuisine_tags, dietary_tags, price, rating, hours) in enumerate(
        rows
    ):
        # Deterministic small jitter (~+/- 0.05 deg, roughly a few miles) around SF so
        # the cluster is reproducible run-to-run without importing `random`.
        lat = _SF_LAT + ((index % 11) - 5) * 0.009
        lon = _SF_LON + ((index % 13) - 6) * 0.008
        restaurants.append(
            {
                "name": name,
                "description": description,
                "cuisine_tags": cuisine_tags,
                "dietary_tags": dietary_tags,
                "price_avg": price,
                "address": f"{100 + index * 7} Market St, San Francisco, CA 94103",
                "lat": round(lat, 6),
                "long": round(lon, 6),
                "hours": hours,
                "avg_rating": rating,
            }
        )
    return restaurants


def _embedding_source(row: dict) -> str:
    """Build the natural-language string embedded for a restaurant."""
    return (
        f"{row['name']}. {row['description']}. "
        f"Cuisine: {', '.join(row['cuisine_tags'])}. "
        f"Dietary: {', '.join(row['dietary_tags']) or 'none'}."
    )


async def main() -> None:
    """Insert mock restaurants idempotently, embedding each (skipping gracefully on failure)."""
    rows = _mock_restaurants()
    print(f"Seeding {len(rows)} mock restaurants...")

    inserted = 0
    skipped = 0
    with_embedding = 0
    embed_warned = False

    async with async_session_factory() as session:
        for row in rows:
            existing = await session.execute(
                select(Restaurant).where(Restaurant.name == row["name"])
            )
            if existing.scalar_one_or_none() is not None:
                skipped += 1
                continue

            embedding: list[float] | None = None
            try:
                embedding = await embed_text(_embedding_source(row))
                with_embedding += 1
            except Exception as exc:  # noqa: BLE001 — embedding is best-effort here.
                if not embed_warned:
                    print(
                        "WARNING: embedding failed (missing OPENROUTER_API_KEY or "
                        f"offline?): {exc}. Inserting affected rows with embedding=None."
                    )
                    embed_warned = True

            session.add(Restaurant(embedding=embedding, **row))
            inserted += 1

        await session.commit()

    print(
        f"Done. inserted={inserted}, skipped(existing)={skipped}, "
        f"with_embedding={with_embedding}, without_embedding={inserted - with_embedding}."
    )


if __name__ == "__main__":
    asyncio.run(main())
