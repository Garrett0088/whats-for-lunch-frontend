"use client"; // useState, useEffect, and useRef all require a Client Component

import { useEffect, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

// One turn in the conversation — matches the shape the FastAPI schemas expect
type ConversationTurn = {
  role: "user" | "assistant";
  content: string;
};

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
  restaurant_id: number;
  category: string | null;
  user_rating: number | null;
  times_ordered: number;
  is_vegetarian: boolean;
  is_spicy: boolean;
  created_at: string;
};

// ── Agent Mode Types ─────────────────────────────────────────────────────────

// One tool call from a single /ai/agent turn, tagged with which turn it came from.
// `input` and `result` shapes vary per tool (get_dishes / update_dish / delete_dish),
// so they're loosely typed here and narrowed inside AgentStepCard.
type AgentStep = {
  turn: number;
  tool: string;
  input: Record<string, unknown>;
  result: any;
};

// Response shape from POST /ai/agent — note this is DIFFERENT from /ai/recommend's
// {reply, updated_history}: the field is `response` (not `reply`), and there's a
// new `agent_steps` array that feeds the Agent Actions panel.
type AgentResponse = {
  response: string;
  agent_steps: Omit<AgentStep, "turn">[];
  updated_history: ConversationTurn[];
};

// ── Constants ─────────────────────────────────────────────────────────────────

// Same 6-color pastel palette used on Restaurants and Dishes pages
const CARD_COLORS = [
  { bg: "bg-rose-100",    accent: "text-rose-700",    tag: "bg-rose-200 text-rose-900"       },
  { bg: "bg-amber-100",   accent: "text-amber-700",   tag: "bg-amber-200 text-amber-900"     },
  { bg: "bg-emerald-100", accent: "text-emerald-700", tag: "bg-emerald-200 text-emerald-900" },
  { bg: "bg-sky-100",     accent: "text-sky-700",     tag: "bg-sky-200 text-sky-900"         },
  { bg: "bg-violet-100",  accent: "text-violet-700",  tag: "bg-violet-200 text-violet-900"   },
  { bg: "bg-orange-100",  accent: "text-orange-700",  tag: "bg-orange-200 text-orange-900"   },
];

// Straight-line miles from CSTU (1601 McCarthy Blvd, Milpitas) — same lookup as Restaurants page
const DISTANCES_FROM_CSTU: Record<string, number> = {
  "BJ's Restaurant": 8.0,
  "Chipotle":        3.5,
  "Dishdash":        8.0,
  "King Eggroll":    4.0,
  "Mendocino Farms": 4.5,
  "Panera":          8.0,
};

// Keywords that indicate the reply is about beverages — used by selectDishes (Fix 3)
const DRINK_KEYWORDS = ["coffee", "drink", "beverage", "juice", "tea", "water"];

// Suggestion chips shown in State 1 — clicking fills the input but does NOT send
const SUGGESTION_CHIPS = [
  "What should I have for lunch today?",
  "What's my highest rated restaurant?",
  "I want something vegetarian — what do you recommend?",
];

// ── Sub-components ────────────────────────────────────────────────────────────

// Fixed SVG tile — identical fork/knife/plate pattern used on all three data pages
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
          <pattern id="food-pattern" x="0" y="0" width="130" height="130" patternUnits="userSpaceOnUse">
            {/* Fork */}
            <g transform="translate(18, 12)">
              <line x1="4"  y1="0"  x2="4"  y2="22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="11" y1="0"  x2="11" y2="22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="18" y1="0"  x2="18" y2="22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="4"  y1="14" x2="18" y2="14" stroke="currentColor" strokeWidth="2"   strokeLinecap="round" />
              <line x1="11" y1="22" x2="11" y2="55" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </g>
            {/* Knife */}
            <g transform="translate(65, 12)">
              <line x1="8" y1="0" x2="8" y2="55" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M8,0 C8,0 20,6 20,22 L8,28 Z" fill="currentColor" />
            </g>
            {/* Plate */}
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

// StarRating — same ★/☆ display used on Restaurants and Dishes pages.
// `small` prop shrinks the stars for compact card contexts.
function StarRating({ rating, small = false }: { rating: number | null; small?: boolean }) {
  if (rating === null)
    return <span className="text-gray-400 text-xs italic">No rating</span>;

  const full  = Math.floor(rating);
  const half  = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  const size  = small ? "text-sm" : "text-base";

  return (
    <span aria-label={`${rating} out of 5 stars`}>
      <span className={`text-yellow-400 ${size}`}>{"★".repeat(full)}</span>
      {half === 1 && <span className={`text-yellow-300 ${size}`}>★</span>}
      <span className={`text-gray-300 ${size}`}>{"★".repeat(empty)}</span>
      {!small && <span className="ml-1 text-xs text-gray-400">({rating.toFixed(1)})</span>}
    </span>
  );
}

