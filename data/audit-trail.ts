/**
 * Audit-trail prototype data.
 *
 * Each entry below maps 1:1 to a row in the proposed `audit_log` table
 * (see v3 settlement memo). Real implementation would write rows on
 * events (deal-email parsed, expense entered, signoff captured, dispute
 * opened, etc.). Prototype reads from this static file.
 *
 * Proposed schema (one row per entry):
 *
 *   audit_log (
 *     id           text pk,
 *     show_id      text fk -> shows.id,
 *     occurred_at  timestamp,
 *     actor_id     text fk -> users.id  (nullable for external + companion),
 *     actor_kind   enum: booker | tm | agent | gm | companion | external,
 *     kind         enum (see EntryKind below),
 *     summary      text,           -- one-line for trail row
 *     body         text,           -- expandable detail / quote
 *     evidence     json,           -- list of {label, href, source_kind}
 *     field_change json,           -- {field, before, after} when applicable
 *     visibility   enum: internal | shared_tm | shared_agent | private,
 *     companion_flag_id text       -- when this entry was raised by Companion
 *   )
 *
 * Coverage matrix (transcript cases → entry kinds):
 *
 *   M2  paper trail of room conversation          → at_table_signoff, dispute_*
 *   M6  show your work                            → evidence[] per entry
 *   M7  recurring pattern detection               → companion_flag w/ history_refs
 *   M8  hospitality overage pre-show              → pre_show_flag (hospitality)
 *   M9  absorb-vs-passthrough callout             → absorbed_decision
 *   D1  TM phone pre-review                       → visibility: shared_tm
 *   D2  see the math                              → math_strip + dispute msgs
 *   D3  expected-range delta                      → tm_expected_number
 *   D4  sign at table, dispute next day           → at_table_signoff → agent_dispute
 *   MK1 GM 30s scan / 10min deep                  → hero strip + expand
 *   MK2 unusual flag system                       → companion_flag surfaces only anomalies
 *   MK5 pre-show messy forecast                   → pre_show_flag (ambiguity)
 *   S1  agent reads in 3min                       → visibility: shared_agent, summary line
 *   S2  one canonical deal version                → deal_email (origin) + amendments diff
 *   S3  preview while TM at table                 → visibility: shared_tm + share_link
 *   S4  line provenance to receipts               → evidence[].href
 *   S5  show work, not fait accompli              → expand reveals reasoning
 */

export type ActorKind =
  | "booker"
  | "tm"
  | "agent"
  | "gm"
  | "companion"
  | "external";

export type EntryKind =
  | "deal_email" // origin: deal as first written
  | "deal_amendment" // hospitality cap moved, recoup added, etc.
  | "pre_show_flag" // Companion-raised, before show day
  | "absorbed_decision" // venue eats a cost (hospitality overage, etc.)
  | "tm_expected_number" // back-of-envelope number TM brings to table
  | "at_table_signoff" // TM in-person signoff
  | "gm_approval" // GM text/screenshot approval
  | "agent_dispute_opened" // next-morning agent email questioning math
  | "dispute_message" // back-and-forth inside thread
  | "dispute_resolution" // settled-on read + amount moved
  | "private_note"; // booker-only reflection

export type Visibility = "internal" | "shared_tm" | "shared_agent" | "private";

export type EvidenceRef = {
  label: string;
  kind: "email" | "doc" | "pos" | "receipt" | "text" | "verbal";
  href?: string; // in prototype: anchor or undefined
};

export type FieldChange = {
  field: string;
  before?: string | number | null;
  after?: string | number | null;
};

export type AuditEntry = {
  id: string;
  occurredAt: string; // ISO 8601
  actorName: string;
  actorRole: string;
  actorKind: ActorKind;
  kind: EntryKind;
  summary: string;
  body?: string;
  evidence?: EvidenceRef[];
  fieldChange?: FieldChange;
  visibility: Visibility;
  // For companion flags: refs to other entries that establish the pattern.
  historyRefs?: string[];
  // For at_table_signoff / agent_dispute_opened: the payout number under discussion.
  payoutAtMoment?: number;
};

export type CompanionFlag = {
  id: string;
  raisedAt: string;
  kind: "ambiguity" | "hospitality_overage" | "marketing_recoup_pattern";
  title: string;
  body: string;
  // Pattern evidence: other shows where this same shape played out.
  historyRefs: { showId: string; showName: string; outcome: string }[];
  status: "open" | "acknowledged" | "resolved";
};

