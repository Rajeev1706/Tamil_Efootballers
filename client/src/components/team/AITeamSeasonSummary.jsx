/**
 * AITeamSeasonSummary — per-team AI-generated season narrative card
 * Used in TeamTrophyDetail page.
 */
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Sparkles, RefreshCw, ChevronDown, Bot, FileText, Lock } from "lucide-react"
import api from "../../lib/api"
import { cn } from "../../lib/utils"

export default function AITeamSeasonSummary({ teamId, seasons = [], isAdmin = false }) {
  const latestSeason = seasons[0] ?? null
  const [selectedSeason, setSelectedSeason] = useState(latestSeason ? String(latestSeason) : null)
  const qc = useQueryClient()

  const { data: summary, isLoading } = useQuery({
    queryKey: ["ai-season-summary", "team", teamId, selectedSeason],
    queryFn: () =>
      api.get(`/season-summaries/team/${teamId}?season=${selectedSeason}`)
         .then(r => r.data),
    enabled: !!teamId && !!selectedSeason,
    staleTime: 1000 * 60 * 10,
  })

  const regenerate = useMutation({
    mutationFn: () =>
      api.post(`/season-summaries/regenerate/team/${teamId}?season=${selectedSeason}`)
         .then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-season-summary", "team", teamId, selectedSeason] })
    },
  })

  if (!seasons.length || !selectedSeason) return null

  const isAI       = summary?.generated_by && !["template", null].includes(summary.generated_by)
  const isTemplate = summary?.generated_by === "template"

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-surface-border">
        <Sparkles className="w-4 h-4 text-violet-400" />
        <h2 className="text-base font-semibold text-white">AI Season Summary</h2>

        <div className="ml-auto flex items-center gap-2">
          {seasons.length > 1 && (
            <div className="relative">
              <select
                value={selectedSeason}
                onChange={e => setSelectedSeason(e.target.value)}
                className="appearance-none bg-pitch-800 border border-surface-border rounded-xl pl-3 pr-7 py-1.5 text-xs text-white focus:outline-none cursor-pointer"
              >
                {seasons.map(s => (
                  <option key={s} value={String(s)}>S{s}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {isAdmin && summary && (
            <button
              onClick={() => regenerate.mutate()}
              disabled={regenerate.isPending}
              title="Regenerate"
              className={cn(
                "w-7 h-7 rounded-lg border flex items-center justify-center transition-colors",
                regenerate.isPending
                  ? "border-surface-border text-slate-600 cursor-not-allowed"
                  : "border-surface-border text-slate-400 hover:text-violet-400 hover:border-violet-400/40"
              )}
            >
              <RefreshCw className={cn("w-3.5 h-3.5", regenerate.isPending && "animate-spin")} />
            </button>
          )}
        </div>
      </div>

      <div className="p-5">
        {isLoading && (
          <div className="space-y-2 animate-pulse">
            <div className="h-3 bg-pitch-800 rounded-full w-full" />
            <div className="h-3 bg-pitch-800 rounded-full w-4/5" />
            <div className="h-3 bg-pitch-800 rounded-full w-3/5" />
          </div>
        )}

        {!isLoading && !summary && (
          <div className="py-6 text-center space-y-2">
            <Lock className="w-6 h-6 text-slate-600 mx-auto" />
            <p className="text-sm text-slate-500">No summary generated yet.</p>
            {isAdmin && (
              <button
                onClick={() => regenerate.mutate()}
                disabled={regenerate.isPending}
                className="mt-2 px-4 py-1.5 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-400 text-xs font-semibold hover:bg-violet-500/25 transition-colors disabled:opacity-50"
              >
                {regenerate.isPending ? "Generating…" : "Generate Now"}
              </button>
            )}
          </div>
        )}

        {!isLoading && summary?.summary_text && (
          <div className="space-y-4">
            <p className="text-sm text-slate-200 leading-relaxed font-medium">
              "{summary.summary_text}"
            </p>

            {summary.win_rate !== undefined && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Team win rate</span>
                  <span className={cn(
                    "font-mono font-bold",
                    parseFloat(summary.win_rate) >= 60 ? "text-emerald-400"
                    : parseFloat(summary.win_rate) >= 50 ? "text-amber-400"
                    : "text-rose-400"
                  )}>
                    {parseFloat(summary.win_rate).toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 bg-pitch-800 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700",
                      parseFloat(summary.win_rate) >= 60 ? "bg-emerald-400"
                      : parseFloat(summary.win_rate) >= 50 ? "bg-amber-400"
                      : "bg-rose-400"
                    )}
                    style={{ width: `${Math.min(100, parseFloat(summary.win_rate))}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-1.5 pt-1">
              {isAI ? (
                <>
                  <Bot className="w-3 h-3 text-violet-400" />
                  <span className="text-xs text-violet-400">Generated by AI</span>
                </>
              ) : isTemplate ? (
                <>
                  <FileText className="w-3 h-3 text-slate-500" />
                  <span className="text-xs text-slate-500">Predefined summary</span>
                </>
              ) : null}
            </div>
          </div>
        )}

        {regenerate.isPending && (
          <div className="mt-3 text-xs text-violet-400 text-center">Generating…</div>
        )}
        {regenerate.isError && (
          <div className="mt-3 text-xs text-rose-400 text-center">Failed. Try again.</div>
        )}
      </div>
    </div>
  )
}