// ThinkingIndicator — three indigo dots that bounce in sequence while the API responds
function ThinkingIndicator() {
  return (
    <div className="mr-auto flex items-center gap-1.5 px-4 py-3 rounded-2xl rounded-tl-sm bg-white border border-gray-200 shadow-sm w-fit">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}

// MessageBubble — one chat turn.
// User messages: right-aligned indigo bubble.
// Assistant messages: left-aligned white bubble with border.
// whitespace-pre-wrap preserves line breaks in multi-paragraph Claude replies.
function MessageBubble({ turn }: { turn: ConversationTurn }) {
  const isUser = turn.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`
          max-w-[78%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap
          ${isUser
            ? "rounded-2xl rounded-tr-sm bg-indigo-600 text-white"
            : "rounded-2xl rounded-tl-sm bg-white border border-gray-200 text-gray-800 shadow-sm"
          }
        `}
      >
        {turn.content}
      </div>
    </div>
  );
}

// selectDishes — applies Fix 3 then Fix 2 before passing dishes to DishMiniGrid.
// Fix 3: if the reply mentions drink keywords, keep only category==="drink";
//         otherwise keep only category==="meal" (sides are excluded by default).
// Fix 2: sort surviving dishes by user_rating descending and take the top 2.
function selectDishes(dishes: Dish[], replyText: string): Dish[] {
  const lower = replyText.toLowerCase();
  // Fix 3: detect drink context from the reply text
  const isDrinkContext = DRINK_KEYWORDS.some((kw) => lower.includes(kw));
  // Fix 3: filter to the relevant category
  const filtered = dishes.filter((d) => {
    const cat = d.category?.toLowerCase() ?? "";
    return isDrinkContext ? cat === "drink" : cat === "meal";
  });
  // Fix 2: highest-rated first (null ratings treated as -1 so they sink), then slice to 2
  return filtered
    .sort((a, b) => (b.user_rating ?? -1) - (a.user_rating ?? -1))
    .slice(0, 2);
}

// DishMiniGrid — 2-column sub-grid of compact dish cards inside a RestaurantMentionCard.
// Receives pre-filtered dishes (max 2, top-rated) — filtering happens in selectDishes above.
function DishMiniGrid({ dishes }: { dishes: Dish[] }) {
  if (dishes.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {dishes.map((dish) => (
        <div
          key={dish.id}
          className="bg-white/80 rounded-lg p-2 flex flex-col gap-1 border border-gray-100"
        >
          {/* Dish name */}
          <p className="text-xs font-medium text-gray-700 leading-tight">{dish.name}</p>

          {/* Badge row */}
          <div className="flex flex-wrap gap-1">
            {dish.category && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600 uppercase tracking-wide">
                {dish.category}
              </span>
            )}
            {dish.is_vegetarian && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                🌿
              </span>
            )}
            {dish.is_spicy && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700">
                🔥
              </span>
            )}
          </div>

          {/* Compact star rating (no numeric label at this size) */}
          <StarRating rating={dish.user_rating} small />
        </div>
      ))}
    </div>
  );
}

