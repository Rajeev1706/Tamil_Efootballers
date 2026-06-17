import { cn } from "../../lib/utils"

const gradeConfig = {
  S:   { bg: "bg-amber-400/15",   text: "text-amber-400",   border: "border-amber-400/30",   label: "S"  },
  A:   { bg: "bg-blue-400/15",    text: "text-blue-400",    border: "border-blue-400/30",    label: "A"  },
  B:   { bg: "bg-emerald-400/15", text: "text-emerald-400", border: "border-emerald-400/30", label: "B"  },
  C:   { bg: "bg-slate-500/20",   text: "text-slate-400",   border: "border-slate-500/30",   label: "C"  },
}

export default function GradeBadge({ grade, size = "sm" }) {
  const cfg = gradeConfig[grade] || gradeConfig["C"]
  return (
    <span className={cn(
      "inline-flex items-center justify-center font-bold border rounded",
      cfg.bg, cfg.text, cfg.border,
      size === "sm"  && "text-xs px-1.5 py-0.5 min-w-[28px]",
      size === "md"  && "text-sm px-2 py-0.5 min-w-[32px]",
      size === "lg"  && "text-base px-2.5 py-1 min-w-[36px]",
    )}>
      {cfg.label}
    </span>
  )
}