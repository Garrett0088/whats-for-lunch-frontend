"use client"; // useState and useEffect require a Client Component

import { useEffect, useState } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────
// Mirrors RestaurantResponse from the FastAPI schemas — all fields the API returns
type Restaurant = {
  id: number;
  name: string;
  address: string | null;
  zip_code: string | null;
  cuisine_tag: string | null;
  user_rating: number | null; // null until the user has rated this restaurant
  visit_count: number;
  notes: string | null;
  created_at: string;
};

// Mirrors DishResponse from the FastAPI schemas
type Dish = {
  id: number;
  name: string;
  restaurant_id: number; // foreign key linking this dish to its parent restaurant
  category: string | null;
  price_range: string | null;
  user_rating: number | null;
  times_ordered: number;
  notes: string | null;
  is_vegetarian: boolean;
  is_spicy: boolean;
  created_at: string;
};

// ── Card color palette ────────────────────────────────────────────────────────
// Same 6-color set used across all pages — cards cycle through this array by index
const CARD_COLORS = [
  { bg: "bg-rose-100",    accent: "text-rose-700",    tag: "bg-rose-200 text-rose-900"    },
  { bg: "bg-amber-100",   accent: "text-amber-700",   tag: "bg-amber-200 text-amber-900"  },
  { bg: "bg-emerald-100", accent: "text-emerald-700", tag: "bg-emerald-200 text-emerald-900" },
  { bg: "bg-sky-100",     accent: "text-sky-700",     tag: "bg-sky-200 text-sky-900"      },
  { bg: "bg-violet-100",  accent: "text-violet-700",  tag: "bg-violet-200 text-violet-900" },
  { bg: "bg-orange-100",  accent: "text-orange-700",  tag: "bg-orange-200 text-orange-900" },
];

// ── Star rating sub-component ─────────────────────────────────────────────────
// Renders filled ★ and empty ★ for a 0–5 scale — copied verbatim from restaurants/page.tsx
function StarRating({ rating }: { rating: number | null }) {
  if (rating === null)
    return <span className="text-gray-400 text-sm italic">No rating yet</span>;

  const full  = Math.floor(rating);          // number of fully filled stars
  const half  = rating % 1 >= 0.5 ? 1 : 0; // 1 if the fractional part is ≥ 0.5
  const empty = 5 - full - half;             // remaining empty stars to reach 5 total

  return (
    <span aria-label={`${rating} out of 5 stars`}>
      {/* Fully filled stars */}
      <span className="text-yellow-400 text-xl">{"★".repeat(full)}</span>
      {/* Half star shown as a lighter filled star */}
      {half === 1 && <span className="text-yellow-300 text-xl">★</span>}
      {/* Empty stars */}
      <span className="text-gray-300 text-xl">{"★".repeat(empty)}</span>
      {/* Numeric value beside the stars for precision */}
      <span className="ml-1 text-sm text-gray-500">({rating.toFixed(1)})</span>
    </span>
  );
}

