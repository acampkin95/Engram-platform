import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Shield, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../ui';
import { useReducedMotion } from '../../lib/motion';
import { BaseChart } from './BaseChart';
import { TOKENS } from '../../lib/chartTheme';

type ThreatLevel = 'low' | 'medium' | 'high' | 'critical';

interface ThreatLevelGaugeProps {
  level?: ThreatLevel;
  score?: number;
  factors?: { name: string; impact: 'positive' | 'negative' | 'neutral' }[];
}

const THRESHOLDS: Record<ThreatLevel, { label: string; color: string; bg: string; border: string; shadowColor: string }> = {
  low:      { label: 'Low Risk',      color: TOKENS.plasma,  bg: 'bg-plasma/10',  border: 'border-plasma/30',  shadowColor: 'rgba(15,187,170,0.5)'  },
  medium:   { label: 'Medium Risk',   color: TOKENS.volt,    bg: 'bg-volt/10',    border: 'border-volt/30',    shadowColor: 'rgba(212,255,0,0.5)'   },
  high:     { label: 'High Risk',     color: TOKENS.fuchsia, bg: 'bg-fuchsia/10', border: 'border-fuchsia/30', shadowColor: 'rgba(243,128,245,0.5)' },
  critical: { label: 'Critical Risk', color: TOKENS.neonR,   bg: 'bg-neon-r/10',  border: 'border-neon-r/30',  shadowColor: 'rgba(255,45,107,0.5)'  },
};

function getLevelFromScore(score: number): ThreatLevel {
  if (score <= 30) return 'low';
  if (score <= 60) return 'medium';
  if (score <= 80) return 'high';
  return 'critical';
}

export function ThreatLevelGauge({ level, score = 42, factors = [] }: ThreatLevelGaugeProps) {
  const prefersReduced = useReducedMotion();
  const threatLevel = level || getLevelFromScore(score);
  const config = THRESHOLDS[threatLevel];

  const option = useMemo(() => ({
    series: [{
      type: 'gauge',
      startAngle: 205,
      endAngle: -25,
      min: 0,
      max: 100,
      splitNumber: 4,
      // Color zones matching the 4 threat levels
      axisLine: {
        lineStyle: {
          width: 20,
          color: [
            [0.30, TOKENS.plasma],  // 0-30: safe
            [0.60, TOKENS.volt],    // 30-60: warning
            [0.80, TOKENS.fuchsia], // 60-80: elevated
            [1.00, TOKENS.neonR],   // 80-100: critical
          ],
        },
      },
      progress: {
        show: false,
      },
      pointer: {
        show: true,
        length: '65%',
        width: 4,
        itemStyle: {
          color: config.color,
          shadowBlur: 16,
          shadowColor: config.shadowColor,
        },
      },
      axisTick: { show: false },
      splitLine: {
        show: true,
        distance: -22,
        length: 8,
        lineStyle: { color: TOKENS.border, width: 1 },
      },
      axisLabel: {
        show: true,
        distance: 28,
        color: TOKENS.textDim,
        fontSize: 9,
        fontFamily: "'Space Mono', monospace",
        formatter: (v: number) => {
          if (v === 0)   return '0';
          if (v === 25)  return '25';
          if (v === 50)  return '50';
          if (v === 75)  return '75';
          if (v === 100) return '100';
          return '';
        },
      },
      title: { show: false },
      detail: {
        valueAnimation: true,
        fontSize: 32,
        fontWeight: 'bold',
        color: config.color,
        fontFamily: "'Space Mono', monospace",
        offsetCenter: [0, '20%'],
        formatter: (v: number) => `${Math.round(v)}`,
        // Glow effect via rich text shadow
        rich: {},
        textShadowBlur: 12,
        textShadowColor: config.shadowColor,
      },
      data: [{ value: score }],
    }],
  }), [score, config]);

  const getIcon = () => {
    switch (threatLevel) {
      case 'low':      return <ShieldCheck className="w-6 h-6" />;
      case 'medium':   return <Shield className="w-6 h-6" />;
      case 'high':     return <ShieldAlert className="w-6 h-6" />;
      case 'critical': return <ShieldX className="w-6 h-6" />;
    }
  };

  return (
    <motion.div
      initial={prefersReduced ? undefined : { opacity: 0, scale: 0.95 }}
      animate={prefersReduced ? undefined : { opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <Card className={`${config.bg} border ${config.border}`}>
        <CardHeader>
          <h2 className="text-lg font-display font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5" style={{ color: config.color }} />
            Threat Assessment
          </h2>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col items-center">
            <BaseChart option={option} height={180} />

            {/* Score label below gauge */}
            <div
              className={`mt-1 px-4 py-2 border ${config.border}`}
              style={{ background: `${config.color}18` }}
            >
              <span
                className="flex items-center gap-2 text-sm font-medium font-mono"
                style={{
                  color: config.color,
                  textShadow: `0 0 12px ${config.shadowColor}`,
                }}
              >
                {getIcon()}
                {config.label}
                <span className="ml-1 opacity-70">({score})</span>
              </span>
            </div>

            {factors.length > 0 && (
              <div className="mt-4 w-full">
                <h3 className="text-xs font-medium text-text-dim mb-3 font-mono uppercase tracking-widest">
                  Contributing Factors
                </h3>
                <div className="space-y-2">
                  {factors.slice(0, 5).map((factor) => (
                    <div key={factor.name} className="flex items-center justify-between text-sm">
                      <span className="text-text-dim">{factor.name}</span>
                      <span className={`text-xs px-2 py-0.5 font-mono ${
                        factor.impact === 'positive' ? 'bg-plasma/20 text-plasma' :
                        factor.impact === 'negative' ? 'bg-neon-r/20 text-neon-r' :
                        'bg-volt/20 text-volt'
                      }`}>
                        {factor.impact}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </motion.div>
  );
}
