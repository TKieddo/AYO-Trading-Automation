"use client";

import { useState, useMemo } from "react";

type CandlestickData = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

type CandlestickChartProps = {
  data: CandlestickData[];
  width?: number;
  height?: number;
};

export function CandlestickChart({ data, width = 800, height = 400 }: CandlestickChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;

    const prices = data.flatMap(d => [d.high, d.low]);
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    const priceRange = maxPrice - minPrice || 1;

    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    const barWidth = chartWidth / data.length;
    const barSpacing = Math.max(2, barWidth * 0.3);

    return {
      data: data.map((d, i) => ({
        ...d,
        x: padding + i * barWidth + barWidth / 2,
        bodyHeight: Math.abs(d.close - d.open),
        bodyTop: padding + chartHeight - ((d.close > d.open ? d.close : d.open) - minPrice) / priceRange * chartHeight,
        wickTop: padding + chartHeight - (d.high - minPrice) / priceRange * chartHeight,
        wickBottom: padding + chartHeight - (d.low - minPrice) / priceRange * chartHeight,
        isBullish: d.close > d.open,
        bodyBottom: padding + chartHeight - ((d.close > d.open ? d.open : d.close) - minPrice) / priceRange * chartHeight,
      })),
      minPrice,
      maxPrice,
      priceRange,
      barWidth: Math.max(4, barWidth - barSpacing),
      padding,
      chartWidth,
      chartHeight,
    };
  }, [data, width, height]);

  if (!chartData) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-400">
        No data available
      </div>
    );
  }

  // Generate Y-axis labels
  const yAxisLabels = [];
  const numLabels = 6;
  for (let i = 0; i < numLabels; i++) {
    const price = chartData.maxPrice - (chartData.priceRange / (numLabels - 1)) * i;
              yAxisLabels.push(price);
  }

  // Format Y-axis labels
  const formatPrice = (price: number) => {
    if (price >= 100000) return `${(price / 1000).toFixed(0)}k`;
    if (price >= 1000) return `${(price / 1000).toFixed(1)}k`;
    return price.toFixed(2);
  };

  // Generate X-axis labels (time)
  const xAxisLabels = [];
  const numXLabels = 6;
  const step = Math.max(1, Math.floor(data.length / numXLabels));
  for (let i = 0; i < data.length; i += step) {
    xAxisLabels.push({ index: i, time: data[i].time });
  }
  if (xAxisLabels[xAxisLabels.length - 1]?.index !== data.length - 1) {
    xAxisLabels.push({ index: data.length - 1, time: data[data.length - 1].time });
  }

  return (
    <div className="relative w-full">
      <svg width={width} height={height} className="w-full h-full">
        {/* Grid lines */}
        {yAxisLabels.map((price, i) => {
          const y = chartData.padding + (chartData.chartHeight / (numLabels - 1)) * i;
          return (
            <g key={`grid-${i}`}>
              <line
                x1={chartData.padding}
                y1={y}
                x2={chartData.padding + chartData.chartWidth}
                y2={y}
                stroke="#E0E0E0"
                strokeWidth={1}
                strokeDasharray="2,2"
                opacity={0.5}
              />
            </g>
          );
        })}

        {xAxisLabels.map((label, i) => {
          const x = chartData.padding + (label.index * chartData.chartWidth) / (data.length - 1 || 1);
          return (
            <g key={`x-grid-${i}`}>
              <line
                x1={x}
                y1={chartData.padding}
                x2={x}
                y2={chartData.padding + chartData.chartHeight}
                stroke="#E0E0E0"
                strokeWidth={1}
                strokeDasharray="2,2"
                opacity={0.5}
              />
            </g>
          );
        })}

        {/* Candlesticks */}
        {chartData.data.map((d, i) => (
          <g
            key={i}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
            className="cursor-pointer"
          >
            {/* Wick */}
            <line
              x1={d.x}
              y1={d.wickTop}
              x2={d.x}
              y2={d.wickBottom}
              stroke={d.isBullish ? "#50C878" : "#FFEB3B"}
              strokeWidth={1.5}
            />
            {/* Body */}
            <rect
              x={d.x - chartData.barWidth / 2}
              y={Math.min(d.bodyTop, d.bodyBottom)}
              width={chartData.barWidth}
              height={Math.max(3, Math.abs(d.bodyTop - d.bodyBottom))}
              fill={d.isBullish ? "#50C878" : "#FFEB3B"}
              stroke={d.isBullish ? "#50C878" : "#FFEB3B"}
              strokeWidth={0.5}
            />
          </g>
        ))}

        {/* Y-axis price labels */}
        {yAxisLabels.map((price, i) => {
          const y = chartData.padding + (chartData.chartHeight / (numLabels - 1)) * i;
          return (
            <g key={`y-label-${i}`}>
              <text
                x={chartData.padding - 10}
                y={y + 4}
                fill="#AAAAAA"
                fontSize="12"
                textAnchor="end"
                className="font-sans"
              >
                {formatPrice(price)}
              </text>
            </g>
          );
        })}

        {/* X-axis time labels */}
        {xAxisLabels.map((label, i) => {
          const x = chartData.padding + (label.index * chartData.chartWidth) / (data.length - 1 || 1);
          return (
            <g key={`x-label-${i}`}>
              <text
                x={x}
                y={chartData.padding + chartData.chartHeight + 20}
                fill="#AAAAAA"
                fontSize="12"
                textAnchor="middle"
                className="font-sans"
              >
                {label.time}
              </text>
            </g>
          );
        })}

        {/* Hover indicator */}
        {hoveredIndex !== null && (
          <>
            <line
              x1={chartData.data[hoveredIndex].x}
              y1={chartData.padding}
              x2={chartData.data[hoveredIndex].x}
              y2={chartData.padding + chartData.chartHeight}
              stroke="#1A1A1A"
              strokeWidth={1}
              strokeDasharray="4,2"
              opacity={0.5}
            />
            <circle
              cx={chartData.data[hoveredIndex].x}
              cy={chartData.data[hoveredIndex].bodyTop}
              r={4}
              fill="#1A1A1A"
            />
            <foreignObject
              x={chartData.data[hoveredIndex].x - 80}
              y={chartData.padding - 50}
              width="160"
              height="40"
            >
              <div className="bg-white rounded-lg px-3 py-2 shadow-lg border border-black/10">
                <div className="text-xs text-slate-700 font-medium">
                  {new Date(chartData.data[hoveredIndex].time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
                <div className="text-xs text-slate-900 font-semibold">
                  ${chartData.data[hoveredIndex].close.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </foreignObject>
          </>
        )}
      </svg>
    </div>
  );
}

