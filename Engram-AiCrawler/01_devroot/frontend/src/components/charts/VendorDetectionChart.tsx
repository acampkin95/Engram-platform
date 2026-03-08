import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Bug } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../ui';
import { useReducedMotion } from '../../lib/motion';
import { BaseChart } from './BaseChart';
import { TOKENS } from '../../lib/chartTheme';

interface VendorDetectionChartProps {
  malicious?: number;
  suspicious?: number;
  harmless?: number;
  undetected?: number;
  detectionRatio?: string;
  className?: string;
}

export function VendorDetectionChart({
  malicious = 0,
  suspicious = 0,
  harmless = 0,
  undetected = 0,
  detectionRatio,
  className = '',
}: VendorDetectionChartProps) {
  const prefersReduced = useReducedMotion();
  const total = malicious + suspicious + harmless + undetected;

  const option = useMemo(() => {
    if (total === 0) return null;

    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: TOKENS.surface,
        borderColor: TOKENS.border,
        textStyle: {
          color: TOKENS.text,
          fontSize: 11,
          fontFamily: "'Space Mono', monospace",
        },
        extraCssText: 'box-shadow: 0 0 16px rgba(80,255,255,0.15);',
        formatter: (params: { name: string; value: number; percent: number }) =>
          `<div style="font-family:'Space Mono',monospace;font-size:11px;line-height:1.8">
            <span style="color:${TOKENS.text};font-weight:bold">${params.name}</span><br/>
            <span style="color:${TOKENS.textDim}">Count: </span><span style="color:${TOKENS.text};font-weight:bold">${params.value}</span>
            <span style="color:${TOKENS.textDim}"> (${params.percent.toFixed(1)}%)</span>
          </div>`,
      },
      legend: {
        bottom: 0,
        textStyle: {
          color: TOKENS.textDim,
          fontSize: 11,
          fontFamily: "'Space Mono', monospace",
        },
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 16,
      },
      series: [
        {
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 2,
            borderColor: TOKENS.surface,
            borderWidth: 2,
          },
          label: {
            show: true,
            position: 'center',
            formatter: detectionRatio || `${malicious}/${total}`,
            fontSize: 18,
            fontWeight: 'bold',
            fontFamily: "'Space Mono', monospace",
            color: malicious > 0 ? TOKENS.neonR : TOKENS.plasma,
            textShadowBlur: malicious > 0 ? 12 : 8,
            textShadowColor: malicious > 0
              ? 'rgba(255,45,107,0.6)'
              : 'rgba(15,187,170,0.6)',
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 20,
              fontWeight: 'bold',
              fontFamily: "'Space Mono', monospace",
            },
            itemStyle: {
              shadowBlur: 20,
              shadowColor: 'rgba(80,255,255,0.4)',
            },
          },
          data: [
            { value: malicious,  name: 'Malicious',  itemStyle: { color: TOKENS.neonR,   shadowBlur: 8, shadowColor: 'rgba(255,45,107,0.4)'  } },
            { value: suspicious, name: 'Suspicious', itemStyle: { color: TOKENS.volt,    shadowBlur: 8, shadowColor: 'rgba(212,255,0,0.4)'   } },
            { value: harmless,   name: 'Harmless',   itemStyle: { color: TOKENS.plasma,  shadowBlur: 8, shadowColor: 'rgba(15,187,170,0.4)'  } },
            { value: undetected, name: 'Undetected', itemStyle: { color: TOKENS.borderHi                                                     } },
          ].filter((d) => d.value > 0),
          animationType: 'scale',
          animationDuration: 800,
          animationEasing: 'cubicOut',
        },
      ],
    };
  }, [malicious, suspicious, harmless, undetected, total, detectionRatio]);

  if (total === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <h2 className="text-lg font-display font-semibold flex items-center gap-2">
            <Bug className="w-5 h-5 text-fuchsia" />
            Vendor Detection
          </h2>
        </CardHeader>
        <CardBody>
          <div className="py-8 text-center text-sm text-text-mute font-mono">
            No scan data available
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <motion.div
      initial={prefersReduced ? undefined : { opacity: 0, y: 6 }}
      animate={prefersReduced ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={className}
    >
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-display font-semibold flex items-center gap-2">
              <Bug className="w-5 h-5 text-fuchsia" />
              Vendor Detection
            </h2>
            <span className="text-xs font-mono text-text-mute">
              {total} vendor{total !== 1 ? 's' : ''} scanned
            </span>
          </div>
        </CardHeader>
        <CardBody>
          {option && <BaseChart option={option} height={240} />}
          <div className="flex justify-center gap-6 mt-3">
            {[
              { label: 'Malicious',  value: malicious,  color: 'text-neon-r'   },
              { label: 'Suspicious', value: suspicious, color: 'text-volt'     },
              { label: 'Harmless',   value: harmless,   color: 'text-plasma'   },
              { label: 'Undetected', value: undetected, color: 'text-text-mute'},
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <span className={`text-lg font-bold font-mono ${stat.color}`}>{stat.value}</span>
                <span className="text-[10px] text-text-mute block font-mono">{stat.label}</span>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </motion.div>
  );
}