// RestaurantMentionCard — a colored card in the "Mentioned Places" panel.
// `appeared` controls the CSS fade-in: the card renders at opacity-0 first,
// then `appeared` flips to true ~50ms later, triggering the transition to opacity-100.
function RestaurantMentionCard({
  restaurant,
  colors,
  dishes,
  appeared,
  onDismiss,
}: {
  restaurant: Restaurant;
  colors: (typeof CARD_COLORS)[number];
  dishes: Dish[];
  appeared: boolean;
  onDismiss: () => void;
}) {
  const distance = DISTANCES_FROM_CSTU[restaurant.name];

  return (
    <div
      className={`
        ${colors.bg} rounded-2xl p-4 flex flex-col gap-2 shadow-sm
        transition-all duration-500
        ${appeared ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
      `}
    >
      {/* Header: restaurant name + dismiss X */}
      <div className="flex items-start justify-between gap-2">
        <h3 className={`font-bold text-base leading-tight ${colors.accent}`}>
          {restaurant.name}
        </h3>
        <button
          onClick={onDismiss}
          aria-label={`Dismiss ${restaurant.name}`}
          className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none flex-shrink-0 mt-0.5"
        >
          ×
        </button>
      </div>

      {/* Cuisine tag badge */}
      {restaurant.cuisine_tag && (
        <span className={`self-start px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${colors.tag}`}>
          {restaurant.cuisine_tag}
        </span>
      )}

      {/* Distance from CSTU */}
      {distance !== undefined && (
        <p className="text-xs text-gray-500 font-medium">
          📍 {distance.toFixed(1)} miles from CSTU
        </p>
      )}

      {/* Star rating + visit count */}
      <StarRating rating={restaurant.user_rating} small />
      <p className="text-xs text-gray-500">
        <span className="font-semibold text-gray-700">{restaurant.visit_count}</span>{" "}
        {restaurant.visit_count === 1 ? "visit" : "visits"} logged
      </p>

      {/* Divider + dish sub-grid */}
      {dishes.length > 0 && (
        <>
          <hr className="border-gray-300/60" />
          <DishMiniGrid dishes={dishes} />
        </>
      )}
    </div>
  );
}

// ── Agent Mode Sub-components ──────────────────────────────────────────────────

// ModeToggle — two-button switch between "Recommend" (read-only chat) and
// "Agent" (the agent can read AND write/delete dishes). Rendered in both
// State 1 and State 2 so the user can pick a mode before or during a chat.
function ModeToggle({
  mode,
  onSwitch,
}: {
  mode: "recommend" | "agent";
  onSwitch: (m: "recommend" | "agent") => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-gray-300 bg-white p-1 shadow-sm">
      <button
        onClick={() => onSwitch("recommend")}
        className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
          mode === "recommend"
            ? "bg-indigo-600 text-white"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        Recommend
      </button>
      <button
        onClick={() => onSwitch("agent")}
        className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
          mode === "agent"
            ? "bg-indigo-600 text-white"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        Agent
      </button>
    </div>
  );
}

