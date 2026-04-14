'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { UIAction } from '@/lib/ai-os';
import type { ChartBlock as ChartBlockType } from '@/lib/ai-os/ui-composer/types';

export interface BlockComponentProps<B> {
  block: B;
  onAction?: (action: UIAction) => void;
}

const CHART_HEIGHT = 200;
const COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
];

function BarChart({ series }: { series: ChartBlockType['series'] }) {
  const max = Math.max(...series.map((s) => s.value), 1);
  const barWidth = 100 / series.length;
  const padding = barWidth * 0.15;

  return (
    <svg
      viewBox={`0 0 100 ${CHART_HEIGHT}`}
      className="h-[200px] w-full"
      preserveAspectRatio="none"
    >
      {series.map((item, i) => {
        const barH = (item.value / max) * (CHART_HEIGHT - 30);
        const x = i * barWidth + padding;
        const w = barWidth - padding * 2;
        const y = CHART_HEIGHT - 20 - barH;
        return (
          <g key={item.label}>
            <rect
              x={x}
              y={y}
              width={w}
              height={barH}
              fill={COLORS[i % COLORS.length]}
              rx={1}
            >
              {item.hint && <title>{item.hint}</title>}
            </rect>
            <text
              x={x + w / 2}
              y={CHART_HEIGHT - 6}
              textAnchor="middle"
              className="fill-muted-foreground"
              fontSize="4"
            >
              {item.label.length > 8
                ? `${item.label.slice(0, 7)}...`
                : item.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function LineChart({ series }: { series: ChartBlockType['series'] }) {
  const max = Math.max(...series.map((s) => s.value), 1);
  const step = series.length > 1 ? 100 / (series.length - 1) : 50;

  const points = series
    .map((item, i) => {
      const x = i * step;
      const y = CHART_HEIGHT - 20 - (item.value / max) * (CHART_HEIGHT - 30);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 100 ${CHART_HEIGHT}`}
      className="h-[200px] w-full"
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke="#10b981"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {series.map((item, i) => {
        const x = i * step;
        const y = CHART_HEIGHT - 20 - (item.value / max) * (CHART_HEIGHT - 30);
        return (
          <circle key={item.label} cx={x} cy={y} r="2" fill="#10b981">
            {item.hint && <title>{item.hint}</title>}
          </circle>
        );
      })}
    </svg>
  );
}

function PieChart({ series }: { series: ChartBlockType['series'] }) {
  const total = series.reduce((sum, s) => sum + s.value, 0) || 1;
  const cx = 50;
  const cy = 50;
  const r = 40;
  let cumAngle = -Math.PI / 2;

  const slices = series.map((item, i) => {
    const angle = (item.value / total) * 2 * Math.PI;
    const startX = cx + r * Math.cos(cumAngle);
    const startY = cy + r * Math.sin(cumAngle);
    cumAngle += angle;
    const endX = cx + r * Math.cos(cumAngle);
    const endY = cy + r * Math.sin(cumAngle);
    const largeArc = angle > Math.PI ? 1 : 0;

    const d = [
      `M ${cx} ${cy}`,
      `L ${startX} ${startY}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`,
      'Z',
    ].join(' ');

    return (
      <path key={item.label} d={d} fill={COLORS[i % COLORS.length]}>
        {item.hint && <title>{item.hint}</title>}
      </path>
    );
  });

  return (
    <svg viewBox="0 0 100 100" className="mx-auto h-[200px] w-[200px]">
      {slices}
    </svg>
  );
}

export default function ChartBlock({
  block,
}: BlockComponentProps<ChartBlockType>) {
  return (
    <Card className="rounded-xl border bg-white shadow-sm dark:bg-gray-900">
      <CardHeader>
        <CardTitle className="text-base font-semibold">{block.title}</CardTitle>
      </CardHeader>

      <CardContent>
        {block.chartType === 'bar' && <BarChart series={block.series} />}
        {block.chartType === 'line' && <LineChart series={block.series} />}
        {block.chartType === 'pie' && <PieChart series={block.series} />}

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-3">
          {block.series.map((item, i) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
                aria-hidden="true"
              />
              <span className="text-xs text-muted-foreground">
                {item.label}: {item.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