export type DealDiff = {
  field: string;
  before: string;
  after: string;
  source: string;
  sourceDate: string;
  warning?: string;
};

/**
 * AI summary per the v3 memo:
 *
 *   "A readable state view on top of the ledger, every line expandable to
 *    its source entry. Strictly assistive — when summary and ledger
 *    disagree, the ledger governs, and the product says so."
 *
 * Represented as an ordered list of parts. A plain string is connective
 * tissue. A SummarySpan is a load-bearing fact that points back at one or
 * more ledger entries — click the span and the UI scrolls to / highlights
 * that entry. Generated lazily in production; static here.
 */
export type SummarySpan = { text: string; sources: string[] };
export type AiSummary = {
  parts: (string | SummarySpan)[];
  generatedAt: string;
};

export type ShowTrail = {
  showId: string;
  // Fallback only — UI reads deals.dealNotesFreetext from the database, which
  // is the prose Mariana actually trusts. This string is shown only when the
  // deal record has no notes (rare). Don't add new content here; edit the
  // seed in db/seed.ts under `dealNotesFreetext`.
  dealSummary: string;
  // Optional — only set on trails rich enough to summarize. Light trails
  // (one or two entries) skip this and let the ledger speak for itself.
  aiSummary?: AiSummary;
  companionFlags: CompanionFlag[];
  dealDiff: DealDiff[];
  entries: AuditEntry[];
  // Affordances surfaced in UI but non-functional in prototype.
  affordances: {
    shareWithTm: boolean;
    sendToAgent: boolean;
  };
};

// -----------------------------------------------------------------------------
// Coastal Spell — full trail. Lifted from dispute-thread.md + transcripts.
// -----------------------------------------------------------------------------

