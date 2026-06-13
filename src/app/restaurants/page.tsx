"use client"; // This page uses useState and useEffect, so it must be a Client Component

import { useEffect, useState } from "react";
import Link from "next/link";

// ── Type ─────────────────────────────────────────────────────────────────────
// Mirrors RestaurantResponse from the FastAPI schemas — every field the API returns
type Restaurant = {
  id: number;
  name: string;
  address: string | null;
  zip_code: string | null;
  cuisine_tag: string | null;
  user_rating: number | null; // null until the user rates the restaurant
  visit_count: number;
  notes: string | null;
  created_at: string;
};

// ── Distance lookup ───────────────────────────────────────────────────────────
// Estimated straight-line miles from CSTU (1601 McCarthy Blvd, Milpitas, CA 95035)
// to each restaurant in the seed data. Rounded to the nearest 0.5 mi.
// Calculated by comparing lat/lon coordinates — placeholder until a geo API is added.
const DISTANCES_FROM_CSTU: Record<string, number> = {
  "BJ's Restaurant": 8.0,          // Stevens Creek Blvd, west San Jose
  Chipotle: 3.5,                    // Brokaw Rd, north San Jose — closest to campus
  Dishdash: 8.0,                    // S Murphy Ave, Sunnyvale
  "King Eggroll": 4.0,              // Berryessa Rd, north San Jose
  "Mendocino Farms": 4.5,           // Freedom Circle, Santa Clara
  Panera: 8.0,                      // Olin Ave, central San Jose
  Starbucks: 3.0,                   // River Oaks Pl, San Jose
  "Koi Palace (鲤鱼门)": 2.5,       // Barber Ln, Milpitas
  "Uncle Cha": 1.5,                 // N Milpitas Blvd, Milpitas
  "Cheung Hing (祥兴)": 3.0,        // E Calaveras Blvd, Milpitas
  "Taiwan Porridge": 2.0,           // N Milpitas Blvd, Milpitas
  "HL Peninsula (半岛酒家)": 1.2,   // Ranch Drive, Milpitas
};

// ── Card color palette ────────────────────────────────────────────────────────
// Each card cycles through these Tailwind color sets so no two adjacent cards
// look the same. Assigned by sorted index so order is deterministic.
const CARD_COLORS = [
  { bg: "bg-rose-100",    accent: "text-rose-700",    tag: "bg-rose-200 text-rose-900"    },
  { bg: "bg-amber-100",   accent: "text-amber-700",   tag: "bg-amber-200 text-amber-900"  },
  { bg: "bg-emerald-100", accent: "text-emerald-700", tag: "bg-emerald-200 text-emerald-900" },
  { bg: "bg-sky-100",     accent: "text-sky-700",     tag: "bg-sky-200 text-sky-900"      },
  { bg: "bg-violet-100",  accent: "text-violet-700",  tag: "bg-violet-200 text-violet-900"},
  { bg: "bg-orange-100",  accent: "text-orange-700",  tag: "bg-orange-200 text-orange-900"},
];

// ── Star rating sub-component ─────────────────────────────────────────────────
// Renders filled stars (★), a half indicator, and empty stars (☆) for a 0–5 rating
function StarRating({ rating }: { rating: number | null }) {
  if (rating === null)
    return <span className="text-gray-400 text-sm italic">No rating yet</span>;

  const full  = Math.floor(rating);           // number of completely filled stars
  const half  = rating % 1 >= 0.5 ? 1 : 0;  // 1 if the decimal is ≥ 0.5
  const empty = 5 - full - half;              // remaining empty stars to fill the row of 5

  return (
    <span aria-label={`${rating} out of 5 stars`}>
      {/* Filled stars */}
      <span className="text-yellow-400 text-xl">{"★".repeat(full)}</span>
      {/* Half star shown as a smaller filled star */}
      {half === 1 && <span className="text-yellow-300 text-xl">★</span>}
      {/* Empty stars */}
      <span className="text-gray-300 text-xl">{"★".repeat(empty)}</span>
      {/* Numeric value beside the stars for clarity */}
      <span className="ml-1 text-sm text-gray-500">({rating.toFixed(1)})</span>
    </span>
  );
}

