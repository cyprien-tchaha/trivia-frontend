"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import api from "@/lib/api";

const C = {
  surface: "#13131a", surface2: "#1c1c27",
  border: "#2a2a3a", accent: "#00e5b0",
  danger: "#ff4d6d", text: "#f0f0f8", muted: "#6b6b8a",
};

export type TitleSearchCategory = "anime" | "tv_shows" | "movies";

export type SelectedTitle = {
  id: string;
  name: string;
  year: number | null;
  image_url: string | null;
};

type Props = {
  category: TitleSearchCategory;
  selected: SelectedTitle[];
  onChange: (next: SelectedTitle[]) => void;
  /** How many titles the host may pick. Defaults to 3. */
  maxSelected?: number;
  /** Optional custom placeholder for the empty input state. */
  placeholder?: string;
};

const DEBOUNCE_MS = 300;
const DEFAULT_MAX = 3;

/**
 * Multi-select autocomplete for title selection. Hits /api/search?category=...&q=...
 * for suggestions. Selected items render as chips with ✕ to remove. Capped at
 * maxSelected (default 3). Keyboard: ArrowUp/Down to navigate the dropdown,
 * Enter to pick, Escape to close, Backspace on empty input removes last chip.
 */
export default function TitleMultiSelect({
  category,
  selected,
  onChange,
  maxSelected = DEFAULT_MAX,
  placeholder,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SelectedTitle[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Tracks the latest in-flight request so out-of-order responses don't
  // overwrite newer results (common when user types fast).
  const requestSeqRef = useRef(0);

  const atLimit = selected.length >= maxSelected;

  // Click outside closes the dropdown. Listen on mousedown rather than click
  // so the dropdown closes before a possible blur/refocus race.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Debounced search. Resets results when query becomes too short.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const seq = ++requestSeqRef.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const r = await api.get(`/search`, { params: { category, q } });
        // Drop stale responses.
        if (seq !== requestSeqRef.current) return;
        const raw: SelectedTitle[] = r.data?.results ?? [];
        // Filter out anything already selected so users don't pick duplicates.
        const filtered = raw.filter((item) => !selected.some((s) => s.id === item.id));
        setResults(filtered);
        setHighlight(0);
      } catch {
        if (seq === requestSeqRef.current) setResults([]);
      } finally {
        if (seq === requestSeqRef.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, category, selected]);

  // When the category changes, the existing query is meaningless and
  // existing results are wrong. Wipe them.
  useEffect(() => {
    setQuery("");
    setResults([]);
    setOpen(false);
  }, [category]);

  const addItem = useCallback(
    (item: SelectedTitle) => {
      if (selected.some((s) => s.id === item.id)) return;
      if (selected.length >= maxSelected) return;
      onChange([...selected, item]);
      setQuery("");
      setResults([]);
      // Keep focus in the input so the host can keep typing/picking.
      inputRef.current?.focus();
    },
    [selected, maxSelected, onChange]
  );

  const removeItem = useCallback(
    (id: string) => {
      onChange(selected.filter((s) => s.id !== id));
    },
    [selected, onChange]
  );

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && query === "" && selected.length > 0) {
      e.preventDefault();
      removeItem(selected[selected.length - 1].id);
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[highlight];
      if (item) addItem(item);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  // Build the empty-state hint shown in the dropdown when the user has typed
  // something but we have no matches (or they typed too few chars).
  function emptyStateText(): string {
    const q = query.trim();
    if (q.length < 2) return "Type at least 2 characters to search…";
    if (loading) return "Searching…";
    return "No matches.";
  }

  const showDropdown = open && (query.trim().length >= 2 || results.length > 0);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* Chip + input row */}
      <div
        style={{
          display: "flex", flexWrap: "wrap", gap: "6px",
          padding: "8px 10px", minHeight: "46px", alignItems: "center",
          background: C.surface2, border: `1px solid ${C.border}`,
          borderRadius: "10px",
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {selected.map((s) => (
          <span
            key={s.id}
            style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              padding: "4px 6px 4px 10px", borderRadius: "999px",
              background: "rgba(0,229,176,0.1)",
              border: "1px solid rgba(0,229,176,0.3)",
              color: C.text, fontSize: "13px",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {s.name}{s.year ? ` (${s.year})` : ""}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeItem(s.id); }}
              aria-label={`Remove ${s.name}`}
              style={{
                width: "18px", height: "18px", borderRadius: "50%",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                background: "transparent", border: "none",
                color: C.muted, cursor: "pointer",
                fontSize: "11px", lineHeight: 1, padding: 0,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.danger)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.muted)}
            >✕</button>
          </span>
        ))}

        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          disabled={atLimit}
          placeholder={
            atLimit
              ? `${maxSelected} of ${maxSelected} selected`
              : (selected.length === 0
                ? (placeholder ?? "Start typing a title…")
                : "Add another…")
          }
          aria-label="Search titles"
          style={{
            flex: "1 0 140px", minWidth: 0,
            background: "transparent", border: "none", outline: "none",
            color: C.text, fontSize: "14px",
            fontFamily: "'DM Sans', sans-serif",
            padding: "4px 2px",
          }}
        />
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          role="listbox"
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
            zIndex: 20,
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: "10px",
            maxHeight: "300px", overflowY: "auto",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          {results.length === 0 ? (
            <div style={{ padding: "12px 14px", color: C.muted, fontSize: "13px" }}>
              {emptyStateText()}
            </div>
          ) : (
            results.map((r, i) => {
              const isHi = i === highlight;
              return (
                <div
                  key={r.id}
                  role="option"
                  aria-selected={isHi}
                  onMouseDown={(e) => {
                    // mousedown (not click) so it fires before the input blur,
                    // avoiding a flicker where the dropdown closes first.
                    e.preventDefault();
                    addItem(r);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "8px 12px", cursor: "pointer",
                    background: isHi ? C.surface2 : "transparent",
                  }}
                >
                  {/* Thumbnail or fallback initial */}
                  {r.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.image_url}
                      alt=""
                      width={32}
                      height={32}
                      style={{
                        width: "32px", height: "32px", borderRadius: "6px",
                        objectFit: "cover", flexShrink: 0,
                        background: C.surface2,
                      }}
                      loading="lazy"
                    />
                  ) : (
                    <div
                      aria-hidden
                      style={{
                        width: "32px", height: "32px", borderRadius: "6px",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: "rgba(0,229,176,0.1)",
                        color: C.accent, fontSize: "13px", fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {r.name[0]?.toUpperCase() ?? "?"}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "14px", color: C.text,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}
                    >
                      {r.name}
                    </div>
                    {r.year && (
                      <div style={{ fontSize: "12px", color: C.muted }}>{r.year}</div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
