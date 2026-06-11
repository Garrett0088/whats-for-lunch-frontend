"use client"; // useState + useEffect require a Client Component

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────
// Mirrors DishResponse from the FastAPI schemas
type Dish = {
  id: number;
  name: string;
  restaurant_id: number;
  category: string | null;
  price_range: string | null;
  user_rating: number | null;
  times_ordered: number;
  notes: string | null;
  is_vegetarian: boolean;
  is_spicy: boolean;
  created_at: string;
};

// Minimal restaurant shape — we only need id and name for the join
type Restaurant = {
  id: number;
  name: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 6; // dishes visible in the grid at one time

// Same pastel palette as Restaurants page — assigned by card index so each slot is distinct
const CARD_COLORS = [
  { bg: "bg-rose-100",    accent: "text-rose-700",    tag: "bg-rose-200 text-rose-900"       },
  { bg: "bg-amber-100",   accent: "text-amber-700",   tag: "bg-amber-200 text-amber-900"     },
  { bg: "bg-emerald-100", accent: "text-emerald-700", tag: "bg-emerald-200 text-emerald-900" },
  { bg: "bg-sky-100",     accent: "text-sky-700",     tag: "bg-sky-200 text-sky-900"         },
  { bg: "bg-violet-100",  accent: "text-violet-700",  tag: "bg-violet-200 text-violet-900"   },
  { bg: "bg-orange-100",  accent: "text-orange-700",  tag: "bg-orange-200 text-orange-900"   },
];

// ── Utilities ─────────────────────────────────────────────────────────────────

// Fisher-Yates shuffle — always returns a NEW array, never mutates the input
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Sub-components ────────────────────────────────────────────────────────────

// StarRating: same ★/☆ display used on the Restaurants page
function StarRating({ rating }: { rating: number | null }) {
  if (rating === null)
    return <span className="text-gray-400 text-sm italic">No rating yet</span>;

  const full  = Math.floor(rating);
  const half  = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;

  return (
    <span aria-label={`${rating} out of 5 stars`}>
      <span className="text-yellow-400 text-lg">{"★".repeat(full)}</span>
      {half === 1 && <span className="text-yellow-300 text-lg">★</span>}
      <span className="text-gray-300 text-lg">{"★".repeat(empty)}</span>
      <span className="ml-1 text-sm text-gray-500">({rating.toFixed(1)})</span>
    </span>
  );
}

// FoodPatternBackground: fixed SVG tile with fork, knife, and plate shapes.
// Identical to the Restaurants page so both pages share the same visual language.
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
          {/* One 130×130 tile: fork (left), knife (center), plate (bottom) */}
          <pattern
            id="food-pattern"
            x="0"
            y="0"
            width="130"
            height="130"
            patternUnits="userSpaceOnUse"
          >
            {/* Fork — three tines + crossbar narrowing to a handle */}
            <g transform="translate(18, 12)">
              <line x1="4"  y1="0"  x2="4"  y2="22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="11" y1="0"  x2="11" y2="22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="18" y1="0"  x2="18" y2="22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="4"  y1="14" x2="18" y2="14" stroke="currentColor" strokeWidth="2"   strokeLinecap="round" />
              <line x1="11" y1="22" x2="11" y2="55" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </g>
            {/* Knife — straight handle with a tapered blade */}
            <g transform="translate(65, 12)">
              <line x1="8" y1="0" x2="8" y2="55" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M8,0 C8,0 20,6 20,22 L8,28 Z" fill="currentColor" />
            </g>
            {/* Plate — two concentric ellipses */}
            <g transform="translate(28, 78)">
              <ellipse cx="22" cy="13" rx="22" ry="13" stroke="currentColor" strokeWidth="2"   fill="none" />
              <ellipse cx="22" cy="13" rx="14" ry="8"  stroke="currentColor" strokeWidth="1.5" fill="none" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#food-pattern)" />
      </svg>
    </div>
  );
}