// ── Background pattern ────────────────────────────────────────────────────────
// Fixed, full-viewport SVG tiled with fork, knife, and plate shapes.
// Copied verbatim from restaurants/page.tsx — same texture on every page.
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
              <path d="M8,0 C8,0 20,6 20,22 L8,28 Z" fill="currentColor" />
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
// params.id comes from the [id] folder name in the route — it is always a string.
// searchParams.highlight is the dish id set by dish ticker links on the home page;
// the highlighted dish appears first in the grid with an amber ring around it.
export default function RestaurantDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { highlight?: string };
}) {
  // restaurant is null before load completes, or if the id doesn't match any record
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  // dishes belonging to this specific restaurant only
  const [dishes, setDishes]         = useState<Dish[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  // ── Data fetching ───────────────────────────────────────────────────────────
  // Fetches all restaurants and all dishes in parallel, then filters both
  // client-side. There is no GET /restaurants/:id endpoint, so we fetch the
  // full list and find the matching record by id.
  useEffect(() => {
    const apiBase  = process.env.NEXT_PUBLIC_API_URL;
    // params.id is a URL string; restaurant.id is a number — parse before comparing
    const targetId = parseInt(params.id, 10);

    Promise.all([
      // Fetch all restaurants — we'll find the one matching targetId below
      fetch(`${apiBase}/restaurants`).then((r) => {
        if (!r.ok) throw new Error(`Restaurants: server responded with ${r.status}`);
        return r.json() as Promise<Restaurant[]>;
      }),
      // Fetch all dishes — we'll filter to only this restaurant's dishes below
      fetch(`${apiBase}/dishes`).then((r) => {
        if (!r.ok) throw new Error(`Dishes: server responded with ${r.status}`);
        return r.json() as Promise<Dish[]>;
      }),
    ])
      .then(([allRestaurants, allDishes]) => {
        // Find the single restaurant whose id matches the URL param
        const found = allRestaurants.find((r) => r.id === targetId) ?? null;
        // Keep only dishes that belong to this restaurant
        const filtered = allDishes.filter((d) => d.restaurant_id === targetId);
        setRestaurant(found);
        setDishes(filtered);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false)); // always clear the loading spinner
  }, [params.id]); // re-run if the route param changes (e.g. user navigates between restaurants)

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <FoodPatternBackground />
        <div className="flex justify-center items-center min-h-[60vh]">
          <p className="text-gray-400 text-xl animate-pulse">Loading restaurant…</p>
        </div>
      </>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <>
        <FoodPatternBackground />
        <div className="flex flex-col justify-center items-center min-h-[60vh] gap-3">
          <p className="text-2xl text-red-500 font-semibold">Could not load data</p>
          <p className="text-gray-500 text-sm">{error}</p>
          <p className="text-gray-400 text-xs">
            Make sure the API is running and NEXT_PUBLIC_API_URL is set correctly.
          </p>
        </div>
      </>
    );
  }

  // ── Not found state ─────────────────────────────────────────────────────────
  // The fetch succeeded but no restaurant matched the id in the URL
  if (!restaurant) {
    return (
      <>
        <FoodPatternBackground />
        <div className="flex flex-col justify-center items-center min-h-[60vh] gap-4">
          <p className="text-2xl text-gray-600 font-semibold">Restaurant not found</p>
          <Link href="/restaurants" className="text-indigo-600 hover:underline font-medium">
            ← Back to Restaurants
          </Link>
        </div>
      </>
    );
  }

  // ── Dish sort order ─────────────────────────────────────────────────────────
  // The ?highlight=<id> param comes from dish ticker links on the home page.
  // The highlighted dish is pinned to the front of the grid with a visual ring.
  // All remaining dishes are sorted by user_rating descending (best first).
  const highlightId  = searchParams.highlight ? parseInt(searchParams.highlight, 10) : null;
  const highlighted  = highlightId !== null ? dishes.find((d) => d.id === highlightId) : undefined;
  const rest         = dishes
    .filter((d) => d.id !== highlightId)
    .sort((a, b) => (b.user_rating ?? 0) - (a.user_rating ?? 0));
  // Highlighted dish appears at index 0; the rest follow in rating order
  const sortedDishes = highlighted ? [highlighted, ...rest] : rest;

  // ── Populated state ─────────────────────────────────────────────────────────
  return (
    <>
      {/* Fixed SVG food texture sits behind all content */}
      <FoodPatternBackground />

      <div className="max-w-5xl mx-auto">
        {/* Back button — returns the user to the restaurant list */}
        <Link
          href="/restaurants"
          className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800
                     font-medium mb-6 transition-colors"
        >
          ← Back to Restaurants
        </Link>

        {/* ── Restaurant header ─────────────────────────────────────────────── */}
        <div className="mb-8">
          {/* Restaurant name — large heading as the focal point of the page */}
          <h1 className="text-4xl font-extrabold text-gray-800 mb-3">
            {restaurant.name}
          </h1>

          {/* Cuisine type — pill badge using indigo to match the app's nav color */}
          {restaurant.cuisine_tag && (
            <span className="inline-block px-3 py-0.5 rounded-full
                             bg-indigo-100 text-indigo-800
                             text-sm font-semibold uppercase tracking-wider mb-3">
              {restaurant.cuisine_tag}
            </span>
          )}

          {/* Star rating — same component as the restaurants list page */}
          <div className="mb-2">
            <StarRating rating={restaurant.user_rating} />
          </div>

          {/* Street address */}
          {restaurant.address && (
            <p className="text-gray-500 text-sm">📍 {restaurant.address}</p>
          )}
        </div>

        {/* ── Dish grid ─────────────────────────────────────────────────────── */}
        <h2 className="text-2xl font-bold text-gray-700 mb-4">
          Dishes ({sortedDishes.length})
        </h2>

        {sortedDishes.length === 0 ? (
          // Shown when the restaurant has no dishes recorded yet
          <p className="text-gray-400 italic">No dishes on record for this restaurant.</p>
        ) : (
          // Responsive grid — 1 col mobile, 2 col tablet, 3 col desktop (same as other pages)
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedDishes.map((dish, index) => {
              // Color palette cycles by grid position — same pattern as restaurants page
              const colors        = CARD_COLORS[index % CARD_COLORS.length];
              // True only for the dish whose id matches the ?highlight param
              const isHighlighted = dish.id === highlightId;

              return (
                <div
                  key={dish.id}
                  className={`
                    ${colors.bg}
                    rounded-2xl shadow-md p-5
                    flex flex-col gap-3
                    hover:shadow-xl hover:-translate-y-0.5
                    transition-all duration-200
                    ${isHighlighted ? "ring-2 ring-offset-2 ring-amber-400" : ""}
                  `}
                >
                  {/* Highlighted badge — only visible on the dish linked from the home page */}
                  {isHighlighted && (
                    <span className="self-start px-2 py-0.5 rounded-full
                                     bg-amber-200 text-amber-900
                                     text-xs font-bold uppercase tracking-wider">
                      ✨ Recommended
                    </span>
                  )}

                  {/* Dish name — colored to match the card's accent shade */}
                  <h3 className={`text-xl font-bold leading-tight ${colors.accent}`}>
                    {dish.name}
                  </h3>

                  {/* Category badge — e.g. "sandwich", "side", "drink" */}
                  {dish.category && (
                    <span className={`self-start px-3 py-0.5 rounded-full
                                      text-xs font-semibold uppercase tracking-wider
                                      ${colors.tag}`}>
                      {dish.category}
                    </span>
                  )}

                  {/* Dietary badges — only rendered when the flag is true */}
                  <div className="flex flex-wrap gap-2">
                    {dish.is_vegetarian && (
                      <span className="px-2 py-0.5 rounded-full
                                       bg-emerald-100 text-emerald-800
                                       text-xs font-semibold">
                        #Vegi
                      </span>
                    )}
                    {dish.is_spicy && (
                      <span className="px-2 py-0.5 rounded-full
                                       bg-red-100 text-red-800
                                       text-xs font-semibold">
                        #Spicy
                      </span>
                    )}
                  </div>

                  {/* Thin divider before the rating section */}
                  <hr className="border-gray-300/60" />

                  {/* Star rating for this specific dish */}
                  <div>
                    <span className="block text-xs text-gray-400 uppercase tracking-wide mb-0.5">
                      Your Rating
                    </span>
                    <StarRating rating={dish.user_rating} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
