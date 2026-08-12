# CLAUDE.md — Kolam Podu

Agentic development reference for this project. Read this file before making any decisions.

## What This Is

**Kolam Podu (கோலம் போடு)** is a mobile puzzle game about drawing kolams — traditional Tamil pulli (dot-grid) kolam patterns. Players trace continuous paths around dot grids to complete kolam patterns, mirroring the real-world practice.

**Platform:** Mobile — iOS and Android  
**Genre:** Casual puzzle / meditative  
**Status:** Pre-development (design and architecture phase)

---

## Design Principles — Non-Negotiable

Every technical and design decision must be evaluated against these:

1. **Culturally grounded, not decorative** — Visuals, colors, patterns, and sound must be rooted in real Tamil kolam tradition. When uncertain about cultural accuracy, flag for human review rather than guessing.
2. **Non-predatory engagement** — No energy systems, no paywalled levels, no dark patterns. Retention comes from genuine enjoyment and the daily ritual mechanic, not manipulation.
3. **Meditative UX** — Drawing must feel quiet, tactile, and satisfying. Avoid cluttered UI, aggressive animations, or noisy feedback.
4. **Easy to play, hard to master** — The first pattern is immediately intuitive. The skill ceiling (stroke economy, symmetry planning, dot weaving) is high.

---

## Core Mechanics

These are established. Do not change without discussion.

| Mechanic | Description |
|---|---|
| **Dot grid (pulli)** | Patterns are built on a grid of dots |
| **Continuous stroke** | Line cannot lift mid-pattern; the loop must close to complete |
| **Live symmetry mirroring** | Stroke mirrors across axes in real time as the player draws |
| **Stroke economy** | Fewer strokes = higher mastery score |
| **Dot weaving** | Advanced: lines pass over/under specific dots (layered patterns) |
| **Daily kolam** | One shared pattern per day, same for all players |
| **Festival calendar** | Special patterns tied to Tamil festivals |
| **Living gallery** | Every completed kolam is preserved in the player's personal collection |

---

## Level Progression

| Phase | Levels | Grid | Symmetry | Guide | New Mechanic |
|---|---|---|---|---|---|
| Foundations | 1–20 | 3×3 | 2-axis | Full | Core loop |
| Practice | 21–60 | 5×5 | 2-axis | Fading | Stroke economy |
| Craft | 61–120 | 5×5–7×7 | 4-axis | Minimal | Dot weaving |
| Mastery | 121+ | Free | 8-axis | None | Full mastery |

---

## Architecture Decisions

### Open (not yet decided)
- [ ] **Framework:** React Native vs Flutter vs native Swift/Kotlin
- [ ] **Rendering:** Canvas/SVG drawing vs game engine (Unity/Godot)
- [ ] **Backend:** Required for daily kolam sync, leaderboards, user gallery
- [ ] **Pattern format:** How kolam patterns are defined and stored (data structure TBD)
- [ ] **State management:** Approach for game state, progress, gallery

### Constraints to respect
- Touch-first input — the drawing mechanic must feel native on mobile
- Offline-capable — the core game loop must work without a connection
- Low battery / thermal impact — drawing is smooth, not GPU-intensive

---

## Cultural Reference

Key terms and context agents should know:

- **கோலம் (Kolam)** — the pattern
- **புள்ளி கோலம் (Pulli Kolam)** — dot-based kolam (what this game uses)
- **கோலம் போடு (Kolam Podu)** — "to draw a kolam" (imperative / inviting form)
- Kolams are drawn at dawn, at thresholds, to welcome Lakshmi and invite prosperity
- Traditional medium: white rice flour for the base; colored powder (வண்ண கோலம்) for festivals
- The act is meditative and social — women draw together, teach daughters, compete in skill
- Kolams are explicitly impermanent — drawn to be walked through, rained on, swept away

**Color symbolism to respect:**
- White: purity, the everyday kolam
- Red/orange (kumkum): auspiciousness, used at borders and festivals
- Yellow (turmeric): prosperity and protection
- Green: fertility and abundance
- Blue: rarely used in traditional kolam; use carefully

---

## Agentic Development Guidelines

### Flag for human review
- Any decision touching cultural accuracy or representation
- New kolam pattern additions (should include traditional name and origin if known)
- Color palette choices (must respect Tamil color symbolism above)
- Monetization or engagement mechanism changes

### Document as you go
- Architecture decisions → update this file with rationale
- Accessibility decisions (contrast, motor accessibility for drawing) → log in `docs/accessibility.md`
- New kolam patterns → document in `docs/patterns/`

### Code conventions
*Will be filled in once the tech stack is decided. Check back after the framework decision is made.*

---

## Planned File Structure

```
kolam-podu/
├── CLAUDE.md                  # This file — agentic dev reference
├── README.md                  # Public-facing overview
├── docs/
│   ├── game-design.md         # Full game design document
│   ├── accessibility.md       # Accessibility decisions and rationale
│   ├── cultural-notes.md      # Cultural research and references
│   └── patterns/              # Kolam pattern definitions and references
├── src/                       # Application source (TBD by framework)
└── assets/
    ├── patterns/              # Kolam pattern data files
    └── art/                   # Visual assets
```

---

## Key Open Questions

These need human input before work can proceed:

1. What framework/rendering approach? (affects everything)
2. Is there a backend from day one, or start offline-only?
3. What is the MVP scope — how many levels ship in v1?
4. Is the first release iOS-only or both platforms simultaneously?