// ── Background pattern ────────────────────────────────────────────────────────
// Renders a fixed, full-viewport SVG tiled with fork, knife, and plate shapes.
// Positioned behind all content via -z-10; pointer-events disabled so it never
// interferes with clicks. Opacity kept very low so it reads as a texture.
function FoodPatternBackground() {
  return (
    <div
      className="fixed inset-0 -z-10 pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      <svg
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        style={{ opacity: 0.07 }}
      >
        <defs>
          {/* One 130×130 tile containing a fork, knife, and plate */}
          <pattern
            id="food-pattern"
            x="0"
            y="0"
            width="130"
            height="130"
            patternUnits="userSpaceOnUse"
          >
            {/* Fork — three tines meeting at a crossbar, narrowing to a handle */}
            <g transform="translate(18, 12)">
              <line x1="4"  y1="0"  x2="4"  y2="22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="11" y1="0"  x2="11" y2="22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="18" y1="0"  x2="18" y2="22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="4"  y1="14" x2="18" y2="14" stroke="currentColor" strokeWidth="2"   strokeLinecap="round" />
              <line x1="11" y1="22" x2="11" y2="55" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </g>

            {/* Knife — straight handle with a tapered blade on one side */}
            <g transform="translate(65, 12)">
              <line x1="8" y1="0"  x2="8"  y2="55" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <path
                d="M8,0 C8,0 20,6 20,22 L8,28 Z"
                fill="currentColor"
              />
            </g>

            {/* Plate — two concentric ellipses suggesting depth */}
            <g transform="translate(28, 78)">
              <ellipse cx="22" cy="13" rx="22" ry="13" stroke="currentColor" strokeWidth="2" fill="none" />
              <ellipse cx="22" cy="13" rx="14" ry="8"  stroke="currentColor" strokeWidth="1.5" fill="none" />
            </g>
          </pattern>
        </defs>
        {/* Fill the entire viewport with the tile */}
        <rect width="100%" height="100%" fill="url(#food-pattern)" />
      </svg>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function RestaurantsPage() {
  // sorted restaurant list populated after the API call resolves
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  // true while the fetch is in-flight
  const [loading, setLoading] = useState(true);
  // non-null when the fetch fails — displayed in an error banner
  const [error, setError] = useState<string | null>(null);

  // ── Data fetching ───────────────────────────────────────────────────────────
  // Runs once on mount. Reads the API base URL from the env so the same build
  // works against any backend without hardcoding localhost.
  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL;

    fetch(`${apiBase}/restaurants`)
      .then((res) => {
        // Treat any non-2xx HTTP status as an error
        if (!res.ok) throw new Error(`Server responded with ${res.status}`);
        return res.json() as Promise<Restaurant[]>;
      })
      .then((data) => {
        // Sort rules:
        //   Primary   → distance from CSTU, ascending (closest first)
        //   Secondary → user_rating, descending (highest first) when distances tie
        const sorted = [...data].sort((a, b) => {
          const distA = DISTANCES_FROM_CSTU[a.name] ?? 999; // unknown restaurants go last
          const distB = DISTANCES_FROM_CSTU[b.name] ?? 999;
          if (distA !== distB) return distA - distB;
          return (b.user_rating ?? 0) - (a.user_rating ?? 0);
        });
        setRestaurants(sorted);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false)); // always clear the loading spinner
  }, []); // empty deps → runs once on mount, never re-runs

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <FoodPatternBackground />
        <div className="flex justify-center items-center min-h-[50vh]">
          <p className="text-gray-400 text-xl animate-pulse">Loading restaurants…</p>
        </div>
      </>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <>
        <FoodPatternBackground />
        <div className="flex flex-col justify-center items-center min-h-[50vh] gap-3">
          <p className="text-2xl text-red-500 font-semibold">Could not load restaurants</p>
          <p className="text-gray-500 text-sm">{error}</p>
          <p className="text-gray-400 text-xs">
            Make sure the API is running and NEXT_PUBLIC_API_URL is set correctly.
          </p>
        </div>
      </>
    );
  }

  // ── Populated state ─────────────────────────────────────────────────────────
  return (
    <>
      {/* Subtle tiled SVG texture sits behind everything else */}
      <FoodPatternBackground />

      {/* Page header — title + subtitle showing restaurant count */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800">
          Restaurants Near{" "}
          <span className="text-indigo-600">CSTU</span>
        </h1>
        <p className="mt-2 text-gray-500 text-sm">
          Sorted by distance from 1601 McCarthy Blvd, Milpitas &nbsp;·&nbsp;{" "}
          {restaurants.length} spot{restaurants.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* ── Restaurant grid ─────────────────────────────────────────────────────
          Responsive breakpoints:
            mobile  → 1 column  (grid-cols-1)
            tablet  → 2 columns (sm:grid-cols-2)
            desktop → 3 columns (lg:grid-cols-3)                               */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {restaurants.map((restaurant, index) => {
          // Pick a color set based on sorted position — wraps around for > 6 restaurants
          const colors   = CARD_COLORS[index % CARD_COLORS.length];
          const distance = DISTANCES_FROM_CSTU[restaurant.name]; // may be undefined for unknown restaurants

          return (
            <Link
              key={restaurant.id}
              href={`/restaurants/${restaurant.id}`}
              className={`
                ${colors.bg}
                rounded-2xl shadow-md p-5
                flex flex-col gap-3
                hover:shadow-xl hover:-translate-y-0.5
                transition-all duration-200
                cursor-pointer
              `}
            >
              {/* Restaurant name — large and colored to match the card palette */}
              <h2 className={`text-2xl font-bold leading-tight ${colors.accent}`}>
                {restaurant.name}
              </h2>

              {/* Cuisine tag — pill badge using a slightly darker shade of the card color */}
              {restaurant.cuisine_tag && (
                <span
                  className={`
                    self-start px-3 py-0.5 rounded-full
                    text-xs font-semibold uppercase tracking-wider
                    ${colors.tag}
                  `}
                >
                  {restaurant.cuisine_tag}
                </span>
              )}

              {/* Street address */}
              {restaurant.address && (
                <p className="text-sm text-gray-600 leading-snug">
                  {restaurant.address}
                </p>
              )}

              {/* Distance from CSTU — shown as "X.X miles from CSTU" */}
              {distance !== undefined ? (
                <p className="text-sm font-medium text-gray-500">
                  📍 {distance.toFixed(1)} miles from CSTU
                </p>
              ) : (
                // Fallback for any restaurant not yet in the distance lookup
                <p className="text-sm text-gray-400 italic">Distance unknown</p>
              )}

              {/* Thin divider before the stats section */}
              <hr className="border-gray-300/60" />

              {/* User rating — rendered as stars with numeric value */}
              <div>
                <span className="block text-xs text-gray-400 uppercase tracking-wide mb-0.5">
                  Your Rating
                </span>
                <StarRating rating={restaurant.user_rating} />
              </div>

              {/* Visit count — how many times the user has been here */}
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-800">{restaurant.visit_count}</span>{" "}
                {restaurant.visit_count === 1 ? "visit" : "visits"} logged
              </p>
            </Link>
          );
        })}
      </div>
    </>
  );
}