const COASTAL_SPELL: ShowTrail = {
  showId: "show_coastal_spell_dispute",
  dealSummary:
    "$5,000 vs 80% of net after expenses, expenses capped $2,500, marketing recoup $900 against gross, hospitality cap $500.",
  aiSummary: {
    generatedAt: "2025-03-19T09:30:00Z",
    parts: [
      "Coastal Spell played March 14, 2025. Deal is ",
      { text: "$5,000 vs 80% of net", sources: ["entry_deal_email_origin"] },
      " with expenses capped at $2,500. Two amendments since signing: hospitality cap moved ",
      {
        text: "$500 → $700",
        sources: ["entry_hospitality_amendment"],
      },
      " on Mar 3, and a ",
      {
        text: "$900 marketing recoup",
        sources: ["entry_recoup_verbal"],
      },
      " was added Mar 5 — verbal only, no written confirmation. Companion flagged the recoup language as ",
      {
        text: "ambiguous before show day",
        sources: ["entry_companion_flag"],
      },
      ". Tour manager signed off at the table on the night at ",
      { text: "$11,565", sources: ["entry_at_table_signoff"] },
      ". The agent ",
      {
        text: "opened a dispute four days later",
        sources: ["entry_dispute_opened"],
      },
      " over the recoup interpretation; resolved Mar 19 on the agent's read, with the ",
      {
        text: "venue absorbing $720",
        sources: ["entry_marcus_resolution"],
      },
      ".",
    ],
  },
  affordances: { shareWithTm: true, sendToAgent: true },

  companionFlags: [
    {
      id: "flag_recoup_ambiguity",
      raisedAt: "2024-12-08T15:48:00Z",
      kind: "marketing_recoup_pattern",
      title: "Ambiguous recoup phrasing",
      body: "Deal email contains “marketing recoup of $900 against gross” — could be inside or outside the $2,500 expense cap. Pattern caused 3 disputes with WME in last 12 months.",
      historyRefs: [
        {
          showId: "show_prior_wme_1",
          showName: "Heron Tide — Aug 2024",
          outcome: "Resolved on agent’s read, $480 absorbed",
        },
        {
          showId: "show_prior_wme_2",
          showName: "Bright Static — May 2024",
          outcome: "Resolved on venue’s read, agent goodwill cost",
        },
        {
          showId: "show_prior_wme_3",
          showName: "Low Country — Feb 2024",
          outcome: "Resolved with $260 split",
        },
      ],
      status: "acknowledged",
    },
  ],

  dealDiff: [
    {
      field: "Hospitality cap",
      before: "$500",
      after: "$700",
      source: "email",
      sourceDate: "2025-03-03",
    },
    {
      field: "Marketing recoup",
      before: "—",
      after: "+$900 added",
      source: "booker note (verbal w/ Andrea)",
      sourceDate: "2025-03-05",
      warning: "Verbal only — no written confirmation",
    },
    {
      field: "Recoup ↔ cap order",
      before: "—",
      after: "Unresolved interpretation",
      source: "Companion flag",
      sourceDate: "2024-12-08",
      warning: "Open at signoff",
    },
  ],

  entries: [
    // E11 origin
    {
      id: "entry_deal_email_origin",
      occurredAt: "2024-12-08T15:14:00Z",
      actorName: "Andrea Pelletier",
      actorRole: "WME · deal email",
      actorKind: "agent",
      kind: "deal_email",
      summary:
        "Original deal email. $5,000 vs 80% net, expenses capped $2,500, marketing recoup $900 against gross, hospitality cap $500.",
      body: "“$5,000 vs 80% of net after expenses, expenses capped at $2,500, marketing recoup of $900 against gross, hospitality cap of $500. Standard terms otherwise.”",
      evidence: [
        { label: "Deal email · 80 words", kind: "email" },
      ],
      visibility: "shared_agent",
    },
    // E10 companion flag (right after deal email)
    {
      id: "entry_companion_flag",
      occurredAt: "2024-12-08T15:48:00Z",
      actorName: "Companion",
      actorRole: "automated flag",
      actorKind: "companion",
      kind: "pre_show_flag",
      summary:
        "Flagged “marketing recoup of $900 against gross” — inside or outside the $2,500 cap is ambiguous.",
      body: "3 prior WME deals with same phrasing each produced a dispute. Recommended clarifying with Andrea before showtime.",
      historyRefs: [
        "show_prior_wme_1",
        "show_prior_wme_2",
        "show_prior_wme_3",
      ],
      visibility: "internal",
    },
    // E9 hospitality amendment
    {
      id: "entry_hospitality_amendment",
      occurredAt: "2025-03-03T10:22:00Z",
      actorName: "Andrea Pelletier",
      actorRole: "WME · email",
      actorKind: "agent",
      kind: "deal_amendment",
      summary:
        "Raised hospitality cap to $700 to accommodate band’s rider update.",
      evidence: [{ label: "Email · Mar 3", kind: "email" }],
      fieldChange: {
        field: "hospitality_cap",
        before: 500,
        after: 700,
      },
      visibility: "shared_agent",
    },
    // E8 marketing recoup verbal
    {
      id: "entry_recoup_verbal",
      occurredAt: "2025-03-05T16:14:00Z",
      actorName: "Mariana Reyes",
      actorRole: "booker · note",
      actorKind: "booker",
      kind: "deal_amendment",
      summary:
        "Logged $900 marketing recoup, agreed verbally with Andrea on the call this morning. Pending written confirmation.",
      evidence: [{ label: "Verbal · phone call", kind: "verbal" }],
      fieldChange: {
        field: "marketing_recoup",
        before: null,
        after: 900,
      },
      visibility: "internal",
    },
    // M8 + M9 pre-show flag: hospitality forecast to run over
    {
      id: "entry_hospitality_forecast",
      occurredAt: "2025-03-12T09:00:00Z",
      actorName: "Companion",
      actorRole: "pre-show forecast",
      actorKind: "companion",
      kind: "pre_show_flag",
      summary:
        "Hospitality projected to run ~$120 over the $700 cap based on rider + production manager’s order list.",
      body: "Whiskey order alone exceeds prior shows by 1.4×. Recommended either trimming rider or pre-emailing Andrea about overage.",
      visibility: "internal",
    },
    // D3 TM expected number
    {
      id: "entry_tm_expected",
      occurredAt: "2025-03-14T21:30:00Z",
      actorName: "Diego Velasquez",
      actorRole: "tour manager · pre-table",
      actorKind: "tm",
      kind: "tm_expected_number",
      summary:
        "Walked in with expected payout ~$12,000–$12,500 from manager’s back-of-envelope math.",
      payoutAtMoment: 12285,
      visibility: "shared_tm",
    },
    // M9 absorbed decision (hospitality overage)
    {
      id: "entry_absorbed_hospitality",
      occurredAt: "2025-03-14T23:15:00Z",
      actorName: "Mariana Reyes",
      actorRole: "booker · at table",
      actorKind: "booker",
      kind: "absorbed_decision",
      summary:
        "Hospitality ran $120 over $700 cap. Venue absorbs the overage — not passed through to artist.",
      fieldChange: {
        field: "hospitality_absorbed",
        before: 0,
        after: 120,
      },
      visibility: "shared_tm",
    },
    // E7 at-table signoff
    {
      id: "entry_at_table_signoff",
      occurredAt: "2025-03-14T23:30:00Z",
      actorName: "Diego Velasquez",
      actorRole: "tour manager · sign-off",
      actorKind: "tm",
      kind: "at_table_signoff",
      summary:
        "Signed off on settlement at the table. Payout $11,565. No flags raised in the room.",
      payoutAtMoment: 11565,
      visibility: "shared_tm",
    },
    // GM approval (Mariana texts Marcus)
    {
      id: "entry_gm_approval",
      occurredAt: "2025-03-14T23:42:00Z",
      actorName: "Marcus Holland",
      actorRole: "GM · text approval",
      actorKind: "gm",
      kind: "gm_approval",
      summary: "“ok — looks good” via text. Approved for Monday wire.",
      evidence: [{ label: "Text screenshot", kind: "text" }],
      visibility: "internal",
    },
    // E6 agent dispute opened
    {
      id: "entry_dispute_opened",
      occurredAt: "2025-03-18T11:47:00Z",
      actorName: "Daniel Hwang",
      actorRole: "WME · opened dispute",
      actorKind: "agent",
      kind: "agent_dispute_opened",
      summary:
        "Questioned payout of $11,565 vs his calculation of $12,285. Asked whether $900 recoup comes off gross or sits inside the $2,500 cap.",
      payoutAtMoment: 12285,
      evidence: [{ label: "Email · Mar 18 11:47am", kind: "email" }],
      visibility: "shared_agent",
    },
    // E5 Mariana math walk
    {
      id: "entry_mariana_math",
      occurredAt: "2025-03-18T14:31:00Z",
      actorName: "Mariana Reyes",
      actorRole: "booker · email reply",
      actorKind: "booker",
      kind: "dispute_message",
      summary:
        "Walked through math chain: recoup deducted before 80% applied, treated as separate from $2,500 cap. Final: $11,565.",
      body: "Gross $19,840 − CC fees $1,984 − recoup $900 = $16,956. Less $2,500 cap = $14,456 net. 80% = $11,565.",
      evidence: [{ label: "Email with math", kind: "email" }],
      visibility: "shared_agent",
    },
    // E4 Daniel concedes ambiguity
    {
      id: "entry_daniel_concedes",
      occurredAt: "2025-03-18T15:14:00Z",
      actorName: "Daniel Hwang",
      actorRole: "WME · email reply",
      actorKind: "agent",
      kind: "dispute_message",
      summary:
        "Andrea’s intent: recoup inside $2,500 cap. Acknowledged email “can be read either way.” Asked to settle at $12,285.",
      evidence: [{ label: "Email · Mar 18 3:14pm", kind: "email" }],
      visibility: "shared_agent",
    },
    // E3 Mariana loops GM
    {
      id: "entry_mariana_loops_gm",
      occurredAt: "2025-03-18T17:02:00Z",
      actorName: "Mariana Reyes",
      actorRole: "booker · email reply",
      actorKind: "booker",
      kind: "dispute_message",
      summary:
        "Looped in Marcus. Flagged this is the third marketing-recoup interpretation dispute this year, all with WME.",
      evidence: [{ label: "Email", kind: "email" }],
      visibility: "shared_agent",
    },
    // E2 Marcus resolution
    {
      id: "entry_marcus_resolution",
      occurredAt: "2025-03-19T09:14:00Z",
      actorName: "Marcus Holland",
      actorRole: "GM · resolution",
      actorKind: "gm",
      kind: "dispute_resolution",
      summary:
        "Settled on Andrea’s read. Additional $720 wired. Flagged for record: not the only fair reading of the deal.",
      body: "“I’ll send the additional $720 today. We’re going to settle on Andrea’s read this time but I want to flag for the record that we don’t think it was the only fair reading of the deal.”",
      evidence: [{ label: "Email thread (6 msgs)", kind: "email" }],
      fieldChange: {
        field: "settlement.payout_final",
        before: 11565,
        after: 12285,
      },
      payoutAtMoment: 12285,
      visibility: "shared_agent",
    },
    // E1 Mariana private reflection
    {
      id: "entry_mariana_private",
      occurredAt: "2025-03-19T09:21:00Z",
      actorName: "Mariana Reyes",
      actorRole: "booker · private",
      actorKind: "booker",
      kind: "private_note",
      summary:
        "Cost us $720 + a few hours + agent goodwill. Need wording discipline in deal emails going forward.",
      visibility: "private",
    },
  ],
};

