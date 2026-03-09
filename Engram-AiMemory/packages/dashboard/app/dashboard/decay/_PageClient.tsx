"use client";

import { TrendingDown } from "lucide-react";

// ---------------------------------------------------------------------------
// Decay math
// ---------------------------------------------------------------------------

// Decay formula: importance * (0.5 ^ (days / 30))
// Half-life = 30 days
const HALF_LIFE_DAYS = 30;
const INITIAL_IMPORTANCE = 1.0;
const MIN_IMPORTANCE = 0.1;
const MAX_DAYS = 90;

function decayedImportance(days: number, initial = INITIAL_IMPORTANCE): number {
  const raw = initial * 0.5 ** (days / HALF_LIFE_DAYS);
  return Math.max(raw, MIN_IMPORTANCE);
}

// ---------------------------------------------------------------------------
// SVG chart constants
// ---------------------------------------------------------------------------

const CHART_W = 560;
const CHART_H = 260;
const PAD = { top: 20, right: 24, bottom: 48, left: 52 };

const PLOT_W = CHART_W - PAD.left - PAD.right;
const PLOT_H = CHART_H - PAD.top - PAD.bottom;

// Map data coords → SVG coords
function toSvgX(day: number): number {
  return PAD.left + (day / MAX_DAYS) * PLOT_W;
}

function toSvgY(importance: number): number {
  // Y=0 is top in SVG, so invert
  return PAD.top + PLOT_H - importance * PLOT_H;
}

// ---------------------------------------------------------------------------
// Compute path data (50 points + smooth bezier)
// ---------------------------------------------------------------------------

function buildDecayCurve(): string {
  const NUM_POINTS = 60;
  const points: Array<[number, number]> = [];

  for (let i = 0; i <= NUM_POINTS; i++) {
    const day = (i / NUM_POINTS) * MAX_DAYS;
    const imp = decayedImportance(day);
    points.push([toSvgX(day), toSvgY(imp)]);
  }

  // Build smooth cubic bezier path
  const [first, ...rest] = points;
  let d = `M ${first[0].toFixed(2)},${first[1].toFixed(2)}`;

  for (let i = 0; i < rest.length; i++) {
    const prev = points[i];
    const curr = rest[i];
    const cpx = (prev[0] + curr[0]) / 2;
    d += ` C ${cpx.toFixed(2)},${prev[1].toFixed(2)} ${cpx.toFixed(2)},${curr[1].toFixed(2)} ${curr[0].toFixed(2)},${curr[1].toFixed(2)}`;
  }

  return d;
}

// ---------------------------------------------------------------------------
// Y-axis ticks
// ---------------------------------------------------------------------------

const Y_TICKS = [0, 0.1, 0.25, 0.5, 0.75, 1.0];
const X_TICKS = [0, 15, 30, 45, 60, 75, 90];

// ---------------------------------------------------------------------------
// Info Cards
// ---------------------------------------------------------------------------

interface InfoCardProps {
  title: string;
  value: string;
  description: string;
  color: "indigo" | "violet" | "emerald";
}