// AgentStepCard — renders ONE entry from agent_steps. The shape of `step.result`
// depends on `step.tool`, so each branch below narrows it manually:
//   - get_dishes:  { dishes: Dish[] }                     → collapsible list
//   - update_dish: { name, updated_fields, previous_value, current_value, id } → diff + Undo
//   - delete_dish: { name, id }                            → simple confirmation
function AgentStepCard({
  step,
  isUndone,
  onUndo,
  restaurantNameById,
  lastAgentReply,
}: {
  step: AgentStep;
  isUndone: boolean;
  onUndo: () => void;
  restaurantNameById: Record<number, string>;
  lastAgentReply: string;
}) {
  // Local expand/collapse state — only used by the get_dishes branch.
  // Each card gets its own independent toggle. Defaults to expanded (true)
  // per Garrett's request — the top-5 limit below keeps this from being a wall of text.
  const [expanded, setExpanded] = useState(true);

  // ── get_dishes: collapsible dish list, filtered to Claude-mentioned dishes,
  //    grouped meal → side → drink, sorted by rating within each group ────────
  if (step.tool === "get_dishes") {
    const allDishes: Dish[] = step.result?.dishes ?? [];
    const lower = lastAgentReply.toLowerCase();
    const mentioned = allDishes.filter((d) => lower.includes(d.name.toLowerCase()));
    const dishes = mentioned.length > 0 ? mentioned : allDishes;

    // Sort: category order first (meal=0, side=1, drink=2), then rating desc
    const CAT_ORDER: Record<string, number> = { meal: 0, side: 1, drink: 2 };
    const CAT_LABEL: Record<string, string>  = { meal: "🍽 Meals", side: "🥗 Sides", drink: "☕ Drinks" };
    const sorted = [...dishes].sort((a, b) => {
      const catA = CAT_ORDER[a.category?.toLowerCase() ?? ""] ?? 3;
      const catB = CAT_ORDER[b.category?.toLowerCase() ?? ""] ?? 3;
      if (catA !== catB) return catA - catB;
      return (b.user_rating ?? -1) - (a.user_rating ?? -1);
    });

    // Group consecutive items by category for section headers
    const sections: { label: string; items: Dish[] }[] = [];
    for (const d of sorted) {
      const label = CAT_LABEL[d.category?.toLowerCase() ?? ""] ?? "Other";
      const last = sections[sections.length - 1];
      if (last && last.label === label) last.items.push(d);
      else sections.push({ label, items: [d] });
    }

    return (
      <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="w-full flex items-center justify-between text-left"
        >
          <span className="text-lg text-gray-700">
            🔍 Looked up <span className="font-semibold">{sorted.length}</span>{" "}
            dish{sorted.length === 1 ? "" : "es"}
          </span>
          <span className="text-base text-gray-400 flex-shrink-0 ml-2">
            {expanded ? "▲ hide" : "▼ show"}
          </span>
        </button>

        {/* Grouped dish list — only rendered when expanded */}
        {expanded && (
          <div className="mt-2 max-h-64 overflow-y-auto space-y-3">
            {sections.map((section) => (
              <div key={section.label}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                  {section.label}
                </p>
                <ul className="pl-1 text-base text-gray-600 space-y-1">
                  {section.items.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        {d.name}{" "}
                        <span className="text-gray-400">
                          from {restaurantNameById[d.restaurant_id] ?? "Unknown"}
                        </span>
                      </span>
                      <StarRating rating={d.user_rating} small />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── update_dish: error state OR success diff + Undo ──────────────────────
  if (step.tool === "update_dish") {
    const result = step.result ?? {};

    // Show error card when the tool returned (or threw) an error
    if (result.error) {
      return (
        <div className="bg-white rounded-xl p-3 border border-red-200 shadow-sm">
          <p className="text-lg text-red-600">⚠️ Update failed</p>
          <p className="text-sm text-gray-500 mt-1">{String(result.error)}</p>
        </div>
      );
    }

    const name = result.name ?? `dish #${String(step.input?.id)}`;
    const updatedFields: string[] = Array.isArray(result.updated_fields) ? result.updated_fields : [];

    return (
      <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm flex flex-col gap-1.5">
        <p className="text-lg text-gray-700">
          ✏️ Updated <span className="font-semibold">{name}</span>
        </p>

        {/* One line per changed field: "user_rating: 4.5 → 5" */}
        {updatedFields.map((field) => (
          <p key={field} className="text-base text-gray-500 pl-5">
            <span className="font-medium">{field}</span>:{" "}
            {String(result.previous_value?.[field])}{" "}
            <span aria-hidden="true">→</span>{" "}
            <span className="font-semibold text-gray-700">
              {String(result.current_value?.[field])}
            </span>
          </p>
        ))}

        {/* Option A: instant undo — PUT /dishes/{id} with previous_value, no agent round-trip */}
        <button
          onClick={onUndo}
          disabled={isUndone}
          className="self-start mt-1 px-3 py-1 rounded-lg text-base font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isUndone ? "Undone ✓" : "Undo"}
        </button>
      </div>
    );
  }

  // ── delete_dish: simple confirmation, no undo (per Decisions §2) ─────────
  if (step.tool === "delete_dish") {
    const name = step.result?.name ?? `dish #${String(step.input?.id)}`;
    return (
      <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
        <p className="text-lg text-gray-700">
          🗑️ Deleted <span className="font-semibold">{name}</span>
        </p>
      </div>
    );
  }

  // ── Fallback for any tool not explicitly handled above ───────────────────
  return (
    <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
      <p className="text-lg text-gray-700">⚙️ {step.tool}</p>
    </div>
  );
}

// AgentActionsPanel — the right-panel content shown when mode === "agent".
// Groups the persisted `agentSteps` log by turn number (steps accumulate across
// turns — they are never replaced, only appended to).
function AgentActionsPanel({
  steps,
  undoneStepKeys,
  onUndo,
  restaurantNameById,
  lastAgentReply,
}: {
  steps: AgentStep[];
  undoneStepKeys: Set<string>;
  onUndo: (step: AgentStep, stepKey: string) => void;
  restaurantNameById: Record<number, string>;
  lastAgentReply: string;
}) {
  if (steps.length === 0) {
    return (
      <p className="text-lg text-gray-400 italic px-1">
        Agent actions will appear here as you make requests.
      </p>
    );
  }

  // Distinct turn numbers, in the order they first appeared
  const turns = Array.from(new Set(steps.map((s) => s.turn)));

  return (
    <>
      {turns.map((turnNum) => (
        <div key={turnNum} className="flex flex-col gap-2">
          {/* Turn label — small uppercase header, matches "Mentioned Places" tone */}
          <h3 className="text-base font-semibold text-gray-400 uppercase tracking-wide px-1">
            Turn {turnNum}
          </h3>

          {steps
            .filter((s) => s.turn === turnNum)
            .map((step, i) => {
              // stepKey is stable across renders because turn + index + tool
              // uniquely identifies a step's position in the log
              const stepKey = `${turnNum}-${i}-${step.tool}`;
              return (
                <AgentStepCard
                  key={stepKey}
                  step={step}
                  isUndone={undoneStepKeys.has(stepKey)}
                  onUndo={() => onUndo(step, stepKey)}
                  restaurantNameById={restaurantNameById}
                  lastAgentReply={lastAgentReply}
                />
              );
            })}
        </div>
      ))}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function RecommendPage() {

  // ── Chat state ──────────────────────────────────────────────────────────────
  // `messages` drives both the display AND the State 1 ↔ State 2 switch:
  //   empty array  → State 1 (centered landing)
  //   any messages → State 2 (split-screen chat)
  const [messages,   setMessages]   = useState<ConversationTurn[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  // ── Agent Mode state ──────────────────────────────────────────────────────────
  // mode: "recommend" → existing read-only /ai/recommend behavior (unchanged)
  //       "agent"     → /ai/agent — can read AND write/delete dishes
  const [mode, setMode] = useState<"recommend" | "agent">("recommend");
  // agentSteps: PERSISTS across turns (never replaced) — running log for the
  // Agent Actions panel, grouped by `turn` in AgentActionsPanel.
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  // turnCount: increments once per agent send — tags each new batch of steps
  const [turnCount, setTurnCount] = useState(0);
  // undoneStepKeys: which update_dish steps have already been reverted —
  // disables their Undo button so a second click can't double-revert
  const [undoneStepKeys, setUndoneStepKeys] = useState<Set<string>>(new Set());

  // ── Data for the right panel ─────────────────────────────────────────────────
  // Fetched on mount so the sidebar is ready before the first AI reply arrives
  const [allRestaurants,     setAllRestaurants]     = useState<Restaurant[]>([]);
  // Keyed by restaurant_id — lets each card look up its dishes in O(1)
  const [dishesByRestaurant, setDishesByRestaurant] = useState<Record<number, Dish[]>>({});

  // ── Right panel mention tracking ─────────────────────────────────────────────
  // Fix 1: mentionedIds now resets on every reply (shows only the most recent reply's restaurants)
  const [mentionedIds, setMentionedIds] = useState<Set<number>>(new Set());
  // Fix 2+3: the text of the most recent Claude reply, used by selectDishes for dish filtering
  const [lastReply,    setLastReply]    = useState("");
  // dismissedIds: restaurants the user has explicitly hidden with the X button
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());
  // appearedIds: filled ~50ms after mentionedIds grows — triggers the CSS fade-in transition
  const [appearedIds,  setAppearedIds]  = useState<Set<number>>(new Set());

  // Invisible div at the bottom of the message list — auto-scroll targets this
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Derived values ────────────────────────────────────────────────────────────
  const isActive = messages.length > 0; // false → State 1, true → State 2

  // Restaurants to show in the right panel: mentioned AND not dismissed by the user
  const visibleRestaurants = allRestaurants.filter(
    (r) => mentionedIds.has(r.id) && !dismissedIds.has(r.id)
  );

  // restaurant_id → name lookup, used by AgentActionsPanel to show "Dish from Restaurant".
  // allRestaurants is small (6 items) so recomputing this each render is cheap.
  const restaurantNameById: Record<number, string> = {};
  for (const r of allRestaurants) restaurantNameById[r.id] = r.name;

  // ── Effect 1: parallel fetch of restaurants + dishes on mount ────────────────
  // Both data sets are needed to populate the right panel. Failures are non-fatal —
  // the chat still works; the sidebar just won't show any cards.
  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL;
    Promise.all([
      fetch(`${apiBase}/restaurants`).then((r) => {
        if (!r.ok) throw new Error(`Restaurants: ${r.status}`);
        return r.json() as Promise<Restaurant[]>;
      }),
      fetch(`${apiBase}/dishes`).then((r) => {
        if (!r.ok) throw new Error(`Dishes: ${r.status}`);
        return r.json() as Promise<Dish[]>;
      }),
    ])
      .then(([restaurants, dishes]) => {
        setAllRestaurants(restaurants);
        // Build restaurant_id → Dish[] lookup so each card render is O(1)
        const byRestaurant: Record<number, Dish[]> = {};
        for (const d of dishes) {
          if (!byRestaurant[d.restaurant_id]) byRestaurant[d.restaurant_id] = [];
          byRestaurant[d.restaurant_id].push(d);
        }
        setDishesByRestaurant(byRestaurant);
      })
      .catch((err: Error) => {
        console.error("Could not pre-load restaurant/dish data:", err.message);
      });
  }, []); // empty deps → runs exactly once on mount

  // ── Effect 2: auto-scroll to newest message ───────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]); // fires on every new message and when thinking starts/stops

  // ── Effect 3: staggered fade-in for newly-added restaurant cards ──────────────
  // Cards render at opacity-0 first; after 50ms they're added to appearedIds which
  // flips them to opacity-100 via the `transition-all duration-500` CSS class.
  // When appearedIds changes it re-fires, but pending will be empty so it returns early —
  // no infinite loop.
  useEffect(() => {
    const pending = Array.from(mentionedIds).filter((id) => !appearedIds.has(id));
    if (!pending.length) return;
    const t = setTimeout(() => {
      setAppearedIds((prev) => new Set(Array.from(prev).concat(pending)));
    }, 50);
    return () => clearTimeout(t); // cancel if deps change before the 50ms fires
  }, [mentionedIds, appearedIds]);

  // ── handleSend ────────────────────────────────────────────────────────────────
  // Branches on `mode`:
  //   "recommend" → existing /ai/recommend flow, unchanged ({reply, updated_history})
  //   "agent"     → /ai/agent flow, NEW ({response, agent_steps, updated_history})
  async function handleSend() {
    const text = inputValue.trim();
    if (!text || isThinking) return;

    // Snapshot history BEFORE any state mutation so the API receives the correct
    // prior turns — not including the message we're about to append
    const historyForApi = [...messages];

    // Optimistic update: user bubble appears immediately (no waiting for the API)
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInputValue("");
    setIsThinking(true);

    try {
      // Pick the endpoint based on the current mode — request body shape is identical
      const endpoint = mode === "agent" ? "/ai/agent" : "/ai/recommend";

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversation_history: historyForApi, // history BEFORE this turn
        }),
      });

      if (!res.ok) throw new Error(`API responded with ${res.status}`);

      if (mode === "agent") {
        // ── Agent mode: response shape is {response, agent_steps, updated_history} ──
        const data = await res.json() as AgentResponse;

        // Replace optimistic state with the canonical history from the server
        setMessages(data.updated_history);

        // Tag this turn's steps with the new turn number, then APPEND (never replace)
        // to the persisted log — this is what makes the Agent Actions panel a
        // running history rather than a per-reply snapshot.
        const turn = turnCount + 1;
        const taggedSteps: AgentStep[] = data.agent_steps.map((step) => ({ ...step, turn }));
        setAgentSteps((prev) => [...prev, ...taggedSteps]);
        setTurnCount(turn);

      } else {
        // ── Recommend mode: existing behavior, unchanged ──────────────────────────
        const data = await res.json() as { reply: string; updated_history: ConversationTurn[] };

        // Replace our optimistic state with the canonical history from the server.
        // updated_history = [...historyForApi, {user msg}, {assistant reply}]
        setMessages(data.updated_history);

        // Scan the reply for restaurant names to populate the right panel
        scanForMentions(data.reply);
      }

    } catch (err) {
      // Surface the error as a chat bubble so the user gets feedback
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I couldn't get a recommendation right now. Please check the API and try again.",
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  }

  // ── scanForMentions ───────────────────────────────────────────────────────────
  // Case-insensitive scan of Claude's reply for any tracked restaurant name.
  // Fix 1: always resets all three panel Sets before applying the new results,
  //         so the panel shows ONLY restaurants from the most recent reply.
  //         Even an empty result clears stale cards from the previous reply.
  // Only called in "recommend" mode — "agent" mode uses agentSteps instead.
  function scanForMentions(replyText: string) {
    // Fix 2+3: store the reply text so selectDishes can use it for dish filtering
    setLastReply(replyText);

    const lower = replyText.toLowerCase();
    const found = allRestaurants
      .filter((r) => lower.includes(r.name.toLowerCase()))
      .map((r) => r.id);

    // Fix 1: replace (not merge) all three Sets — fresh slate for every reply
    setMentionedIds(new Set(found));
    setDismissedIds(new Set());
    setAppearedIds(new Set());
  }

  // ── handleSwitchMode ──────────────────────────────────────────────────────────
  // Switching modes clears BOTH chat history and BOTH panels' state — same
  // "fresh slate" rule as Week 5's switchMode(). Prevents Recommend-mode
  // mentions and Agent-mode action logs from bleeding into each other.
  function handleSwitchMode(newMode: "recommend" | "agent") {
    if (newMode === mode) return; // no-op if clicking the already-active mode

    setMode(newMode);
    setMessages([]);
    setIsThinking(false);

    // Clear Recommend-mode panel state
    setMentionedIds(new Set());
    setDismissedIds(new Set());
    setAppearedIds(new Set());
    setLastReply("");

    // Clear Agent-mode panel state
    setAgentSteps([]);
    setTurnCount(0);
    setUndoneStepKeys(new Set());
  }

  // ── handleClear ───────────────────────────────────────────────────────────────
  // Resets all chat and sidebar state back to State 1 (empty landing view).
  // Does NOT change `mode` — clearing the chat keeps you in whichever mode you were in.
  function handleClear() {
    setMessages([]);
    setMentionedIds(new Set());
    setDismissedIds(new Set());
    setAppearedIds(new Set());
    setLastReply(""); // Fix 2+3: clear so selectDishes starts clean on next conversation
    setIsThinking(false);

    // Also reset the Agent Actions log — "Clear chat" means a clean slate for both panels
    setAgentSteps([]);
    setTurnCount(0);
    setUndoneStepKeys(new Set());
    // inputValue intentionally kept — user may have typed something while reading
  }

  // ── handleDismiss ─────────────────────────────────────────────────────────────
  function handleDismiss(id: number) {
    setDismissedIds((prev) => new Set(Array.from(prev).concat([id])));
  }

  // ── handleUndo ────────────────────────────────────────────────────────────────
  // Option A (instant revert, per Decisions §5): directly calls PUT /dishes/{id}
  // with the step's captured `previous_value` — no round-trip through /ai/agent.
  // Reuses the existing DishUpdate schema / update_dish endpoint on the backend.
  async function handleUndo(step: AgentStep, stepKey: string) {
    // Guard: only update_dish steps with a captured previous_value can be undone
    if (step.tool !== "update_dish" || !step.result?.previous_value) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/dishes/${step.result.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(step.result.previous_value),
      });

      if (!res.ok) throw new Error(`Undo failed: ${res.status}`);

      // Mark this specific step as undone — disables its Undo button so a second
      // click can't revert an already-reverted change
      setUndoneStepKeys((prev) => new Set(Array.from(prev).concat([stepKey])));
    } catch (err) {
      console.error("Undo failed:", err);
    }
  }

  // ── Shared input bar content ───────────────────────────────────────────────────
  // The same input + Send button JSX is embedded in two different wrappers:
  //   State 1 → an inline centered div  |  State 2 → a fixed bottom bar
  const inputBarContent = (
    <>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void handleSend();
          }
        }}
        // Placeholder hints at what the agent can do differently in Agent mode
        placeholder={
          mode === "agent"
            ? "Ask the agent to update or remove a dish…"
            : "Ask for a lunch recommendation…"
        }
        disabled={isThinking}
        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white text-sm disabled:opacity-60 transition-shadow"
      />
      <button
        onClick={() => void handleSend()}
        disabled={isThinking || !inputValue.trim()}
        className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
      >
        Send
      </button>
    </>
  );

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <>
      <FoodPatternBackground />

      {/* ══════════════════════════════════════════════════════════════════════════
          STATE 1 — EMPTY
          Centered in the remaining viewport height.
          min-h calc: 100vh - nav(~52px) - main top-padding(24px) = 100vh - 76px
      ══════════════════════════════════════════════════════════════════════════ */}
      {!isActive && (
        <div className="min-h-[calc(100vh-76px)] flex flex-col items-center justify-center gap-8 text-center px-4">

          {/* Mode toggle — visible before the first message is sent */}
          <ModeToggle mode={mode} onSwitch={handleSwitchMode} />

          {/* Heading + subtitle */}
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-5xl font-bold text-gray-800">
              What&rsquo;s for{" "}
              <span className="text-indigo-600">Lunch?</span>
            </h1>
            <p className="text-gray-400 text-base max-w-sm">
              {mode === "agent"
                ? "Ask me to look up, update, or remove dishes from your tracker."
                : "Ask me anything about your tracked restaurants and dishes."}
            </p>
          </div>

          {/* Suggestion chips — clicking sets inputValue but does NOT trigger a send */}
          <div className="flex flex-wrap justify-center gap-3 max-w-xl">
            {SUGGESTION_CHIPS.map((chip) => (
              <button
                key={chip}
                onClick={() => setInputValue(chip)}
                className="px-4 py-2 rounded-full bg-white border border-gray-300 text-sm text-gray-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-colors cursor-pointer shadow-sm select-none"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Inline centered input bar */}
          <div className="flex items-center gap-2 w-full max-w-xl">
            {inputBarContent}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          STATE 2 — ACTIVE: split-screen after the first message is sent.

          Layout math:
            -mx-6 -mt-6       cancels <main>'s p-6 so panels go edge-to-edge
                              and start flush under the nav bar.
            md:h-[calc(100vh-124px)]
                              = 100vh - nav(52px) - fixed-input-bar(72px).
                              -mt-6 removes the 24px top padding from the equation
                              so only nav + bar height need to be subtracted.
      ══════════════════════════════════════════════════════════════════════════ */}
      {isActive && (
        <>
          {/* Split-screen container */}
          <div className="flex flex-col md:flex-row md:h-[calc(100vh-124px)] md:overflow-hidden -mx-6 -mt-6">

            {/* ── Left panel: conversation history (60% on desktop) ──────────── */}
            <div className="flex flex-col w-full md:w-[35%] border-r border-gray-200 bg-white md:overflow-hidden">

              {/* Sticky panel header: title + mode toggle on the left, Clear chat on the right */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white sticky top-0 z-10 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <h2 className="font-semibold text-gray-700 text-sm">Conversation</h2>
                  <ModeToggle mode={mode} onSwitch={handleSwitchMode} />
                </div>
                <button
                  onClick={handleClear}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors font-medium"
                >
                  Clear chat
                </button>
              </div>

              {/* Scrollable message list — newest message always scrolled into view */}
              <div className="flex-1 flex flex-col gap-3 px-4 py-4 overflow-y-auto">
                {messages.map((msg, i) => (
                  <MessageBubble key={i} turn={msg} />
                ))}

                {/* Bouncing-dot indicator while waiting for the AI response */}
                {isThinking && <ThinkingIndicator />}

                {/* Invisible scroll anchor — Effect 2 calls scrollIntoView on this */}
                <div ref={chatEndRef} />
              </div>
            </div>

            {/* ── Right panel: Mentioned Places (Recommend) or Agent Actions (Agent) ── */}
            <div className="flex flex-col w-full md:w-[65%] overflow-y-auto bg-gray-50 p-4 gap-4">
              <h2 className="font-semibold text-gray-700 text-sm px-1 flex-shrink-0">
                {mode === "agent" ? "Agent Actions" : "Mentioned Places"}
              </h2>

              {mode === "agent" ? (
                // ── Agent mode: persisted, turn-grouped tool call log ──────────────
                <AgentActionsPanel
                  steps={agentSteps}
                  undoneStepKeys={undoneStepKeys}
                  onUndo={handleUndo}
                  restaurantNameById={restaurantNameById}
                  lastAgentReply={[...messages].reverse().find((m) => m.role === "assistant")?.content ?? ""}
                />
              ) : (
                // ── Recommend mode: existing Mentioned Places behavior, unchanged ──
                <>
                  {/* Placeholder shown until the first restaurant is detected in a reply */}
                  {visibleRestaurants.length === 0 && (
                    <p className="text-sm text-gray-400 italic px-1">
                      Restaurant names will appear here as Claude mentions them.
                    </p>
                  )}

                  {/* Restaurant cards — fade in via the appearedIds Set (Effect 3) */}
                  {visibleRestaurants.map((r, index) => (
                    <RestaurantMentionCard
                      key={r.id}
                      restaurant={r}
                      colors={CARD_COLORS[index % CARD_COLORS.length]}
                      dishes={selectDishes(dishesByRestaurant[r.id] ?? [], lastReply)}
                      appeared={appearedIds.has(r.id)}
                      onDismiss={() => handleDismiss(r.id)}
                    />
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Fixed bottom input bar — full viewport width, z-50 above all panels */}
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 px-4 py-4 shadow-lg">
            <div className="max-w-5xl mx-auto flex items-center gap-2">
              {inputBarContent}
            </div>
          </div>

          {/* Spacer prevents the last chat message from hiding behind the fixed bar on mobile,
              where the panels stack vertically and are not height-constrained */}
          <div className="pb-[80px] md:hidden" />
        </>
      )}
    </>
  );
}
