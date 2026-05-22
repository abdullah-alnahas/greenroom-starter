import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getShowById } from "@/lib/queries";
import { getTrailForShow, trailStats } from "@/data/audit-trail";
import { formatShowDateFull, relativeShowDate, formatMoneyCompact } from "@/lib/format";
import { StatusBadge, PlainBadge } from "@/components/ui/badge";
import { TrailClient } from "./trail-client";

export default async function TrailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getShowById(id);
  if (!data) notFound();

  const { show, artist, agent, agency, deal, settlement } = data;
  const trail = getTrailForShow(id);

  // Empty state — honest about prototype scope.
  if (!trail) {
    return (
      <div className="max-w-5xl">
        <div className="px-12 pt-10 pb-14">
          <Link
            href={`/shows/${id}`}
            className="inline-flex items-center gap-1 text-[12px] text-ink-400 hover:text-ink-900 mb-8"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to show
          </Link>
          <h1 className="font-display text-[44px] font-medium text-ink-900 leading-[1.05]">
            No trail entries yet
          </h1>
          <p className="text-[14px] text-ink-500 mt-3 max-w-xl leading-relaxed">
            The audit trail for{" "}
            <span className="text-ink-800 font-medium">{artist?.name}</span> is
            empty in this prototype. Coastal Spell is the worked example for
            the case study — open{" "}
            <Link
              href="/shows/show_coastal_spell_dispute/trail"
              className="text-brand-700 hover:text-brand-800 underline underline-offset-2"
            >
              that trail
            </Link>{" "}
            to see the full surface.
          </p>
          <p className="text-[12px] text-ink-400 mt-6 max-w-xl leading-relaxed">
            In production, every show would accumulate entries on its own as
            deal emails are parsed, expenses entered, signoffs captured, and
            disputes opened or resolved.
          </p>
        </div>
      </div>
    );
  }

  const stats = trailStats(trail);
  const finalPayout = trail.entries.find(
    (e) => e.kind === "dispute_resolution",
  )?.payoutAtMoment;
  const initialPayout = trail.entries.find(
    (e) => e.kind === "at_table_signoff",
  )?.payoutAtMoment;
  const absorbedDelta =
    finalPayout != null && initialPayout != null
      ? finalPayout - initialPayout
      : 0;

  const isDisputed = settlement?.status === "disputed" || stats.disputes > 0;

  return (
    <div className="max-w-6xl">
      {/* Hero — pared down. One row of context, one stat strip. */}
      <div
        className={`px-12 pt-10 pb-12 ${isDisputed ? "bg-gradient-to-b from-rose-50/40 to-canvas" : "bg-gradient-to-b from-brand-50/30 to-canvas"}`}
      >
        <Link
          href={`/shows/${id}`}
          className="inline-flex items-center gap-1 text-[12px] text-ink-400 hover:text-ink-900 mb-8 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to show
        </Link>

        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-1.5 mb-4">
              <StatusBadge status={show.status} />
              {isDisputed && (
                <PlainBadge variant="rose">Dispute resolved</PlainBadge>
              )}
              {stats.openFlags > 0 && (
                <PlainBadge variant="amber">
                  {stats.openFlags} open flag{stats.openFlags === 1 ? "" : "s"}
                </PlainBadge>
              )}
            </div>
            <h1
              className="font-display text-[48px] font-medium text-ink-900 leading-[1.02]"
              style={{ letterSpacing: "-0.025em" }}
            >
              {artist?.name} — Trail
            </h1>
            <div className="text-[13px] text-ink-400 mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-ink-600 font-medium">
                {formatShowDateFull(show.date)}
              </span>
              <span className="text-ink-300">·</span>
              <span>{relativeShowDate(show.date)}</span>
              <span className="text-ink-300">·</span>
              <span>
                Agent:{" "}
                <span className="text-ink-700">
                  {agent?.name ?? "—"}
                  {agency?.name ? ` (${agency.name})` : ""}
                </span>
              </span>
            </div>

            <div className="mt-5 max-w-2xl rounded-lg ring-1 ring-ink-200/80 bg-canvas-soft px-4 py-3.5 text-[13px] text-ink-700 leading-relaxed">
              <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-500 mb-1.5">
                Deal · from Mariana&apos;s notes
              </div>
              <div className="italic text-ink-800">
                {deal?.dealNotesFreetext ?? trail.dealSummary}
              </div>
              <div className="text-[11px] text-ink-400 mt-2">
                Source:{" "}
                <code className="font-mono bg-white px-1 rounded ring-1 ring-ink-200/60">
                  deals.deal_notes_freetext
                </code>{" "}
                · the prose the booker actually trusts. Structured fields
                (guarantee, percentage, caps) live on the show page.
              </div>
            </div>
          </div>
        </div>

        {/* Stat strip — 30s view per MK1 */}
        <div className="flex items-baseline gap-10 mt-8 pt-5 border-t border-ink-200/40">
          {finalPayout != null && (
            <MiniStat
              label="Final payout"
              value={formatMoneyCompact(finalPayout)}
              accent
            />
          )}
          {absorbedDelta !== 0 && (
            <MiniStat
              label={absorbedDelta > 0 ? "Adjusted up" : "Absorbed"}
              value={formatMoneyCompact(Math.abs(absorbedDelta))}
              tone="rose"
            />
          )}
          <MiniStat label="Entries" value={String(stats.total)} />
          <MiniStat
            label="Spans"
            value={`${stats.spanDays} days`}
          />
          <MiniStat
            label="Amendments"
            value={String(stats.amendments)}
          />
        </div>
      </div>

      {/* Body — client island handles toggles, modal, FAB */}
      <div className="px-12 pb-32">
        <TrailClient
          trail={trail}
          deal={deal}
          finalPayout={finalPayout ?? null}
          initialPayout={initialPayout ?? null}
        />
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent,
  tone,
}: {
  label: string;
  value: string;
  accent?: boolean;
  tone?: "rose";
}) {
  return (
    <div>
      <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-400">
        {label}
      </div>
      <div
        className={`mt-1 text-[20px] font-semibold tabular leading-none ${
          tone === "rose"
            ? "text-rose-700"
            : accent
              ? "text-brand-700"
              : "text-ink-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