// -----------------------------------------------------------------------------
// Sample short trails for a few other shows (so empty state doesn't dominate).
// -----------------------------------------------------------------------------

const SAMPLE_LIGHT: Omit<ShowTrail, "showId">[] = [
  {
    dealSummary: "$3,000 flat guarantee. No expense pass-through.",
    affordances: { shareWithTm: true, sendToAgent: true },
    companionFlags: [],
    dealDiff: [],
    entries: [
      {
        id: "x1",
        occurredAt: "2026-04-12T22:48:00Z",
        actorName: "Mariana Reyes",
        actorRole: "booker · at table",
        actorKind: "booker",
        kind: "at_table_signoff",
        summary: "TM signed. Clean settlement, no flags. 12 minutes at the table.",
        visibility: "shared_tm",
      },
    ],
  },
];

const trails: Record<string, ShowTrail> = {
  [COASTAL_SPELL.showId]: COASTAL_SPELL,
};

export function getTrailForShow(showId: string): ShowTrail | null {
  return trails[showId] ?? null;
}

export function hasTrail(showId: string): boolean {
  return showId in trails;
}

// Quick lookup helper for stats strip.
export function trailStats(trail: ShowTrail) {
  const counts = {
    total: trail.entries.length,
    openFlags: trail.companionFlags.filter((f) => f.status !== "resolved").length,
    disputes: trail.entries.filter(
      (e) =>
        e.kind === "agent_dispute_opened" ||
        e.kind === "dispute_message" ||
        e.kind === "dispute_resolution",
    ).length,
    amendments: trail.entries.filter((e) => e.kind === "deal_amendment").length,
  };
  // Entries seeded in chronological-ascending order: index 0 is oldest,
  // last index is newest. Span = newest − oldest.
  const oldest = trail.entries[0];
  const newest = trail.entries[trail.entries.length - 1];
  const spanDays =
    oldest && newest
      ? Math.max(
          0,
          Math.round(
            (new Date(newest.occurredAt).getTime() -
              new Date(oldest.occurredAt).getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : 0;
  return { ...counts, spanDays };
}

// -----------------------------------------------------------------------------
// Derived show view — what the show page should display when a trail exists.
// This reconciles the two realities: DB state (often stale, e.g. status =
// "disputed") versus what actually happened in the trail (dispute resolved,
// final payout settled). Show page reads from this helper when a trail exists,
// so the badges, payout, and amendments all match the trail.
// -----------------------------------------------------------------------------

export type DerivedShowView = {
  finalStatus: "settled" | "disputed" | "in_review" | "paid";
  statusLabel: string;
  finalPayout: number | null;
  initialPayout: number | null;
  absorbedDelta: number; // amount venue absorbed (positive = venue ate cost)
  amendments: { field: string; before: string | number | null; after: string | number | null }[];
  openFlags: number;
  resolvedDispute: boolean;
  // The "post-trail truth" for deal fields — e.g. hospitality cap currently
  // shown in DB as $500 but the trail records an amendment to $700.
  effectiveDealOverrides: Record<string, string | number>;
  trailSummary: string;
};

export function deriveShowView(trail: ShowTrail): DerivedShowView {
  const resolved = trail.entries.find((e) => e.kind === "dispute_resolution");
  const signoff = trail.entries.find((e) => e.kind === "at_table_signoff");
  const finalPayout = resolved?.payoutAtMoment ?? signoff?.payoutAtMoment ?? null;
  const initialPayout = signoff?.payoutAtMoment ?? null;
  const absorbedDelta =
    finalPayout != null && initialPayout != null
      ? finalPayout - initialPayout
      : 0;

  const amendments = trail.entries
    .filter((e) => e.kind === "deal_amendment" && e.fieldChange)
    .map((e) => ({
      field: e.fieldChange!.field,
      before: e.fieldChange!.before ?? null,
      after: e.fieldChange!.after ?? null,
    }));

  const effectiveDealOverrides: Record<string, string | number> = {};
  amendments.forEach((a) => {
    if (a.after != null) effectiveDealOverrides[a.field] = a.after;
  });

  const openFlags = trail.companionFlags.filter(
    (f) => f.status !== "resolved",
  ).length;
  const resolvedDispute = !!resolved;
  const finalStatus = resolvedDispute ? "settled" : signoff ? "settled" : "in_review";
  const statusLabel = resolvedDispute
    ? "Settled (after dispute)"
    : signoff
      ? "Settled at table"
      : "In review";

  const trailSummary = `${trail.entries.length} audit entries · ${amendments.length} amendment${amendments.length === 1 ? "" : "s"}${resolvedDispute ? " · dispute resolved" : ""}${openFlags ? ` · ${openFlags} open flag${openFlags === 1 ? "" : "s"}` : ""}`;

  return {
    finalStatus,
    statusLabel,
    finalPayout,
    initialPayout,
    absorbedDelta,
    amendments,
    openFlags,
    resolvedDispute,
    effectiveDealOverrides,
    trailSummary,
  };
}

// -----------------------------------------------------------------------------
// Evidence content store — what each evidence chip resolves to when clicked.
// In production, evidence rows would link to actual emails/POS/receipts in
// their respective systems. Prototype: lift the email text from
// dispute-thread.md verbatim so reviewers see real source content.
// -----------------------------------------------------------------------------

export type EvidenceContent = {
  title: string;
  kind: "email" | "text" | "verbal" | "doc" | "pos" | "receipt";
  from?: string;
  to?: string;
  cc?: string;
  date?: string;
  body: string;
};

export const EVIDENCE_BY_ENTRY: Record<string, EvidenceContent> = {
  entry_deal_email_origin: {
    title: "Deal email — Coastal Spell, March 14 2025",
    kind: "email",
    from: "Andrea Pelletier <apelletier@wme.com>",
    to: "Mariana Reyes <mariana@thecrescentnashville.com>",
    date: "December 8, 2024",
    body: `Hi Mariana,

Confirming Coastal Spell for The Crescent, March 14 2025. Standard package:

$5,000 vs 80% of net after expenses, expenses capped at $2,500, marketing recoup of $900 against gross, hospitality cap of $500. Standard terms otherwise.

Let me know if you have any questions, otherwise we're good to go.

— Andrea`,
  },
  entry_hospitality_amendment: {
    title: "Hospitality cap update",
    kind: "email",
    from: "Andrea Pelletier <apelletier@wme.com>",
    to: "Mariana Reyes <mariana@thecrescentnashville.com>",
    date: "March 3, 2025",
    body: `Mariana — band has an updated rider that adds a few hospitality items. Can we bump the hospitality cap to $700 to cover the new asks? Everything else stays the same.

— A`,
  },
  entry_recoup_verbal: {
    title: "Verbal agreement — phone call",
    kind: "verbal",
    date: "March 5, 2025, 11:40am",
    body: `Andrea called re marketing plans. Agreed verbally that the $900 marketing recoup will hit the settlement. She'll send written confirmation but hasn't yet. Logging here so I don't lose it.

— M`,
  },
  entry_dispute_opened: {
    title: "Re: Settlement — Coastal Spell, March 14",
    kind: "email",
    from: "Daniel Hwang <dhwang@wme.com>",
    to: "Mariana Reyes <mariana@thecrescentnashville.com>",
    cc: "Andrea Pelletier; Coastal Spell Management",
    date: "Tuesday, March 18, 2025, 11:47 AM",
    body: `Hi Mariana,

Hope you're well. I just got a chance to review the settlement statement for Coastal Spell's show on the 14th. I have a question about the math.

Our deal was $5,000 vs 80% of net after expenses, expenses capped at $2,500. The artist hit the guarantee comfortably — gross was $19,840 — so we should be getting the percentage. By my count that's 80% × ($19,840 - $1,984 in fees - $2,500 in expenses) = 80% × $15,356 = $12,285.

Your statement shows $11,565.

The difference looks like the marketing recoup ($900). Was that supposed to come off the gross before we calculated net, or is it part of the expenses bucket capped at $2,500?

Want to make sure I'm reading this right before I loop in management.

Thanks,
Daniel`,
  },
  entry_mariana_math: {
    title: "Re: Settlement — Coastal Spell, March 14",
    kind: "email",
    from: "Mariana Reyes <mariana@thecrescentnashville.com>",
    to: "Daniel Hwang <dhwang@wme.com>",
    cc: "Andrea Pelletier",
    date: "Tuesday, March 18, 2025, 2:31 PM",
    body: `Hey Daniel,

Thanks for catching this — let me walk through how I had it.

The deal email from Andrea last December said "expenses capped at $2,500, marketing recoup of $900 against gross." I read that as the recoup being a separate deduction off gross, before we apply the 80%, similar to how we handle CC fees. So the math I ran was:

Gross: $19,840
Less CC + platform fees: $1,984
Less marketing recoup: $900
= $16,956

Then expenses ($2,500 cap) applied: $14,456 net.
80% × $14,456 = $11,565.

I can pull up the email Andrea sent if helpful. I don't think I'm reading it wrong but I'm open to hearing how you saw it.

Mariana`,
  },
  entry_daniel_concedes: {
    title: "Re: Settlement — Coastal Spell, March 14",
    kind: "email",
    from: "Daniel Hwang <dhwang@wme.com>",
    to: "Mariana Reyes <mariana@thecrescentnashville.com>",
    cc: "Andrea Pelletier; Coastal Spell Management",
    date: "Tuesday, March 18, 2025, 3:14 PM",
    body: `Mariana,

Andrea is on a flight, but I just talked to her quickly before she boarded. Her read on the deal email is that the $900 marketing recoup was part of the $2,500 expense cap, not separate from it. The intent was that the cap functioned as a ceiling on all venue-charged expenses, marketing included.

I went back to the original December email she sent (forwarding below). Honestly, I think it can be read either way. "Expenses capped at $2,500, marketing recoup of $900 against gross" is ambiguous.

That said: if Andrea's intent on negotiation was that marketing was inside the $2,500, I think we have to settle on her read. The artist agreed to the deal she negotiated.

Can we get to $12,285? Happy to jump on a call.

Daniel`,
  },
  entry_mariana_loops_gm: {
    title: "Re: Settlement — Coastal Spell, March 14",
    kind: "email",
    from: "Mariana Reyes <mariana@thecrescentnashville.com>",
    to: "Daniel Hwang <dhwang@wme.com>",
    cc: "Marcus Holland",
    date: "Tuesday, March 18, 2025, 5:02 PM",
    body: `Daniel,

Looping in our GM Marcus. We don't think the deal email is unambiguous in either direction — neither does our books. Marcus will be in touch shortly.

I want to flag this is the third time we've had a marketing recoup interpretation issue this year, all with WME. Going forward I'd appreciate it if these were called out explicitly in the deal email — "$X marketing recoup, included in expense cap" or "in addition to expense cap."

Mariana`,
  },
  entry_marcus_resolution: {
    title: "Re: Settlement — Coastal Spell, March 14",
    kind: "email",
    from: "Marcus Holland <marcus@thecrescentnashville.com>",
    to: "Daniel Hwang <dhwang@wme.com>",
    cc: "Andrea Pelletier; Mariana Reyes",
    date: "Wednesday, March 19, 2025, 9:14 AM",
    body: `Daniel,

I'll send the additional $720 today. We're going to settle on Andrea's read this time but I want to flag for the record that we don't think it was the only fair reading of the deal. Mariana will follow up with a clarification we'd like included in future deal emails.

Best,
Marcus`,
  },
  entry_gm_approval: {
    title: "Text — Marcus → Mariana",
    kind: "text",
    from: "Marcus Holland",
    to: "Mariana Reyes",
    date: "March 14, 2025, 11:42 PM",
    body: `Mariana: "Settled at $11,565 — TM signed. Ok to wire Monday?"
Marcus: "ok looks good"`,
  },
};

// -----------------------------------------------------------------------------
// Transcript-case coverage matrix — surfaced on /context/audit-trail.
// Each row maps a transcript quote to the trail surface that implements it.
// -----------------------------------------------------------------------------

export type CoverageRow = {
  id: string;
  source: "Mariana" | "Diego" | "Marcus" | "Sarah Kim";
  quote: string;
  surface: string;
  exampleEntryId?: string;
};

export const TRANSCRIPT_COVERAGE: CoverageRow[] = [
  {
    id: "M1",
    source: "Mariana",
    quote:
      "Most of the friction comes from things that were knowable on Wednesday — the hospitality bill is going to run over, or the deal email has a sentence that could mean two different things.",
    surface: "Companion alert + pre-show forecast entries (hospitality, ambiguity)",
    exampleEntryId: "entry_hospitality_forecast",
  },
  {
    id: "M2",
    source: "Mariana",
    quote:
      "I want a paper trail. Right now there's literally no record of what happened in the room when we settled.",
    surface: "Timeline core — every event becomes a row",
    exampleEntryId: "entry_at_table_signoff",
  },
  {
    id: "M6",
    source: "Mariana",
    quote:
      "Every line in my spreadsheet has a sourceable breakdown. The settlement is half about the money, half about the proof.",
    surface: "Evidence chips per entry → click opens source email/text/receipt",
    exampleEntryId: "entry_dispute_opened",
  },
  {
    id: "M7",
    source: "Mariana",
    quote:
      "This is the third marketing-recoup interpretation dispute this year, all with WME.",
    surface: "Companion flag with historical pattern evidence (Why this flag?)",
    exampleEntryId: "entry_companion_flag",
  },
  {
    id: "M8",
    source: "Mariana",
    quote:
      "Pulling expenses together... the hospitality is in receipts that the production manager throws on my desk.",
    surface: "Pre-show flag entry — hospitality forecast to run over cap",
    exampleEntryId: "entry_hospitality_forecast",
  },
  {
    id: "M9",
    source: "Mariana",
    quote:
      "The whiskey ran over but I'm absorbing the difference.",
    surface: "Absorbed-decision entry + amber chip on timeline",
    exampleEntryId: "entry_absorbed_hospitality",
  },
  {
    id: "D1",
    source: "Diego",
    quote:
      "I'd love to be able to pull up the venue's settlement on my phone and look at it.",
    surface: "Share with TM affordance — generates read-only link, opens preview",
  },
  {
    id: "D2",
    source: "Diego",
    quote:
      "If I have to ask 'where did the $14,427 come from' and they explain it from memory for ten minutes, I'm not signing.",
    surface: "Math strip — two readings side-by-side with reasoning visible",
  },
  {
    id: "D3",
    source: "Diego",
    quote:
      "I have an expected range. If the venue's number is in the range, we're fine.",
    surface: "TM expected-number entry — records the back-of-envelope number",
    exampleEntryId: "entry_tm_expected",
  },
  {
    id: "D4",
    source: "Diego",
    quote:
      "I sign it, because the artist needs to load out. Then in the morning I tell the agent.",
    surface: "Sign-off → next-morning dispute chain visible on timeline",
    exampleEntryId: "entry_dispute_opened",
  },
  {
    id: "MK1",
    source: "Marcus",
    quote:
      "Most of them, 30 seconds. I trust Mariana. The ten-minute ones are where the number looks weird.",
    surface: "Hero strip (30s scan) + expand-details (10min deep dive)",
  },
  {
    id: "MK2",
    source: "Marcus",
    quote:
      "If the system gave me real visibility into what I was signing — flagged anything unusual — I'd be more confident.",
    surface: "Companion alert renders only when flags exist — anomaly-first",
    exampleEntryId: "entry_companion_flag",
  },
  {
    id: "MK5",
    source: "Marcus",
    quote:
      "I wish she could see, before a show even happens, whether the deal we agreed to is going to be a clean one or a messy one.",
    surface: "Pre-show flag entries surfaced on the trail Wednesday-onward",
    exampleEntryId: "entry_companion_flag",
  },
  {
    id: "S1",
    source: "Sarah Kim",
    quote:
      "I read the settlement and I can read it in three minutes and not have any questions.",
    surface: "Send to agent — renders compact statement view with visibility filtering",
  },
  {
    id: "S2",
    source: "Sarah Kim",
    quote:
      "There was no canonical version of what the deal was. The deal was a ghost.",
    surface: "Deal_email origin entry + amendment diff strip (one source of truth)",
    exampleEntryId: "entry_deal_email_origin",
  },
  {
    id: "S3",
    source: "Sarah Kim",
    quote:
      "If I could see the settlement before my tour manager signed off — get a preview while they're at the table.",
    surface: "Share-with-TM link extends to agent preview (same shared_agent visibility)",
  },
  {
    id: "S4",
    source: "Sarah Kim",
    quote:
      "I want to trace each line to a source. The CC fees should match the POS. The expenses should tie to actual receipts.",
    surface: "Evidence chips → click opens source content modal",
    exampleEntryId: "entry_deal_email_origin",
  },
  {
    id: "S5",
    source: "Sarah Kim",
    quote:
      "Some statements feel like the venue is showing me their work. Some feel like presenting a fait accompli.",
    surface: "Expand-details reveals reasoning, not just totals — design principle throughout",
  },
];

// Reference: a single audit_log row, shown in the footer panel so reviewers
// see the proposed schema mapping concretely.
export const AUDIT_LOG_ROW_EXAMPLE = {
  id: "log_8c4a...",
  show_id: "show_coastal_spell_dispute",
  occurred_at: "2025-03-14T23:30:00Z",
  actor_id: "user_diego_velasquez",
  actor_kind: "tm",
  kind: "at_table_signoff",
  summary:
    "Signed off on settlement at the table. Payout $11,565. No flags raised in the room.",
  body: null,
  evidence: [],
  field_change: null,
  visibility: "shared_tm",
  companion_flag_id: null,
};

export { SAMPLE_LIGHT };
