"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  AlertTriangle,
  ArrowRight,
  Plus,
  Share2,
  Send,
  Info,
  X,
  Lock,
  Eye,
  ChevronDown,
  Copy,
  Check,
  Mail,
  MessageSquare,
  Phone,
  FileText,
  Receipt,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { PlainBadge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";
import {
  AuditEntry,
  CompanionFlag,
  ShowTrail,
  AUDIT_LOG_ROW_EXAMPLE,
  EVIDENCE_BY_ENTRY,
  EvidenceContent,
  AiSummary,
  SummarySpan,
} from "@/data/audit-trail";
import type { Deal } from "@/db/schema";

type Props = {
  trail: ShowTrail;
  deal: Deal | null;
  finalPayout: number | null;
  initialPayout: number | null;
};

export function TrailClient({ trail, deal, finalPayout, initialPayout }: Props) {
  const [order, setOrder] = useState<"recent" | "story">("recent");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [openFlagModal, setOpenFlagModal] = useState<CompanionFlag | null>(null);
  const [openEvidence, setOpenEvidence] = useState<EvidenceContent | null>(null);
  const [showFabModal, setShowFabModal] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [sendAgentModalOpen, setSendAgentModalOpen] = useState(false);
  const [clarifyModalOpen, setClarifyModalOpen] = useState<CompanionFlag | null>(null);
  const [ackFlags, setAckFlags] = useState<Set<string>>(new Set());
  const [addedEntries, setAddedEntries] = useState<AuditEntry[]>([]);
  const [showSchemaPanel, setShowSchemaPanel] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());

  const jumpToEntry = (entryId: string) => {
    const el = document.getElementById(`entry-${entryId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setExpanded((prev) => new Set(prev).add(entryId));
    setHighlightedIds(new Set([entryId]));
    setTimeout(() => setHighlightedIds(new Set()), 1800);
  };

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  // Keyboard shortcut: ⌘N opens log-entry modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setShowFabModal(true);
      }
      if (e.key === "Escape") {
        setOpenFlagModal(null);
        setOpenEvidence(null);
        setShowFabModal(false);
        setShareModalOpen(false);
        setSendAgentModalOpen(false);
        setClarifyModalOpen(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const allEntries = useMemo(() => {
    const merged = [...trail.entries, ...addedEntries];
    return merged.sort((a, b) =>
      order === "recent"
        ? new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
        : new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
    );
  }, [trail.entries, addedEntries, order]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const showsCalcGap =
    deal?.dealType === "vs" ||
    deal?.dealType === "percentage_of_net" ||
    deal?.dealType === "door";

  const visibleFlags = trail.companionFlags.filter(
    (f) => !ackFlags.has(f.id) && f.status !== "resolved",
  );
  const acknowledgedFlags = trail.companionFlags.filter((f) =>
    ackFlags.has(f.id),
  );

  return (
    <>
      {/* Companion alerts */}
      {visibleFlags.map((flag) => (
        <CompanionAlert
          key={flag.id}
          flag={flag}
          onWhy={() => setOpenFlagModal(flag)}
          onClarify={() => setClarifyModalOpen(flag)}
          onAcknowledge={() => {
            setAckFlags((s) => new Set(s).add(flag.id));
            setToast("Flag acknowledged");
          }}
        />
      ))}

      {acknowledgedFlags.length > 0 && (
        <div className="my-4 flex items-center gap-2 text-[11.5px] text-ink-500">
          <Check className="h-3 w-3 text-brand-700" />
          {acknowledgedFlags.length} flag
          {acknowledgedFlags.length === 1 ? "" : "s"} acknowledged ·{" "}
          <button
            onClick={() => setAckFlags(new Set())}
            className="text-brand-700 hover:underline"
          >
            show again
          </button>
        </div>
      )}

      {/* AI summary — readable state view on top of the ledger. Per memo:
          "strictly assistive — when summary and ledger disagree, the ledger
          governs, and the product says so." */}
      {trail.aiSummary && (
        <AiSummaryCard
          summary={trail.aiSummary}
          ledgerSize={trail.entries.length}
          onJump={jumpToEntry}
        />
      )}

      {/* Math strip for unsupported deal types */}
      {showsCalcGap && initialPayout != null && finalPayout != null && (
        <MathStrip
          dealType={deal!.dealType}
          initial={initialPayout}
          final={finalPayout}
        />
      )}

      {/* Pre-show diff */}
      {trail.dealDiff.length > 0 && <DealDiffStrip diff={trail.dealDiff} />}

      {/* Section header + controls */}
      <div className="mt-10 mb-4 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">
            Full trail
          </div>
          <div className="text-[12px] text-ink-400 mt-1">
            {allEntries.length} entries · viewing as booker
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {trail.affordances.shareWithTm && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShareModalOpen(true)}
            >
              <Share2 className="h-3.5 w-3.5" /> Share with TM
            </Button>
          )}
          {trail.affordances.sendToAgent && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSendAgentModalOpen(true)}
            >
              <Send className="h-3.5 w-3.5" /> Send to agent
            </Button>
          )}
          <div className="inline-flex rounded-lg ring-1 ring-ink-200/80 bg-white p-0.5">
            <OrderTab
              active={order === "recent"}
              onClick={() => setOrder("recent")}
            >
              Recent first
            </OrderTab>
            <OrderTab
              active={order === "story"}
              onClick={() => setOrder("story")}
            >
              Story mode
            </OrderTab>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        <div
          aria-hidden
          className="absolute left-[14px] top-3 bottom-3 w-px bg-ink-200"
        />
        {allEntries.map((entry) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            expanded={expanded.has(entry.id)}
            highlighted={highlightedIds.has(entry.id)}
            onToggle={() => toggleExpand(entry.id)}
            onOpenEvidence={(content) => setOpenEvidence(content)}
          />
        ))}
      </div>

      {/* Schema reference footer */}
      <div className="mt-16 border-t border-ink-200/60 pt-6">
        <button
          onClick={() => setShowSchemaPanel((v) => !v)}
          className="inline-flex items-center gap-1.5 text-[11px] text-ink-500 hover:text-ink-900 transition-colors"
        >
          <Info className="h-3 w-3" />
          {showSchemaPanel ? "Hide" : "Show"} proposed{" "}
          <code className="font-mono bg-canvas-soft px-1 ring-1 ring-ink-200/80 rounded">
            audit_log
          </code>{" "}
          row shape
          <ChevronDown
            className={`h-3 w-3 transition-transform ${showSchemaPanel ? "rotate-180" : ""}`}
          />
        </button>
        {showSchemaPanel && (
          <div className="mt-3 rounded-lg ring-1 ring-ink-200/80 bg-canvas-soft p-4">
            <p className="text-[11px] text-ink-500 mb-3 leading-relaxed">
              Each timeline entry maps to one row. In the v3 memo we propose
              this table as the canonical write-path; the trail UI renders it.
              Prototype reads from a static TS file — no data layer wired yet.
            </p>
            <pre className="text-[11px] font-mono text-ink-700 overflow-x-auto leading-relaxed">
{JSON.stringify(AUDIT_LOG_ROW_EXAMPLE, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowFabModal(true)}
        className="fixed bottom-8 right-10 z-40 inline-flex items-center gap-2 rounded-full bg-brand-700 hover:bg-brand-800 text-white px-5 py-3 text-[13px] font-medium shadow-lg shadow-brand-700/25 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Log entry
        <span className="ml-1 pl-2 border-l border-white/25 text-[11px] font-mono opacity-75">
          ⌘N
        </span>
      </button>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 right-10 z-50 rounded-lg bg-ink-900 text-white px-4 py-2.5 text-[12.5px] shadow-xl animate-in fade-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}

      {/* Modals */}
      {openFlagModal && (
        <FlagModal
          flag={openFlagModal}
          onClose={() => setOpenFlagModal(null)}
        />
      )}
      {openEvidence && (
        <EvidenceModal
          content={openEvidence}
          onClose={() => setOpenEvidence(null)}
        />
      )}
      {showFabModal && (
        <LogEntryModal
          onClose={() => setShowFabModal(false)}
          onSave={(entry) => {
            setAddedEntries((arr) => [...arr, entry]);
            setShowFabModal(false);
            setToast("Entry logged to trail");
          }}
        />
      )}
      {shareModalOpen && (
        <ShareWithTmModal
          showId={trail.showId}
          onClose={() => setShareModalOpen(false)}
          onSent={() => {
            setShareModalOpen(false);
            setAddedEntries((arr) => [
              ...arr,
              {
                id: `entry_share_${Date.now()}`,
                occurredAt: new Date().toISOString(),
                actorName: "Mariana Reyes",
                actorRole: "booker · shared",
                actorKind: "booker",
                kind: "private_note",
                summary:
                  "Shared trail link with tour manager (read-only). Link expires in 48h.",
                visibility: "internal",
              },
            ]);
            setToast("Share link copied · entry logged");
          }}
        />
      )}
      {sendAgentModalOpen && (
        <SendToAgentModal
          trail={trail}
          finalPayout={finalPayout}
          onClose={() => setSendAgentModalOpen(false)}
          onSent={() => {
            setSendAgentModalOpen(false);
            setAddedEntries((arr) => [
              ...arr,
              {
                id: `entry_send_${Date.now()}`,
                occurredAt: new Date().toISOString(),
                actorName: "Mariana Reyes",
                actorRole: "booker · sent statement",
                actorKind: "booker",
                kind: "dispute_message",
                summary:
                  "Sent settlement statement to agent (PDF view + trail link).",
                visibility: "shared_agent",
              },
            ]);
            setToast("Statement sent to agent · entry logged");
          }}
        />
      )}
      {clarifyModalOpen && (
        <ClarifyWithAgentModal
          flag={clarifyModalOpen}
          onClose={() => setClarifyModalOpen(null)}
          onSent={(_email) => {
            setClarifyModalOpen(null);
            setAckFlags((s) => new Set(s).add(clarifyModalOpen.id));
            setAddedEntries((arr) => [
              ...arr,
              {
                id: `entry_clarify_${Date.now()}`,
                occurredAt: new Date().toISOString(),
                actorName: "Mariana Reyes",
                actorRole: "booker · clarification sent",
                actorKind: "booker",
                kind: "dispute_message",
                summary:
                  "Sent clarification email to agent re ambiguous recoup phrasing. Awaiting written confirmation.",
                visibility: "shared_agent",
              },
            ]);
            setToast("Clarification sent · flag resolved · entry logged");
          }}
        />
      )}
    </>
  );
}

// ─── Companion alert ─────────────────────────────────────────────────────

function CompanionAlert({
  flag,
  onWhy,
  onClarify,
  onAcknowledge,
}: {
  flag: CompanionFlag;
  onWhy: () => void;
  onClarify: () => void;
  onAcknowledge: () => void;
}) {
  return (
    <div className="my-6 rounded-xl bg-amber-50/60 ring-1 ring-amber-200/70 p-5 flex gap-3">
      <AlertTriangle className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-800 mb-1.5">
          Companion · {flag.title.toLowerCase()}
        </div>
        <p className="text-[13px] text-ink-800 leading-relaxed">{flag.body}</p>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <Button variant="brand" size="sm" onClick={onClarify}>
            Clarify with agent
          </Button>
          <Button variant="secondary" size="sm" onClick={onAcknowledge}>
            Acknowledge
          </Button>
          <button
            onClick={onWhy}
            className="text-[12px] text-ink-500 hover:text-ink-900 px-2 underline-offset-2 hover:underline"
          >
            Why this flag?
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AI summary ───────────────────────────────────────────────────────────

function AiSummaryCard({
  summary,
  ledgerSize,
  onJump,
}: {
  summary: AiSummary;
  ledgerSize: number;
  onJump: (entryId: string) => void;
}) {
  const uniqueSources = new Set<string>();
  summary.parts.forEach((p) => {
    if (typeof p !== "string") p.sources.forEach((s) => uniqueSources.add(s));
  });

  return (
    <div className="my-6 rounded-xl ring-1 ring-brand-200/50 bg-gradient-to-b from-brand-50/40 to-white p-5">
      <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-700 mb-3">
        <Sparkles className="h-3 w-3" />
        AI summary · current state
      </div>
      <p
        className="font-display text-[16.5px] leading-[1.55] text-ink-800 m-0"
        style={{ fontStyle: "italic", letterSpacing: "-0.005em" }}
      >
        {summary.parts.map((part, i) =>
          typeof part === "string" ? (
            <span key={i}>{part}</span>
          ) : (
            <SourceSpan key={i} span={part} onJump={onJump} />
          ),
        )}
      </p>
      <div className="mt-4 pt-3 border-t border-brand-200/50 flex items-center justify-between text-[11px] text-ink-500 flex-wrap gap-2">
        <span>
          Generated from {ledgerSize} ledger entries · {uniqueSources.size}{" "}
          sources cited ·{" "}
          <span className="text-ink-700 font-medium">
            ledger governs when summary disagrees
          </span>
        </span>
        <span className="text-ink-400 font-mono tabular text-[10px]">
          {format(parseISO(summary.generatedAt), "MMM d, h:mm a")}
        </span>
      </div>
    </div>
  );
}

function SourceSpan({
  span,
  onJump,
}: {
  span: SummarySpan;
  onJump: (entryId: string) => void;
}) {
  return (
    <button
      onClick={() => span.sources[0] && onJump(span.sources[0])}
      className="font-medium text-ink-900 not-italic border-b border-dashed border-brand-300 hover:border-brand-700 hover:bg-brand-50/60 px-0.5 rounded-sm transition-colors cursor-pointer"
      title={`Source: entry ${span.sources.join(", ")} — click to jump to ledger`}
    >
      {span.text}
    </button>
  );
}

// ─── Math strip ───────────────────────────────────────────────────────────

function MathStrip({
  dealType,
  initial,
  final,
}: {
  dealType: string;
  initial: number;
  final: number;
}) {
  return (
    <div className="my-6 rounded-xl bg-white ring-1 ring-ink-200/80 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-500">
            Two readings of the math
          </div>
          <div className="text-[12px] text-ink-400 mt-1">
            Greenroom calc doesn’t support{" "}
            <code className="font-mono text-ink-700 bg-canvas-soft px-1 rounded">
              {dealType}
            </code>{" "}
            deals — these come from email math, not the engine.
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <ReadingCard
          label="Venue’s read"
          subtitle="recoup off gross, then cap"
          amount={initial}
          tone="ink"
        />
        <ReadingCard
          label="Settled read"
          subtitle="recoup inside cap"
          amount={final}
          tone="brand"
        />
      </div>
      <div className="text-[11px] text-ink-400 mt-3 leading-relaxed">
        Diff:{" "}
        <span className="text-ink-700 font-medium tabular">
          {formatMoney(final - initial)}
        </span>{" "}
        — venue absorbed the difference. See timeline below for the deal-email
        language that produced both reads.
      </div>
    </div>
  );
}

function ReadingCard({
  label,
  subtitle,
  amount,
  tone,
}: {
  label: string;
  subtitle: string;
  amount: number;
  tone: "ink" | "brand";
}) {
  return (
    <div
      className={`rounded-lg p-4 ring-1 ${
        tone === "brand"
          ? "ring-brand-200/70 bg-brand-50/30"
          : "ring-ink-200/70 bg-canvas-soft"
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-500">
        {label}
      </div>
      <div className="text-[11px] text-ink-400 mt-0.5">{subtitle}</div>
      <div
        className={`mt-2 text-[22px] font-semibold tabular leading-none ${
          tone === "brand" ? "text-brand-700" : "text-ink-900"
        }`}
      >
        {formatMoney(amount)}
      </div>
    </div>
  );
}

// ─── Pre-show diff ────────────────────────────────────────────────────────

function DealDiffStrip({
  diff,
}: {
  diff: {
    field: string;
    before: string;
    after: string;
    source: string;
    warning?: string;
  }[];
}) {
  return (
    <div className="my-6 rounded-xl bg-white ring-1 ring-ink-200/80 overflow-hidden">
      <div className="px-5 py-3 border-b border-ink-200/60 flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold text-ink-900">
            What changed since the deal was signed
          </div>
          <div className="text-[11px] text-ink-400 mt-0.5">
            Booker should review before walking into settlement.
          </div>
        </div>
        <PlainBadge>
          {diff.length} amendment{diff.length === 1 ? "" : "s"}
        </PlainBadge>
      </div>
      <div>
        {diff.map((d, i) => (
          <div
            key={i}
            className={`px-5 py-3 grid grid-cols-[160px_1fr_auto] items-center gap-4 text-[12.5px] ${i > 0 ? "border-t border-ink-100" : ""}`}
          >
            <div className="text-ink-500 font-medium">{d.field}</div>
            <div className="font-mono tabular text-[12px]">
              {d.before !== "—" && (
                <span className="text-rose-700 line-through opacity-75">
                  {d.before}
                </span>
              )}
              {d.before !== "—" && <span className="mx-2 text-ink-300">→</span>}
              <span
                className={`font-semibold ${d.warning ? "text-amber-700" : "text-brand-700"}`}
              >
                {d.after}
              </span>
            </div>
            <div className="text-[11px] text-ink-400">{d.source}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Entry row ────────────────────────────────────────────────────────────

const dotStyle: Record<string, { ring: string; bg: string }> = {
  brand: {
    ring: "shadow-[0_0_0_2px_var(--color-brand-500),0_0_0_4px_var(--color-canvas)]",
    bg: "bg-brand-50",
  },
  amber: {
    ring: "shadow-[0_0_0_2px_var(--color-amber-700),0_0_0_4px_var(--color-canvas)]",
    bg: "bg-amber-50",
  },
  rose: {
    ring: "shadow-[0_0_0_2px_var(--color-rose-700),0_0_0_4px_var(--color-canvas)]",
    bg: "bg-rose-50",
  },
  plain: {
    ring: "shadow-[0_0_0_2px_var(--color-ink-300),0_0_0_4px_var(--color-canvas)]",
    bg: "bg-white",
  },
};

function dotToneFor(kind: AuditEntry["kind"]): keyof typeof dotStyle {
  switch (kind) {
    case "at_table_signoff":
    case "gm_approval":
    case "dispute_resolution":
      return "brand";
    case "pre_show_flag":
      return "amber";
    case "agent_dispute_opened":
    case "private_note":
      return "rose";
    default:
      return "plain";
  }
}

function actorAvatar(actorKind: string) {
  const tones: Record<string, string> = {
    booker: "bg-[#f4ecf7] text-[#7c5a8c] ring-[#d9c4e3]",
    agent: "bg-[#fce7eb] text-rose-800 ring-[#f1c4cf]",
    tm: "bg-brand-50 text-brand-800 ring-brand-200",
    gm: "bg-amber-50 text-amber-800 ring-amber-200",
    companion: "bg-amber-50 text-amber-800 ring-amber-200",
    external: "bg-ink-100 text-ink-700 ring-ink-200",
  };
  return tones[actorKind] ?? tones.external;
}

function evidenceIcon(kind: string) {
  const map: Record<string, React.ComponentType<{ className?: string }>> = {
    email: Mail,
    text: MessageSquare,
    verbal: Phone,
    doc: FileText,
    pos: Receipt,
    receipt: Receipt,
  };
  return map[kind] ?? FileText;
}

function EntryRow({
  entry,
  expanded,
  highlighted,
  onToggle,
  onOpenEvidence,
}: {
  entry: AuditEntry;
  expanded: boolean;
  highlighted: boolean;
  onToggle: () => void;
  onOpenEvidence: (c: EvidenceContent) => void;
}) {
  const dot = dotStyle[dotToneFor(entry.kind)];
  const time = format(parseISO(entry.occurredAt), "MMM d · h:mm a");
  const initials = entry.actorName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  const evidenceContent = EVIDENCE_BY_ENTRY[entry.id];

  const hasDetails =
    entry.body || entry.evidence?.length || entry.fieldChange;

  return (
    <div id={`entry-${entry.id}`} className="relative pl-11 pb-4 scroll-mt-32">
      <div
        className={`absolute left-2 top-4 h-3.5 w-3.5 rounded-full ${dot.bg} ${dot.ring}`}
      />
      <div
        className={`rounded-xl bg-white ring-1 p-4 transition-all duration-500 ${
          highlighted
            ? "ring-2 ring-brand-500 bg-brand-50/40 shadow-lg shadow-brand-700/10"
            : expanded
              ? "ring-brand-200/70 bg-gradient-to-b from-brand-50/15 to-white"
              : "ring-ink-200/60 hover:ring-ink-300"
        }`}
      >
        <div className="flex items-center gap-3 mb-1.5">
          <div
            className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold ring-1 ${actorAvatar(entry.actorKind)}`}
          >
            {entry.actorKind === "companion" ? "✦" : initials}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[13px] font-semibold text-ink-900">
              {entry.actorName}
            </span>
            <span className="text-[11px] text-ink-400 ml-1.5">
              {entry.actorRole}
            </span>
          </div>
          <span className="text-[11px] text-ink-400 font-mono tabular shrink-0">
            {time}
          </span>
        </div>
        <p className="text-[13px] text-ink-800 leading-[1.55] m-0">
          {entry.summary}
        </p>

        <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
          <VisibilityChip visibility={entry.visibility} />
          {entry.fieldChange && (
            <Chip tone="delta">
              <span className="font-mono text-[10.5px]">
                {entry.fieldChange.field}
              </span>
              {entry.fieldChange.before != null && (
                <>
                  : <span className="line-through opacity-60">
                    {formatFieldValue(entry.fieldChange.before)}
                  </span>
                  <ArrowRight className="h-3 w-3 mx-0.5" />
                </>
              )}
              <span className="font-medium">
                {formatFieldValue(entry.fieldChange.after ?? "—")}
              </span>
            </Chip>
          )}
          {entry.evidence?.map((ev, i) => {
            const Icon = evidenceIcon(ev.kind);
            const clickable = !!evidenceContent;
            return (
              <button
                key={i}
                onClick={() => clickable && onOpenEvidence(evidenceContent)}
                disabled={!clickable}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11.5px] ring-1 ring-inset ${
                  clickable
                    ? "bg-white text-ink-700 ring-ink-200 hover:ring-brand-300 hover:text-brand-700 cursor-pointer"
                    : "bg-white text-ink-500 ring-ink-200 cursor-default"
                }`}
              >
                <Icon className="h-3 w-3" />
                {ev.label}
              </button>
            );
          })}
          {entry.kind === "agent_dispute_opened" && (
            <Chip tone="rose">dispute opened</Chip>
          )}
          {entry.kind === "dispute_resolution" && (
            <Chip tone="brand">dispute resolved</Chip>
          )}
          {entry.kind === "absorbed_decision" && (
            <Chip tone="amber">absorbed by venue</Chip>
          )}
          {entry.payoutAtMoment != null && (
            <Chip tone="delta">
              payout {formatMoney(entry.payoutAtMoment)}
            </Chip>
          )}
          {hasDetails && (
            <button
              onClick={onToggle}
              className="ml-auto text-[11px] text-ink-500 hover:text-ink-900 px-2 py-1 rounded hover:bg-ink-100 transition-colors"
            >
              {expanded ? "Hide" : "Show"} details
            </button>
          )}
        </div>

        {expanded && hasDetails && (
          <div className="mt-3 pt-3 border-t border-dashed border-ink-200">
            {entry.body && (
              <div className="grid grid-cols-[88px_1fr] gap-3 py-1.5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400 pt-0.5">
                  Detail
                </div>
                <div className="text-[13px] text-ink-700 italic leading-[1.55]">
                  {entry.body}
                </div>
              </div>
            )}
            {entry.historyRefs && entry.historyRefs.length > 0 && (
              <div className="grid grid-cols-[88px_1fr] gap-3 py-1.5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400 pt-0.5">
                  History
                </div>
                <div className="text-[12px] text-ink-700 leading-[1.6]">
                  Matched {entry.historyRefs.length} prior entries in the
                  recurring-pattern index.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatFieldValue(v: string | number) {
  if (typeof v === "number") {
    if (Math.abs(v) >= 100) return formatMoney(v);
    return String(v);
  }
  return v;
}

// ─── Chips ────────────────────────────────────────────────────────────────

function Chip({
  tone = "default",
  children,
}: {
  tone?: "default" | "delta" | "rose" | "brand" | "amber";
  children: React.ReactNode;
}) {
  const styles: Record<string, string> = {
    default: "bg-ink-50 text-ink-700 ring-ink-200/70",
    delta:
      "bg-canvas-soft text-ink-700 ring-ink-200/80 font-mono tabular text-[11px]",
    rose: "bg-rose-50 text-rose-800 ring-rose-200/70",
    brand: "bg-brand-50 text-brand-800 ring-brand-200/70",
    amber: "bg-amber-50 text-amber-800 ring-amber-200/70",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11.5px] ring-1 ring-inset ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

function VisibilityChip({
  visibility,
}: {
  visibility: AuditEntry["visibility"];
}) {
  if (visibility === "private")
    return (
      <Chip tone="default">
        <Lock className="h-3 w-3" /> private
      </Chip>
    );
  if (visibility === "shared_tm")
    return (
      <Chip tone="default">
        <Eye className="h-3 w-3" /> visible to TM
      </Chip>
    );
  if (visibility === "shared_agent")
    return (
      <Chip tone="default">
        <Eye className="h-3 w-3" /> visible to agent
      </Chip>
    );
  return (
    <Chip tone="default">
      <Eye className="h-3 w-3" /> internal
    </Chip>
  );
}

function OrderTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
        active ? "bg-ink-900 text-white" : "text-ink-600 hover:text-ink-900"
      }`}
    >
      {children}
    </button>
  );
}

// ─── Modal shell ──────────────────────────────────────────────────────────

function ModalShell({
  onClose,
  children,
  maxWidth = "max-w-xl",
}: {
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/30 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl ring-1 ring-ink-200 ${maxWidth} w-full max-h-[85vh] overflow-y-auto shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function ModalHeader({
  title,
  eyebrow,
  onClose,
}: {
  title: string;
  eyebrow?: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="px-6 py-5 border-b border-ink-200/60 flex items-start justify-between sticky top-0 bg-white z-10">
      <div>
        {eyebrow && <div className="mb-1.5">{eyebrow}</div>}
        <h3 className="text-[18px] font-semibold text-ink-900">{title}</h3>
      </div>
      <button
        onClick={onClose}
        className="p-1.5 hover:bg-ink-100 rounded-md transition-colors"
      >
        <X className="h-4 w-4 text-ink-500" />
      </button>
    </div>
  );
}

// ─── Flag modal ───────────────────────────────────────────────────────────

function FlagModal({
  flag,
  onClose,
}: {
  flag: CompanionFlag;
  onClose: () => void;
}) {
  return (
    <ModalShell onClose={onClose}>
      <ModalHeader
        title={flag.title}
        eyebrow={
          <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-800">
            <Sparkles className="h-3 w-3" /> Companion · why this flag
          </div>
        }
        onClose={onClose}
      />
      <div className="px-6 py-5">
        <p className="text-[13px] text-ink-700 leading-relaxed mb-4">
          {flag.body}
        </p>
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-500 mb-2.5">
          Pattern evidence
        </div>
        <div className="space-y-2">
          {flag.historyRefs.map((ref, i) => (
            <div
              key={i}
              className="rounded-lg bg-canvas-soft ring-1 ring-ink-200/70 px-3 py-2.5 text-[12.5px] flex items-center justify-between gap-3"
            >
              <span className="text-ink-800 font-medium">{ref.showName}</span>
              <span className="text-ink-500 text-[11.5px] text-right">
                {ref.outcome}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-5 pt-4 border-t border-ink-200/60 text-[11px] text-ink-400 leading-relaxed">
          Real implementation queries{" "}
          <code className="font-mono bg-canvas-soft px-1 rounded">
            audit_log
          </code>{" "}
          for entries matching the deal-language fingerprint. Prototype
          references are static.
        </div>
      </div>
    </ModalShell>
  );
}

// ─── Evidence modal ───────────────────────────────────────────────────────

function EvidenceModal({
  content,
  onClose,
}: {
  content: EvidenceContent;
  onClose: () => void;
}) {
  const Icon = evidenceIcon(content.kind);
  return (
    <ModalShell onClose={onClose} maxWidth="max-w-2xl">
      <ModalHeader
        title={content.title}
        eyebrow={
          <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-500">
            <Icon className="h-3 w-3" /> Source · {content.kind}
          </div>
        }
        onClose={onClose}
      />
      <div className="px-6 py-5">
        {(content.from || content.to || content.date) && (
          <div className="rounded-lg bg-canvas-soft ring-1 ring-ink-200/70 px-4 py-3 mb-4 text-[12px] text-ink-700 space-y-1">
            {content.from && (
              <div>
                <span className="text-ink-400">From:</span> {content.from}
              </div>
            )}
            {content.to && (
              <div>
                <span className="text-ink-400">To:</span> {content.to}
              </div>
            )}
            {content.cc && (
              <div>
                <span className="text-ink-400">Cc:</span> {content.cc}
              </div>
            )}
            {content.date && (
              <div>
                <span className="text-ink-400">Date:</span> {content.date}
              </div>
            )}
          </div>
        )}
        <pre className="whitespace-pre-wrap text-[13px] text-ink-800 leading-[1.65] font-sans">
{content.body}
        </pre>
      </div>
    </ModalShell>
  );
}

// ─── Log entry modal ──────────────────────────────────────────────────────

function LogEntryModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (entry: AuditEntry) => void;
}) {
  const [text, setText] = useState("");
  const [visibility, setVisibility] = useState<AuditEntry["visibility"]>(
    "private",
  );
  const ref = useRef<HTMLTextAreaElement>(null);
  const canSave = text.trim().length > 0;

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const submit = () => {
    if (!canSave) return;
    onSave({
      id: `entry_user_${Date.now()}`,
      occurredAt: new Date().toISOString(),
      actorName: "Mariana Reyes",
      actorRole: `booker · ${visibility === "private" ? "private note" : "logged"}`,
      actorKind: "booker",
      kind: visibility === "private" ? "private_note" : "dispute_message",
      summary: text.trim(),
      visibility,
    });
  };

  return (
    <ModalShell onClose={onClose}>
      <ModalHeader title="Log a trail entry" onClose={onClose} />
      <div className="px-6 py-5">
        <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-500 mb-1.5">
          What happened?
        </label>
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
          placeholder="e.g. Andrea agreed by phone to push set time 15 min later. No email yet."
          rows={4}
          className="w-full rounded-lg ring-1 ring-ink-200 px-3 py-2.5 text-[13px] text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-700 resize-none"
        />
        <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-500 mt-4 mb-1.5">
          Visibility
        </label>
        <div className="flex gap-2 flex-wrap">
          {(["private", "internal", "shared_tm", "shared_agent"] as const).map(
            (v) => (
              <button
                key={v}
                onClick={() => setVisibility(v)}
                className={`px-3 py-1.5 rounded-full text-[11.5px] ring-1 ring-inset ${
                  visibility === v
                    ? "bg-ink-900 text-white ring-ink-900"
                    : "bg-white text-ink-700 ring-ink-200 hover:ring-ink-300"
                }`}
              >
                {v.replace("_", " ")}
              </button>
            ),
          )}
        </div>
        <p className="text-[11px] text-ink-400 mt-4 leading-relaxed">
          Saves to the current session — prototype does not persist entries
          across reloads. <kbd className="font-mono bg-canvas-soft px-1 rounded">⌘↵</kbd> to save.
        </p>
      </div>
      <div className="px-6 py-4 border-t border-ink-200/60 flex justify-end gap-2 bg-canvas-soft rounded-b-2xl sticky bottom-0">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="brand" size="sm" disabled={!canSave} onClick={submit}>
          Log entry
        </Button>
      </div>
    </ModalShell>
  );
}

// ─── Share-with-TM modal ──────────────────────────────────────────────────

function ShareWithTmModal({
  showId,
  onClose,
  onSent,
}: {
  showId: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const link = `https://greenroom.app/shared/tm/${showId.slice(-12)}-x9k2`;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(true);
    }
  };

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-2xl">
      <ModalHeader
        title="Share trail with tour manager"
        eyebrow={
          <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-500">
            <Share2 className="h-3 w-3" /> Read-only · 48h expiry
          </div>
        }
        onClose={onClose}
      />
      <div className="px-6 py-5">
        <p className="text-[13px] text-ink-700 leading-relaxed mb-4">
          Generates a phone-friendly read-only view the TM can open before
          walking into settlement. Shows entries marked{" "}
          <code className="font-mono bg-canvas-soft px-1 rounded">shared_tm</code>{" "}
          or{" "}
          <code className="font-mono bg-canvas-soft px-1 rounded">
            shared_agent
          </code>
          . Private and internal entries stay hidden.
        </p>
        <div className="flex items-center gap-2 mb-5">
          <input
            value={link}
            readOnly
            className="flex-1 rounded-lg ring-1 ring-ink-200 px-3 py-2 text-[12px] font-mono text-ink-800 bg-canvas-soft"
          />
          <Button variant="secondary" size="sm" onClick={copy}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-500 mb-2">
          TM sees (preview)
        </div>
        <div className="rounded-lg bg-canvas-soft ring-1 ring-ink-200/70 p-4">
          <div className="text-[15px] font-semibold text-ink-900 mb-1">
            Coastal Spell — March 14
          </div>
          <div className="text-[11px] text-ink-500 mb-3">
            Read-only · provided by The Crescent
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="rounded bg-white p-2.5 ring-1 ring-ink-200/60">
              <div className="text-[9px] font-semibold uppercase tracking-wide text-ink-400">
                Final payout
              </div>
              <div className="text-[16px] font-semibold tabular text-brand-700 mt-0.5">
                $12,285
              </div>
            </div>
            <div className="rounded bg-white p-2.5 ring-1 ring-ink-200/60">
              <div className="text-[9px] font-semibold uppercase tracking-wide text-ink-400">
                Entries shared
              </div>
              <div className="text-[16px] font-semibold tabular text-ink-900 mt-0.5">
                9 of 15
              </div>
            </div>
          </div>
          <div className="text-[11px] text-ink-500 leading-relaxed">
            6 internal/private entries hidden (booker notes, GM text, Companion
            internals).
          </div>
        </div>
      </div>
      <div className="px-6 py-4 border-t border-ink-200/60 flex justify-end gap-2 bg-canvas-soft rounded-b-2xl">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="brand" size="sm" onClick={onSent}>
          <Share2 className="h-3.5 w-3.5" />
          Generate & copy link
        </Button>
      </div>
    </ModalShell>
  );
}

// ─── Send-to-agent modal ──────────────────────────────────────────────────

function SendToAgentModal({
  trail,
  finalPayout,
  onClose,
  onSent,
}: {
  trail: ShowTrail;
  finalPayout: number | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const agentVisible = trail.entries.filter(
    (e) => e.visibility === "shared_agent",
  );
  return (
    <ModalShell onClose={onClose} maxWidth="max-w-2xl">
      <ModalHeader
        title="Send settlement statement to agent"
        eyebrow={
          <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-500">
            <Send className="h-3 w-3" /> Email + trail link
          </div>
        }
        onClose={onClose}
      />
      <div className="px-6 py-5">
        <p className="text-[13px] text-ink-700 leading-relaxed mb-4">
          Renders a compact statement showing only entries marked{" "}
          <code className="font-mono bg-canvas-soft px-1 rounded">
            shared_agent
          </code>{" "}
          and emails it to Andrea Pelletier (WME) with a trail link.
        </p>

        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-500 mb-2">
          Statement preview
        </div>
        <div className="rounded-lg bg-canvas-soft ring-1 ring-ink-200/70 p-4 mb-4">
          <div className="font-display text-[20px] font-medium text-ink-900 mb-1">
            Settlement — Coastal Spell
          </div>
          <div className="text-[11px] text-ink-500 mb-3">
            March 14, 2025 · The Crescent
          </div>
          <div className="flex gap-6 mb-3">
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-wide text-ink-400">
                Final payout
              </div>
              <div className="text-[18px] font-semibold tabular text-brand-700">
                {formatMoney(finalPayout ?? 0)}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-wide text-ink-400">
                Shared entries
              </div>
              <div className="text-[18px] font-semibold tabular text-ink-900">
                {agentVisible.length}
              </div>
            </div>
          </div>
          <div className="text-[11px] text-ink-500 leading-relaxed">
            Includes: deal origin, amendments, dispute thread, resolution.
            Internal notes, GM texts, and booker private reflections are
            filtered out.
          </div>
        </div>

        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-500 mb-2">
          Email preview
        </div>
        <div className="rounded-lg ring-1 ring-ink-200/70 p-4 text-[12.5px] text-ink-700 leading-relaxed font-sans bg-white">
          <div className="text-[11px] text-ink-500 mb-2">
            To: apelletier@wme.com · cc: dhwang@wme.com
          </div>
          <div className="border-t border-ink-100 pt-2">
            Hi Andrea,
            <br />
            <br />
            Settlement statement for Coastal Spell (March 14) attached.
            Final payout {formatMoney(finalPayout ?? 0)} reflects the resolved
            dispute on marketing recoup treatment. Full audit trail viewable
            here:{" "}
            <span className="text-brand-700">
              greenroom.app/shared/agent/...
            </span>
            <br />
            <br />— Mariana
          </div>
        </div>
      </div>
      <div className="px-6 py-4 border-t border-ink-200/60 flex justify-end gap-2 bg-canvas-soft rounded-b-2xl">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="brand" size="sm" onClick={onSent}>
          <Send className="h-3.5 w-3.5" />
          Send statement
        </Button>
      </div>
    </ModalShell>
  );
}

// ─── Clarify-with-agent modal ─────────────────────────────────────────────

function ClarifyWithAgentModal({
  flag,
  onClose,
  onSent,
}: {
  flag: CompanionFlag;
  onClose: () => void;
  onSent: (email: string) => void;
}) {
  const defaultDraft = `Hi Andrea,

Quick clarification before settlement on the Coastal Spell deal language. The line "marketing recoup of $900 against gross" can be read two ways:

  (a) recoup sits inside the $2,500 expense cap, or
  (b) recoup is a separate deduction off gross, outside the cap

Could you confirm which read matches your intent so we can lock it in writing before show day? This same phrasing has produced disputes on three prior WME shows here, so I'd like to get it down explicitly going forward.

Thanks,
Mariana`;
  const [draft, setDraft] = useState(defaultDraft);

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-2xl">
      <ModalHeader
        title={`Clarify: ${flag.title.toLowerCase()}`}
        eyebrow={
          <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-800">
            <Mail className="h-3 w-3" /> Pre-emptive email · before show
          </div>
        }
        onClose={onClose}
      />
      <div className="px-6 py-5">
        <p className="text-[12.5px] text-ink-700 leading-relaxed mb-4">
          Email Andrea (WME) for explicit confirmation before settlement. Draft
          generated from the flag context; edit freely.
        </p>
        <div className="rounded-lg bg-canvas-soft ring-1 ring-ink-200/70 px-4 py-3 mb-3 text-[12px] text-ink-700 space-y-1">
          <div>
            <span className="text-ink-400">To:</span> apelletier@wme.com
          </div>
          <div>
            <span className="text-ink-400">Cc:</span> marcus@thecrescentnashville.com
          </div>
          <div>
            <span className="text-ink-400">Subject:</span> Clarification — Coastal Spell deal language (marketing recoup)
          </div>
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={12}
          className="w-full rounded-lg ring-1 ring-ink-200 px-3 py-2.5 text-[12.5px] text-ink-900 font-sans leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-700 resize-none"
        />
        <p className="text-[11px] text-ink-400 mt-3 leading-relaxed">
          On send: this email is recorded as a trail entry, the flag marked
          resolved, and Andrea’s reply will be auto-attached when it arrives.
        </p>
      </div>
      <div className="px-6 py-4 border-t border-ink-200/60 flex justify-end gap-2 bg-canvas-soft rounded-b-2xl">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="brand" size="sm" onClick={() => onSent(draft)}>
          <Send className="h-3.5 w-3.5" /> Send clarification
        </Button>
      </div>
    </ModalShell>
  );
}