// ── Filter bar ─────────────────────────────────────────────────────────────────
// Dark pill-toggle toolbar sitting below the page header.
// Category pills are all-on by default; tag pills are off by default.
interface FilterBarProps {
  showMeal:    boolean; setShowMeal:    (v: boolean) => void;
  showSide:    boolean; setShowSide:    (v: boolean) => void;
  showDrink:   boolean; setShowDrink:   (v: boolean) => void;
  filterVegi:  boolean; setFilterVegi:  (v: boolean) => void;
  filterSpicy: boolean; setFilterSpicy: (v: boolean) => void;
}

function FilterBar({
  showMeal,    setShowMeal,
  showSide,    setShowSide,
  showDrink,   setShowDrink,
  filterVegi,  setFilterVegi,
  filterSpicy, setFilterSpicy,
}: FilterBarProps) {

  // Reusable toggle pill — renders differently when active vs inactive
  function Pill({
    active,
    onToggle,
    activeClass,
    children,
  }: {
    active: boolean;
    onToggle: () => void;
    activeClass: string;
    children: React.ReactNode;
  }) {
    return (
      <button
        onClick={onToggle}
        className={`
          px-4 py-1.5 rounded-full text-sm font-semibold border-2
          transition-all duration-150 select-none
          ${active
            ? activeClass
            : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300"
          }
        `}
      >
        {children}
      </button>
    );
  }

  return (
    // Dark card toolbar — contrasts with the light page background
    <div className="mb-8 px-5 py-4 rounded-2xl bg-gray-900 shadow-lg flex flex-wrap items-center gap-3">
      {/* Label */}
      <span className="text-gray-500 text-xs uppercase tracking-widest font-medium mr-1">
        Filter
      </span>

      {/* ── Category pills (AND logic with each other — each hides a category when off) */}
      <Pill
        active={showMeal}
        onToggle={() => setShowMeal(!showMeal)}
        activeClass="bg-indigo-600 border-indigo-400 text-white"
      >
        🍽 Meal
      </Pill>
      <Pill
        active={showSide}
        onToggle={() => setShowSide(!showSide)}
        activeClass="bg-sky-600 border-sky-400 text-white"
      >
        🥗 Side
      </Pill>
      <Pill
        active={showDrink}
        onToggle={() => setShowDrink(!showDrink)}
        activeClass="bg-violet-600 border-violet-400 text-white"
      >
        ☕ Drink
      </Pill>

      {/* Thin vertical separator between category and tag sections */}
      <span className="w-px h-6 bg-gray-700 mx-1" aria-hidden="true" />

      {/* ── Tag pills — when checked, ONLY matching dishes are shown */}
      <Pill
        active={filterVegi}
        onToggle={() => setFilterVegi(!filterVegi)}
        activeClass="bg-emerald-600 border-emerald-400 text-white"
      >
        🌿 Vegi
      </Pill>
      <Pill
        active={filterSpicy}
        onToggle={() => setFilterSpicy(!filterSpicy)}
        activeClass="bg-orange-600 border-orange-400 text-white"
      >
        🔥 Spicy
      </Pill>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DishesPage() {
  // ── Fetched data ────────────────────────────────────────────────────────────
  const [allDishes,     setAllDishes]     = useState<Dish[]>([]);
  // id→name map lets each dish card show its restaurant name without re-fetching
  const [restaurantMap, setRestaurantMap] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // ── Filter state ────────────────────────────────────────────────────────────
  // Categories — all enabled by default so every dish is visible on first load
  const [showMeal,  setShowMeal]  = useState(true);
  const [showSide,  setShowSide]  = useState(true);
  const [showDrink, setShowDrink] = useState(true);
  // Tag filters — both off by default; when on, ONLY matching dishes are shown
  const [filterVegi,  setFilterVegi]  = useState(false);
  const [filterSpicy, setFilterSpicy] = useState(false);

  // ── Pagination state — 3-page sliding window ────────────────────────────────
  // prevPage: the 6 dishes shown before current (null when at the very start)
  const [prevPage,      setPrevPage]      = useState<Dish[] | null>(null);
  // currPage: what the grid is currently displaying
  const [currPage,      setCurrPage]      = useState<Dish[]>([]);
  // nextPage: pre-generated random set, consumed instantly when Next is clicked
  const [nextPage,      setNextPage]      = useState<Dish[]>([]);
  // deckRemaining: the tail of the current shuffle cycle, used to generate future pages
  const [deckRemaining, setDeckRemaining] = useState<Dish[]>([]);

  // ── Derived: filtered pool ───────────────────────────────────────────────────
  // Recomputed whenever filter toggles or allDishes changes.
  // Filters combine with AND logic: e.g. Meal + #Vegi → only vegetarian meals.
  const filteredPool = useMemo(() => {
    return allDishes.filter((dish) => {
      const cat = dish.category?.toLowerCase() ?? "";
      // Hide dishes whose category box is unchecked
      if (cat === "meal"  && !showMeal)  return false;
      if (cat === "side"  && !showSide)  return false;
      if (cat === "drink" && !showDrink) return false;
      // Tag filters: when active, only dishes with that property pass through
      if (filterVegi  && !dish.is_vegetarian) return false;
      if (filterSpicy && !dish.is_spicy)      return false;
      return true;
    });
  }, [allDishes, showMeal, showSide, showDrink, filterVegi, filterSpicy]);

  // ── Data fetching ────────────────────────────────────────────────────────────
  // Both endpoints are fetched in parallel with Promise.all to minimise load time.
  // The API base URL always comes from the env var — never hardcoded.
  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL;
    Promise.all([
      fetch(`${apiBase}/dishes`)
        .then((r) => {
          if (!r.ok) throw new Error(`Dishes: ${r.status}`);
          return r.json() as Promise<Dish[]>;
        }),
      fetch(`${apiBase}/restaurants`)
        .then((r) => {
          if (!r.ok) throw new Error(`Restaurants: ${r.status}`);
          return r.json() as Promise<Restaurant[]>;
        }),
    ])
      .then(([dishes, restaurants]) => {
        setAllDishes(dishes);
        // Build a quick id→name lookup used on every dish card
        const map: Record<number, string> = {};
        for (const r of restaurants) map[r.id] = r.name;
        setRestaurantMap(map);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []); // empty deps → runs once on mount

  // ── Pagination initialiser ────────────────────────────────────────────────────
  // Fires whenever filteredPool changes — which happens on first data load and
  // on every filter toggle. Always resets to page 1 with a fresh shuffle.
  useEffect(() => {
    if (filteredPool.length === 0) {
      setPrevPage(null);
      setCurrPage([]);
      setNextPage([]);
      setDeckRemaining([]);
      return;
    }

    // Shuffle the entire pool to kick off a new random cycle
    const deck = shuffle([...filteredPool]);

    // Draw page 1 — immediately visible when the effect runs
    const page1      = deck.slice(0, PAGE_SIZE);
    const afterPage1 = deck.slice(PAGE_SIZE);

    // Draw page 2 — pre-loaded as nextPage so the first Next click is instant.
    // If drawing page 1 exhausted the deck, start a fresh shuffle for page 2.
    const deck2      = afterPage1.length > 0 ? afterPage1 : shuffle([...filteredPool]);
    const page2      = deck2.slice(0, PAGE_SIZE);
    const afterPage2 = deck2.slice(PAGE_SIZE);

    setPrevPage(null);
    setCurrPage(page1);
    setNextPage(page2);
    // If afterPage2 is empty the deck is already exhausted — prime a new shuffle now
    // so the next handleNext call doesn't have to do it on the fly
    setDeckRemaining(afterPage2.length > 0 ? afterPage2 : shuffle([...filteredPool]));
  }, [filteredPool]); // filteredPool identity changes whenever any filter changes

  // ── Navigation: Next ──────────────────────────────────────────────────────────
  // Advances the 3-page window forward and draws a fresh random page for "next".
  function handleNext() {
    let deck = [...deckRemaining];

    // If the current cycle is exhausted, reshuffle the full filtered pool to restart
    if (deck.length < PAGE_SIZE) {
      deck = shuffle([...filteredPool]);
    }

    // The new "next" page is drawn from the front of the deck
    const newNext      = deck.slice(0, PAGE_SIZE);
    const newRemaining = deck.slice(PAGE_SIZE);

    setPrevPage(currPage);   // current becomes previous
    setCurrPage(nextPage);   // pre-built next becomes current
    setNextPage(newNext);    // freshly drawn page waits for the next click
    // Keep the remaining deck primed — reshuffle immediately if it ran out
    setDeckRemaining(newRemaining.length > 0 ? newRemaining : shuffle([...filteredPool]));
  }

  // ── Navigation: Prev ──────────────────────────────────────────────────────────
  // Slides the window backward one step. Pressing Next after Prev returns to the
  // page you just left (current becomes the new "next" — not a fresh random).
  function handlePrev() {
    if (!prevPage || prevPage.length === 0) return;

    setNextPage(currPage);  // save what we're leaving so Next can return to it
    setCurrPage(prevPage);  // restore the previous page
    setPrevPage(null);      // only one level of back-history is kept in memory
  }

  const canGoPrev = !!prevPage && prevPage.length > 0;
  const canGoNext = filteredPool.length > 0;

  // ── Loading state ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <FoodPatternBackground />
        <div className="flex justify-center items-center min-h-[50vh]">
          <p className="text-gray-400 text-xl animate-pulse">Loading dishes…</p>
        </div>
      </>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────────
  if (error) {
    return (
      <>
        <FoodPatternBackground />
        <div className="flex flex-col justify-center items-center min-h-[50vh] gap-3">
          <p className="text-2xl text-red-500 font-semibold">Could not load dishes</p>
          <p className="text-gray-500 text-sm">{error}</p>
          <p className="text-gray-400 text-xs">
            Make sure the API is running and NEXT_PUBLIC_API_URL is set correctly.
          </p>
        </div>
      </>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────────
  return (
    <>
      <FoodPatternBackground />

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-gray-800">
          What&rsquo;s on the{" "}
          <span className="text-indigo-600">Menu?</span>
        </h1>
        <p className="mt-1 text-gray-500 text-sm">
          {allDishes.length} dishes across {Object.keys(restaurantMap).length} restaurants
        </p>
      </div>

      {/* ── Filter bar ────────────────────────────────────────────────────────── */}
      <FilterBar
        showMeal={showMeal}       setShowMeal={setShowMeal}
        showSide={showSide}       setShowSide={setShowSide}
        showDrink={showDrink}     setShowDrink={setShowDrink}
        filterVegi={filterVegi}   setFilterVegi={setFilterVegi}
        filterSpicy={filterSpicy} setFilterSpicy={setFilterSpicy}
      />

      {/* ── Empty-filter state ────────────────────────────────────────────────── */}
      {filteredPool.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[30vh] gap-2 text-gray-400">
          <span className="text-5xl">🍽</span>
          <p className="text-lg font-medium">No dishes match these filters</p>
          <p className="text-sm">Try enabling more categories or removing a tag filter.</p>
        </div>
      )}

      {/* ── Pagination layout: [‹ button] [grid] [› button] ──────────────────── */}
      {filteredPool.length > 0 && (
        <>
          {/*
            flex + items-center aligns both nav buttons vertically with the middle
            of the card grid regardless of how tall the cards grow.
          */}
          <div className="flex items-center gap-3">

            {/* ── Previous button ──────────────────────────────────────────────── */}
            <button
              onClick={handlePrev}
              disabled={!canGoPrev}
              aria-label="Previous page"
              className={`
                flex-shrink-0 w-14 h-14 rounded-2xl text-3xl font-bold
                flex items-center justify-center shadow
                transition-all duration-150
                ${canGoPrev
                  ? "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }
              `}
            >
              ‹
            </button>

            {/* ── 3-column dish grid ───────────────────────────────────────────── */}
            {/*
              Responsive breakpoints match the Restaurants page:
                mobile  → 1 col  (grid-cols-1)
                tablet  → 2 cols (sm:grid-cols-2)
                desktop → 3 cols (lg:grid-cols-3)
            */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {currPage.map((dish, index) => {
                // Color assigned by position in the current page (0–5), cycling the palette
                const colors         = CARD_COLORS[index % CARD_COLORS.length];
                const restaurantName = restaurantMap[dish.restaurant_id] ?? "Unknown restaurant";

                return (
                  <Link
                    key={dish.id}
                    href={`/restaurants/${dish.restaurant_id}?highlight=${dish.id}`}
                    className={`
                      ${colors.bg}
                      rounded-2xl shadow-md p-5
                      flex flex-col gap-2
                      hover:shadow-xl hover:-translate-y-0.5
                      transition-all duration-200
                      cursor-pointer
                    `}
                  >
                    {/* Dish name — large, in the card's accent color */}
                    <h2 className={`text-xl font-bold leading-tight ${colors.accent}`}>
                      {dish.name}
                    </h2>

                    {/* Restaurant the dish belongs to — joined via restaurantMap */}
                    <p className="text-xs text-gray-500 font-medium">{restaurantName}</p>

                    {/* ── Badge row ─────────────────────────────────────────────── */}
                    <div className="flex flex-wrap gap-1.5 mt-0.5">
                      {/* Category badge */}
                      {dish.category && (
                        <span
                          className={`
                            px-2.5 py-0.5 rounded-full text-xs font-semibold
                            uppercase tracking-wide ${colors.tag}
                          `}
                        >
                          {dish.category}
                        </span>
                      )}

                      {/* Vegetarian badge — only rendered when is_vegetarian is true */}
                      {dish.is_vegetarian && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          🌿 Vegi
                        </span>
                      )}

                      {/* Spicy badge — only rendered when is_spicy is true */}
                      {dish.is_spicy && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
                          🔥 Spicy
                        </span>
                      )}
                    </div>

                    {/* Divider before stats */}
                    <hr className="border-gray-300/60 my-0.5" />

                    {/* User rating as stars */}
                    <div>
                      <span className="block text-xs text-gray-400 uppercase tracking-wide mb-0.5">
                        Your Rating
                      </span>
                      <StarRating rating={dish.user_rating} />
                    </div>

                    {/* How many times this dish has been ordered */}
                    <p className="text-sm text-gray-600">
                      Ordered{" "}
                      <span className="font-semibold text-gray-800">{dish.times_ordered}</span>
                      {" "}{dish.times_ordered === 1 ? "time" : "times"}
                    </p>
                  </Link>
                );
              })}
            </div>

            {/* ── Next button ──────────────────────────────────────────────────── */}
            <button
              onClick={handleNext}
              disabled={!canGoNext}
              aria-label="Next page"
              className={`
                flex-shrink-0 w-14 h-14 rounded-2xl text-3xl font-bold
                flex items-center justify-center shadow
                transition-all duration-150
                ${canGoNext
                  ? "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }
              `}
            >
              ›
            </button>
          </div>

          {/* ── Page indicator ────────────────────────────────────────────────── */}
          {/* Shows how many dishes are on this page vs the total filtered pool */}
          <p className="mt-5 text-center text-sm text-gray-400">
            Showing{" "}
            <span className="font-semibold text-gray-600">{currPage.length}</span>
            {" "}of{" "}
            <span className="font-semibold text-gray-600">{filteredPool.length}</span>
            {" "}dish{filteredPool.length !== 1 ? "es" : ""}
          </p>
        </>
      )}
    </>
  );
}
