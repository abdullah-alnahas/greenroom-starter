import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Quote,
  Sparkles,
  History,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PlainBadge } from "@/components/ui/badge";
import { TRANSCRIPT_COVERAGE, CoverageRow } from "@/data/audit-trail";

const sourceTone: Record<
  CoverageRow["source"],
  { ring: string; bg: string; fg: string }
> = {
  Mariana: {
    ring: "ring-[#d9c4e3]",
    bg: "bg-[#f4ecf7]",
    fg: "text-[#7c5a8c]",
  },
  Diego: {
    ring: "ring-brand-200",
    bg: "bg-brand-50",
    fg: "text-brand-800",
  },
  Marcus: {
    ring: "ring-amber-200",
    bg: "bg-amber-50",
    fg: "text-amber-800",
  },
  "Sarah Kim": {
    ring: "ring-rose-200",
    bg: "bg-rose-50",
    fg: "text-rose-800",
  },
};

const sourceRole: Record<CoverageRow["source"], string> = {
  Mariana: "booker · The Crescent",
  Diego: "tour manager",
  Marcus: "GM · The Crescent",
  "Sarah Kim": "agent · WME",
};

const COASTAL_TRAIL = "/shows/show_coastal_spell_dispute/trail";

export default function AuditTrailContextPage() {
  const grouped: Record<string, CoverageRow[]> = {};
  TRANSCRIPT_COVERAGE.forEach((row) => {
    grouped[row.source] = grouped[row.source] ?? [];
    grouped[row.source].push(row);
  });
  const sources = Object.keys(grouped) as CoverageRow["source"][];

  return (
    <div className="px-12 py-10 max-w-4xl">
      <Link
        href="/context"
        className="inline-flex items-center gap-1 text-[12px] text-ink-400 hover:text-ink-900 mb-8 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to context
      </Link>

      <div className="mb-10">
        <div className="eyebrow mb-3 inline-flex items-center gap-1.5">
          <History className="h-3 w-3" /> Settlement audit trail prototype
        </div>
        <h1
          className="font-display text-[44px] font-medium text-ink-900 leading-[1.05]"
          style={{ letterSpacing: "-0.02em" }}
        >
          What the trail solves.
        </h1>
        <p className="text-[14px] text-ink-600 mt-4 leading-relaxed max-w-2xl">
          The audit trail surface inside Greenroom is built to address specific
          pain points raised across the four research interviews. Below is the
          coverage map — each row connects a transcript quote to the trail
          element that implements it. Click into the Coastal Spell trail to see
          it live.
        </p>

        <div className="mt-6 flex items-center gap-3 flex-wrap">
          <Link href={COASTAL_TRAIL}>
            <span className="inline-flex items-center gap-2 rounded-lg bg-brand-700 hover:bg-brand-800 text-white px-4 py-2 text-[13px] font-medium transition-colors">
              Open Coastal Spell trail
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>
          <Link
            href="/shows/show_coastal_spell_dispute"
            className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-600 hover:text-ink-900 underline-offset-2 hover:underline"
          >
            See the show page first
          </Link>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-3 mb-12">
        <StatTile label="Transcripts" value="4" sub="Mariana, Diego, Marcus, Sarah" />
        <StatTile
          label="Cases covered"
          value={String(TRANSCRIPT_COVERAGE.length)}
          sub="quote → surface mappings"
        />
        <StatTile label="Trail entries" value="15" sub="Coastal Spell" />
        <StatTile label="Open flags" value="1" sub="recoup ambiguity" />
      </div>

      {sources.map((source) => {
        const tone = sourceTone[source];
        const rows = grouped[source];
        return (
          <section key={source} className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`h-9 w-9 rounded-full flex items-center justify-center text-[12px] font-semibold ring-1 ${tone.bg} ${tone.fg} ${tone.ring}`}
              >
                {source
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div>
                <h2 className="text-[18px] font-semibold text-ink-900 leading-tight">
                  {source}
                </h2>
                <div className="text-[11.5px] text-ink-400">
                  {sourceRole[source]} · {rows.length} case
                  {rows.length === 1 ? "" : "s"}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {rows.map((row) => (
                <CoverageCard key={row.id} row={row} />
              ))}
            </div>
          </section>
        );
      })}

      {/* Footer note */}
      <Card className="mt-12">
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-brand-700" />
              Cases intentionally <em>not</em> covered in this surface
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-[13px] text-ink-700 leading-relaxed space-y-2">
            <li>
              <strong>Expense aggregation (M3).</strong> Pulling CC fees, POS,
              hospitality receipts, marketing into one view — separate feature,
              not a trail concern.
            </li>
            <li>
              <strong>Vs / % of net / door calc support (M5).</strong> Engine
              work in <code className="text-[11px] bg-canvas-soft px-1 rounded">lib/dealMath.ts</code>.
              The trail is designed to be useful{" "}
              <em>while</em> the calc gap persists — see the math strip on the
              Coastal Spell trail.
            </li>
            <li>
              <strong>Margin variance dashboard (MK3).</strong> GM-facing
              reporting; not surfaced through per-show trail.
            </li>
            <li>
              <strong>Agent statement formatting consistency (M4).</strong>{" "}
              “Send to agent” affordance shows the shape; full PDF/email
              templating is downstream.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-lg ring-1 ring-ink-200/70 bg-white p-3.5">
      <div className="eyebrow text-[9px] text-ink-400">{label}</div>
      <div className="text-[22px] font-mono tabular font-semibold text-ink-900 mt-1 leading-none">
        {value}
      </div>
      <div className="text-[11px] text-ink-500 mt-1.5 leading-snug">{sub}</div>
    </div>
  );
}

function CoverageCard({ row }: { row: CoverageRow }) {
  return (
    <div className="rounded-lg ring-1 ring-ink-200/70 bg-white p-4">
      <div className="flex items-start gap-3">
        <PlainBadge>{row.id}</PlainBadge>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 text-[13px] text-ink-800 leading-relaxed">
            <Quote className="h-3.5 w-3.5 text-ink-300 mt-1 shrink-0" />
            <span className="italic text-ink-700">“{row.quote}”</span>
          </div>
          <div className="mt-3 pt-3 border-t border-ink-100 grid grid-cols-[auto_1fr] gap-3 items-baseline">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400">
              How
            </div>
            <div className="text-[12.5px] text-ink-800 leading-relaxed">
              {row.surface}
              {row.exampleEntryId && (
                <>
                  {" — "}
                  <Link
                    href={`${COASTAL_TRAIL}#${row.exampleEntryId}`}
                    className="text-brand-700 hover:text-brand-800 hover:underline underline-offset-2 inline-flex items-center gap-0.5"
                  >
                    see live
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
