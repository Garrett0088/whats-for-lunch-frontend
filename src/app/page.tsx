"use client"; // useState and useEffect require a Client Component

import { useEffect, useState } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────
// Mirrors RestaurantResponse from the FastAPI schemas
type Restaurant = {
  id: number;
  name: string;
  address: string | null;
  zip_code: string | null;
  cuisine_tag: string | null;
  user_rating: number | null;
  visit_count: number;
  notes: string | null;
  created_at: string;
};

// Mirrors DishResponse from the FastAPI schemas
type Dish = {
  id: number;
  name: string;
  restaurant_id: number; // foreign key — used to build the detail page link
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
// Same 6-color set used across all pages — assigned by index for visual variety
const CARD_COLORS = [
  { bg: "bg-rose-100",    accent: "text-rose-700",    tag: "bg-rose-200 text-rose-900"    },
  { bg: "bg-amber-100",   accent: "text-amber-700",   tag: "bg-amber-200 text-amber-900"  },
  { bg: "bg-emerald-100", accent: "text-emerald-700", tag: "bg-emerald-200 text-emerald-900" },
  { bg: "bg-sky-100",     accent: "text-sky-700",     tag: "bg-sky-200 text-sky-900"      },
  { bg: "bg-violet-100",  accent: "text-violet-700",  tag: "bg-violet-200 text-violet-900" },
  { bg: "bg-orange-100",  accent: "text-orange-700",  tag: "bg-orange-200 text-orange-900" },
];

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

// ── MarqueeBar ────────────────────────────────────────────────────────────────
// Sticky ticker at the top showing all restaurant names as clickable pills.
// Uses the CSS scroll-left keyframe (defined in the <style> tag below).
// Hover over the bar pauses the animation so users can read and click a name.
function MarqueeBar({ restaurants }: { restaurants: Restaurant[] }) {
  // paused controls animation-play-state on the scrolling inner div
  const [paused, setPaused] = useState(false);

  if (restaurants.length === 0) return null;

  // Double the list so when the first copy scrolls fully off-screen (-50%),
  // the second copy fills the view seamlessly — creating an infinite loop.
  const doubled = [...restaurants, ...restaurants];

  return (
    <div
      // -mx-6 cancels the parent <main>'s p-6 left/right padding so the bar is edge-to-edge.
      // -mt-6 cancels the top padding so it sits flush against the layout nav bar.
      // sticky top-0 makes it stay visible as the user scrolls the hero section.
      className="sticky top-0 z-50 -mx-6 -mt-6 bg-indigo-700 text-white overflow-hidden py-2 shadow-lg"
      onMouseEnter={() => setPaused(true)}  // pause so users can click a name
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="flex gap-6 whitespace-nowrap"
        style={{
          animation: "scroll-left 20s linear infinite",
          animationPlayState: paused ? "paused" : "running",
        }}
      >
        {doubled.map((r, i) => (
          // Each restaurant name links to its detail page — uses restaurant.id as the URL param
          <Link
            key={`${r.id}-${i}`}
            href={`/restaurants/${r.id}`}
            className="px-4 py-0.5 rounded-full bg-indigo-600 hover:bg-indigo-500
                       transition-colors text-sm font-medium shrink-0"
          >
            {r.name}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── DishRow ───────────────────────────────────────────────────────────────────
// A single row of scrolling dish name pills.
// direction: "left" or "right" selects which CSS keyframe to use.
// animDuration: controls speed — higher value = slower scroll.
// emoji: small icon appended after each dish name to indicate category.
// Hover over a row pauses only that row; other rows keep moving.
function DishRow({
  dishes,
  direction,
  animDuration,
  emoji,
}: {
  dishes: Dish[];
  direction: "left" | "right";
  animDuration: number;
  emoji: string;
}) {
  const [paused, setPaused] = useState(false);

  if (dishes.length === 0) return null;

  // Double the list for the seamless loop — same trick as MarqueeBar
  const doubled = [...dishes, ...dishes];
  const animName = direction === "left" ? "scroll-left" : "scroll-right";

  return (
    <div
      className="overflow-hidden py-1"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="flex gap-4 whitespace-nowrap"
        style={{
          animation: `${animName} ${animDuration}s linear infinite`,
          animationPlayState: paused ? "paused" : "running",
        }}
      >
        {doubled.map((dish, i) => (
          // Link goes to the restaurant detail page with a highlight query param
          // so the dish appears first in the grid when the user arrives
          <Link
            key={`${dish.id}-${i}`}
            href={`/restaurants/${dish.restaurant_id}?highlight=${dish.id}`}
            className="shrink-0 px-4 py-1.5 rounded-full bg-white/80 border border-gray-200
                       shadow-sm text-sm font-medium text-gray-700
                       hover:bg-white hover:shadow-md transition-all duration-150"
          >
            {dish.name} {emoji}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function HomePage() {
  // Both endpoints are fetched in parallel and stored separately
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [dishes, setDishes]           = useState<Dish[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  // ── Data fetching ───────────────────────────────────────────────────────────
  // Runs once on mount. Fires both requests at the same time via Promise.all
  // so both lists are ready together instead of sequentially.
  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL;

    Promise.all([
      fetch(`${apiBase}/restaurants`).then((r) => {
        if (!r.ok) throw new Error(`Restaurants: server responded with ${r.status}`);
        return r.json() as Promise<Restaurant[]>;
      }),
      fetch(`${apiBase}/dishes`).then((r) => {
        if (!r.ok) throw new Error(`Dishes: server responded with ${r.status}`);
        return r.json() as Promise<Dish[]>;
      }),
    ])
      .then(([allRestaurants, allDishes]) => {
        setRestaurants(allRestaurants);
        setDishes(allDishes);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false)); // always clear the loading state
  }, []); // empty deps → runs once on mount

  // ── Category splits for the three ticker rows ───────────────────────────────
  // Meal row: anything that functions as a main course
  const mealDishes  = dishes.filter((d) =>
    ["meal", "sandwich", "salad", "soup"].includes(d.category ?? "")
  );
  // Drink row: beverages only
  const drinkDishes = dishes.filter((d) => d.category === "drink");
  // Side row: sides and snacks
  const sideDishes  = dishes.filter((d) => d.category === "side");

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <FoodPatternBackground />
        <div className="flex justify-center items-center min-h-screen">
          <p className="text-gray-400 text-xl animate-pulse">Loading…</p>
        </div>
      </>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <>
        <FoodPatternBackground />
        <div className="flex flex-col justify-center items-center min-h-screen gap-3">
          <p className="text-2xl text-red-500 font-semibold">Could not load data</p>
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
      {/* CSS keyframes injected once — required because Tailwind cannot define
          arbitrary animation names without modifying tailwind.config.js.
          scroll-left: moves content from 0 → -50% (first copy scrolls off, second appears).
          scroll-right: the reverse — used for Row 2 so it moves in the opposite direction. */}
      <style>{`
        @keyframes scroll-left {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes scroll-right {
          from { transform: translateX(-50%); }
          to   { transform: translateX(0); }
        }
      `}</style>

      {/* Fixed SVG food texture sits behind all sections */}
      <FoodPatternBackground />

      {/* ── Section 1: Restaurant name ticker ─────────────────────────────────
          Sticky at the top; each name links to that restaurant's detail page  */}
      <MarqueeBar restaurants={restaurants} />

      {/* ── Section 2: Hero ───────────────────────────────────────────────────
          Full viewport height, centered — the main landing experience         */}
      <section className="pt-16 pb-10 flex flex-col items-center gap-6 px-6 text-center">
        <h1 className="text-6xl font-extrabold text-gray-800 leading-tight">
          What&apos;s For <span className="text-indigo-600">Lunch?</span>
        </h1>
        <p className="text-xl text-gray-500 max-w-md">
          Discover meals people actually love
        </p>

        {/* Three nav buttons — each uses a distinct color from CARD_COLORS so
            they're visually unique without needing custom color values          */}
        <div className="flex flex-wrap gap-4 justify-center mt-4">
          <Link
            href="/restaurants"
            className={`px-8 py-4 rounded-2xl text-lg font-bold shadow-md
                        ${CARD_COLORS[0].bg} ${CARD_COLORS[0].accent}
                        hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200`}
          >
            🍽 Restaurants
          </Link>
          <Link
            href="/dishes"
            className={`px-8 py-4 rounded-2xl text-lg font-bold shadow-md
                        ${CARD_COLORS[2].bg} ${CARD_COLORS[2].accent}
                        hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200`}
          >
            🥗 Dishes
          </Link>
          <Link
            href="/recommend"
            className={`px-8 py-4 rounded-2xl text-lg font-bold shadow-md
                        ${CARD_COLORS[3].bg} ${CARD_COLORS[3].accent}
                        hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200`}
          >
            🤖 Snack Chat
          </Link>
        </div>
      </section>

      {/* ── Section 3: Dish ticker rows ───────────────────────────────────────
          Three rows of dish names at slightly different speeds and directions.
          Rows that have no data (e.g. no drinks in the DB) are automatically
          skipped because DishRow returns null when dishes.length === 0.        */}
      <section className="pb-8 flex flex-col gap-10">
        {/* Row 1 — Meals: sandwiches, salads, soups, and mains. Scrolls left at 22s. */}
        <DishRow dishes={mealDishes}  direction="left"  animDuration={22} emoji="🍽" />
        {/* Row 2 — Drinks: scrolls right at 18s for visual contrast with Rows 1 and 3. */}
        <DishRow dishes={drinkDishes} direction="right" animDuration={10} emoji="🥤" />
        {/* Row 3 — Sides: slowest scroll (25s) so the three rows feel layered. */}
        <DishRow dishes={sideDishes}  direction="left"  animDuration={25} emoji="🍟" />
      </section>
    </>
  );
}