function InfoCard({ title, value, description, color }: InfoCardProps) {
  const colorStyles = {
    indigo: {
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      text: "text-amber-400",
      valueBg: "bg-amber-500/10",
    },
    violet: {
      bg: "bg-violet-500/10",
      border: "border-violet-500/20",
      text: "text-violet-400",
      valueBg: "bg-violet-500/10",
    },
    emerald: {
      bg: "bg-teal-500/10",
      border: "border-teal-500/20",
      text: "text-teal-400",
      valueBg: "bg-teal-500/10",
    },
  }[color];

  return (
    <div className={`rounded-xl border p-5 space-y-3 ${colorStyles.bg} ${colorStyles.border}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-200">{title}</p>
        <span
          className={`text-sm font-bold font-mono px-2.5 py-1 rounded-lg ${colorStyles.valueBg} ${colorStyles.text}`}
        >
          {value}
        </span>
      </div>
      <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DecayPage() {
  const curvePath = buildDecayCurve();

  // Half-life marker position
  const halfLifeX = toSvgX(HALF_LIFE_DAYS);
  const halfLifeY = toSvgY(0.5);

  // Min importance line Y
  const minImportanceY = toSvgY(MIN_IMPORTANCE);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <TrendingDown className="w-4 h-4 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Memory Decay</h1>
        </div>
        <p className="text-slate-400 text-sm">Importance decay over time</p>
      </div>

      {/* Chart Card */}
      <div className="bg-white/[0.03] rounded-xl border border-white/[0.08] p-6">
        <div className="mb-4">
          <p className="text-sm font-semibold text-slate-200">Decay Curve</p>
          <p className="text-xs text-slate-500 mt-0.5">
            importance × (0.5 ^ (days ÷ 30)) — half-life of {HALF_LIFE_DAYS} days
          </p>
        </div>

        {/* SVG Chart */}
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            className="w-full max-w-2xl mx-auto"
            aria-label="Memory importance decay curve"
            role="img"
          >
            {/* Grid lines */}
            {Y_TICKS.map((tick) => (
              <line
                key={`ygrid-${tick}`}
                x1={PAD.left}
                y1={toSvgY(tick)}
                x2={CHART_W - PAD.right}
                y2={toSvgY(tick)}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
              />
            ))}
            {X_TICKS.map((tick) => (
              <line
                key={`xgrid-${tick}`}
                x1={toSvgX(tick)}
                y1={PAD.top}
                x2={toSvgX(tick)}
                y2={PAD.top + PLOT_H}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
              />
            ))}

            {/* Minimum importance floor line */}
            <line
              x1={PAD.left}
              y1={minImportanceY}
              x2={CHART_W - PAD.right}
              y2={minImportanceY}
              stroke="rgba(242,169,59,0.25)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <text
              x={CHART_W - PAD.right + 4}
              y={minImportanceY + 4}
              fill="rgba(242,169,59,0.6)"
              fontSize="9"
              fontFamily="monospace"
            >
              min
            </text>

            {/* Half-life vertical dashed line */}
            <line
              x1={halfLifeX}
              y1={PAD.top}
              x2={halfLifeX}
              y2={PAD.top + PLOT_H}
              stroke="rgba(155,125,224,0.5)"
              strokeWidth="1.5"
              strokeDasharray="5 3"
            />

            {/* Half-life horizontal dashed line to point */}
            <line
              x1={PAD.left}
              y1={halfLifeY}
              x2={halfLifeX}
              y2={halfLifeY}
              stroke="rgba(155,125,224,0.3)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />

            {/* Area fill under curve */}
            <path
              d={`${curvePath} L ${toSvgX(MAX_DAYS).toFixed(2)},${(PAD.top + PLOT_H).toFixed(2)} L ${PAD.left.toFixed(2)},${(PAD.top + PLOT_H).toFixed(2)} Z`}
              fill="url(#decayGradient)"
              opacity="0.3"
            />

            {/* Gradient definition */}
            <defs>
              <linearGradient id="decayGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F2A93B" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#F2A93B" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Decay curve */}
            <path
              d={curvePath}
              fill="none"
              stroke="#F2A93B"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Half-life point dot */}
            <circle
              cx={halfLifeX}
              cy={halfLifeY}
              r="5"
              fill="#9B7DE0"
              stroke="#03020A"
              strokeWidth="2"
            />

            {/* Half-life label */}
            <text
              x={halfLifeX + 8}
              y={halfLifeY - 10}
              fill="#C4B5FD"
              fontSize="10"
              fontFamily="monospace"
              fontWeight="600"
            >
              Day {HALF_LIFE_DAYS}: 50%
            </text>

            {/* Axes */}
            {/* X axis */}
            <line
              x1={PAD.left}
              y1={PAD.top + PLOT_H}
              x2={CHART_W - PAD.right}
              y2={PAD.top + PLOT_H}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="1"
            />
            {/* Y axis */}
            <line
              x1={PAD.left}
              y1={PAD.top}
              x2={PAD.left}
              y2={PAD.top + PLOT_H}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="1"
            />

            {/* X axis ticks + labels */}
            {X_TICKS.map((tick) => (
              <g key={`xtick-${tick}`}>
                <line
                  x1={toSvgX(tick)}
                  y1={PAD.top + PLOT_H}
                  x2={toSvgX(tick)}
                  y2={PAD.top + PLOT_H + 4}
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="1"
                />
                <text
                  x={toSvgX(tick)}
                  y={PAD.top + PLOT_H + 16}
                  textAnchor="middle"
                  fill="rgba(148,163,184,0.7)"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {tick}
                </text>
              </g>
            ))}

            {/* Y axis ticks + labels */}
            {Y_TICKS.map((tick) => (
              <g key={`ytick-${tick}`}>
                <line
                  x1={PAD.left - 4}
                  y1={toSvgY(tick)}
                  x2={PAD.left}
                  y2={toSvgY(tick)}
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="1"
                />
                <text
                  x={PAD.left - 8}
                  y={toSvgY(tick) + 4}
                  textAnchor="end"
                  fill="rgba(148,163,184,0.7)"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {tick.toFixed(1)}
                </text>
              </g>
            ))}

            {/* Axis labels */}
            <text
              x={PAD.left + PLOT_W / 2}
              y={CHART_H - 4}
              textAnchor="middle"
              fill="rgba(148,163,184,0.5)"
              fontSize="11"
            >
              Days since last access
            </text>
            <text
              x={12}
              y={PAD.top + PLOT_H / 2}
              textAnchor="middle"
              fill="rgba(148,163,184,0.5)"
              fontSize="11"
              transform={`rotate(-90, 12, ${PAD.top + PLOT_H / 2})`}
            >
              Importance
            </text>
          </svg>
        </div>

        {/* Chart legend */}
        <div className="flex items-center gap-6 mt-4 text-xs text-slate-500 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-amber-500" />
            <span>Decay curve</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 border-t border-dashed border-violet-500/60" />
            <span>Half-life marker (day 30)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 border-t border-dashed border-amber-500/40" />
            <span>Minimum floor (0.1)</span>
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div>
        <p className="text-xs text-slate-600 uppercase tracking-widest font-semibold mb-3">
          Decay Mechanics
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <InfoCard
            title="Half-Life"
            value="30 days"
            description="A memory's importance halves every 30 days without access. After 90 days, importance drops to ~12.5% of its original value."
            color="indigo"
          />
          <InfoCard
            title="Access Boost"
            value="+0.1"
            description="Accessing or reinforcing a memory boosts its importance score by 0.1, resetting the effective decay clock for that memory."
            color="violet"
          />
          <InfoCard
            title="Minimum Floor"
            value="0.1"
            description="Memories never decay below 10% importance. This floor ensures long-term memories remain retrievable even without recent access."
            color="emerald"
          />
        </div>
      </div>

      {/* Decay table */}
      <div className="bg-white/[0.03] rounded-xl border border-white/[0.08] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <p className="text-sm font-semibold text-slate-200">Decay Reference Table</p>
          <p className="text-xs text-slate-500 mt-0.5">Starting importance = 1.0</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left">
              <th className="px-5 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider">
                Days
              </th>
              <th className="px-5 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider">
                Importance
              </th>
              <th className="px-5 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider">
                Retention
              </th>
              <th className="px-5 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider w-48">
                Bar
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {[0, 7, 14, 30, 45, 60, 90].map((days) => {
              const imp = decayedImportance(days);
              const pct = imp * 100;
              const isMin = imp <= MIN_IMPORTANCE;
              return (
                <tr key={days} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3 text-slate-300 font-mono">{days}d</td>
                  <td className="px-5 py-3 text-slate-200 font-mono font-semibold">
                    {imp.toFixed(3)}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={
                        isMin
                          ? "text-slate-500"
                          : pct > 75
                            ? "text-teal-400"
                            : pct > 40
                              ? "text-amber-400"
                              : "text-rose-400"
                      }
                    >
                      {pct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden w-full">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-violet-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
