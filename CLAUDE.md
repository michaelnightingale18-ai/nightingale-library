# Nightingale Library — Claude Code Guide

Kids' reading tracker PWA. A child picks a profile, tracks books they've read across series, earns levels as they complete books, and their parent approves level-ups with a PIN. Built for tablet/phone, dark-wood aesthetic.

---

## Commands

```bash
npm run dev      # dev server (Turbopack) → http://localhost:3000
npm run build    # production build — run this to verify before committing
npm run lint     # ESLint
```

Always run `npm run build` after changes. TypeScript errors fail the build.

---

## Stack

| Layer | Package | Version |
|---|---|---|
| Framework | Next.js App Router | 16.2.9 |
| React | React | 19.2.4 |
| Styling | Tailwind CSS | v4 |
| Animation | Framer Motion | 12 |
| State | Zustand | 5 |
| Database | Supabase (PostgreSQL) | @supabase/supabase-js 2 |
| AI | Anthropic SDK | 0.104 |
| Drag & drop | @dnd-kit/core + sortable | 6/10 |
| Icons | lucide-react | 1.18 |

---

## Project structure

```
src/
  app/
    page.tsx                        # Profile picker (home)
    layout.tsx                      # Root layout + CelebrationModal
    [profileId]/
      layout.tsx                    # Loads current profile into Zustand store
      page.tsx                      # Main library shelf (largest file — shelf rows, modals, DnD)
      add/page.tsx                  # Add book/series flow
      recommendations/page.tsx      # AI recommendations
      series/page.tsx               # Full series view
    api/
      books/search/route.ts         # Google Books API proxy
      series/search/route.ts        # Series search
      series/expand/route.ts        # Expand a known series
      recommendations/route.ts      # Claude-powered book recommendations
      cron/new-releases/route.ts    # Scheduled new-release checker (uses Claude)
      profile/approve-level/route.ts # Parent PIN gate for level-up approval

  components/
    shelf/
      SeriesShelfRow.tsx            # One horizontal shelf row (droppable container)
      BookCoverCard.tsx             # Single sortable book in a row
      SeriesTitleCard.tsx           # Left card showing series name/progress
      TreehouseProgressCard.tsx     # XP/level widget (top-right of library page)
      NightyHelper.tsx              # Floating bird mascot with speech bubble
      SidebarNav.tsx                # Left sidebar navigation
    ui/
      Book.tsx                      # Atomic book cover card (all visual states)
      WoodCard.tsx                  # Styled card with wood/gold aesthetic
      Progress.tsx                  # Animated progress bar
      NavRail.tsx                   # Bottom nav bar
    BookCoverTile.tsx               # Used in search results
    BottomNav.tsx                   # Mobile bottom nav
    CelebrationModal.tsx            # Confetti modal on book completion

  lib/
    theme.ts                        # ALL design tokens: colours, bookStates, levelFor(), BOOKS_PER_LEVEL
    types.ts                        # Shared TypeScript types (Book, Profile, BookWithRecord, SeriesGroup...)
    books.ts                        # groupBySeries() — turns flat reading_records into SeriesGroup[]
    supabase.ts                     # supabase (anon, client-side) + supabaseAdmin() (service role, server-only)
    claude.ts                       # Anthropic client + checkForNewRelease()

  store/
    useStore.ts                     # Zustand store: currentProfile, celebrationBook, setters
```

---

## Database (Supabase)

Four tables. RLS is currently open (public access) — this is a private family app with no auth.

### profiles
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | |
| avatar | text | emoji |
| color | text | hex accent colour |
| approved_level | integer | default 1 — parent-gated level unlock |

### books
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| title | text | |
| author | text | |
| cover_url | text | |
| series_name | text nullable | null = one-off |
| series_position | integer nullable | |
| total_in_series | integer nullable | |

### reading_records
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| profile_id | uuid FK → profiles | |
| book_id | uuid FK → books | |
| liked | boolean | true = completed/read |
| read_at | timestamptz | |
| currently_reading | boolean | default false |

### release_alerts
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| series_name | text | |
| book_title | text | |
| author | text | |
| release_info | text | |
| seen | boolean | default false |

---

## Key patterns

### Supabase clients
- `supabase` (from `src/lib/supabase.ts`) — lazy singleton using the public anon key. Use in client components and pages.
- `supabaseAdmin()` (same file) — uses `SUPABASE_SERVICE_ROLE_KEY`, bypasses RLS. **Server-only** — only call from `route.ts` files.

### API routes
All routes use `NextRequest` / `Response.json()`. Secrets are validated server-side and never exposed via `NEXT_PUBLIC_` env vars.

### Design tokens
**Never hardcode colours or sizes in components.** Everything visual goes through `src/lib/theme.ts`:
- `bookStates` — width, height, filter, shadow, lift per state (unread / reading / completed)
- `gold`, `wood` — colour palette objects
- `levelFor(totalRead)` — derives level/progress from book count
- `BOOKS_PER_LEVEL = 5`

### Book states
`stateOf(book)` in `SeriesShelfRow.tsx` is the single source of truth:
- `"completed"` — `book.liked === true`
- `"reading"` — `book.currently_reading === true`
- `"unread"` — everything else

### Drag and drop
DnD is **off by default** and activated by the "Rearrange" button in the bottom bar (`arrangeMode` state in `[profileId]/page.tsx`). While off, `useSortable` is `disabled: !arrangeMode` and `touchAction: auto` so native scroll is not blocked. While on, full dnd-kit drag works for: reorder within series, move between series, merge two one-offs into a named series. Undo toast appears after each move.

### Gamification / level gating
- Raw level = `levelFor(totalRead).level` (derived, never stored)
- Displayed level = `profile.approved_level` (persisted, requires parent PIN to advance)
- `POST /api/profile/approve-level` — validates `PARENT_PIN` env var server-side, updates `approved_level` if eligible

---

## Environment variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-only — never NEXT_PUBLIC_

# Anthropic
ANTHROPIC_API_KEY=

# Google Books (optional — increases rate limits)
GOOGLE_BOOKS_API_KEY=

# Cron job auth
CRON_SECRET=

# Parental controls PIN
PARENT_PIN=                        # server-only — never NEXT_PUBLIC_
```

---

## Deployment

Hosted on Vercel. Every `git push` to main triggers a deploy. Set all env vars under **Project → Settings → Environment Variables** in the Vercel dashboard.

---

## Things to avoid

- Do not prefix `SUPABASE_SERVICE_ROLE_KEY` or `PARENT_PIN` with `NEXT_PUBLIC_` — they must stay server-only.
- Do not call `supabaseAdmin()` from client components — only from `route.ts` files.
- Do not hardcode colours or book sizes — always go through `bookStates` and the palette in `theme.ts`.
- Do not enable drag-and-drop by default — it is intentionally gated behind `arrangeMode` to prevent accidental shelf reordering.
