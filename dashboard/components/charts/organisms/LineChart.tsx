"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";

type LineData = {
  time: string;
  value: number;
  timestamp?: number;
};

type LineChartProps = {
  data: LineData[];
  width?: number;
  height?: number;
  currentPrice?: number;
  entryPrice?: number;
};

export function LineChart({ data, width = 800, height = 320, currentPrice, entryPrice }: LineChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  // Pan and zoom state
  const [panOffset, setPanOffset] = useState(0); // Horizontal pan offset (in data points)
  const [zoomLevel, setZoomLevel] = useState(1); // Zoom level (1 = no zoom, >1 = zoomed in)
  const [isPanning, setIsPanning] = useState(false);
  const [panStartX, setPanStartX] = useState(0);
  const [panStartOffset, setPanStartOffset] = useState(0);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  
  // Calculate visible data range based on pan and zoom
  const visibleDataRange = useMemo(() => {
    if (!data || data.length === 0) return { start: 0, end: 0, visibleData: [], totalPoints: 0, visiblePoints: 0 };
    
    const totalPoints = data.length;
    const visiblePoints = Math.floor(totalPoints / zoomLevel);
    const maxPanOffset = Math.max(0, totalPoints - visiblePoints);
    const clampedPanOffset = Math.min(maxPanOffset, Math.max(0, panOffset));
    
    const start = Math.floor(clampedPanOffset);
    const end = Math.min(totalPoints, start + visiblePoints);
    
    return {
      start,
      end,
      visibleData: data.slice(start, end),
      totalPoints,
      visiblePoints,
    };
  }, [data, zoomLevel, panOffset]);
  
  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left mouse button
    setIsPanning(true);
    setPanStartX(e.clientX);
    setPanStartOffset(panOffset);
    e.preventDefault();
  }, [panOffset]);
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isPanning || !visibleDataRange.totalPoints) return;
    
    const deltaX = e.clientX - panStartX;
    const chartWidthPixels = width * 0.8; // Approximate chart area width
    const dataPointsPerPixel = visibleDataRange.totalPoints / chartWidthPixels;
    const deltaPoints = -deltaX * dataPointsPerPixel; // Negative for natural scrolling
    
    const newOffset = panStartOffset + deltaPoints;
    const maxPanOffset = Math.max(0, visibleDataRange.totalPoints - visibleDataRange.visiblePoints);
    setPanOffset(Math.min(maxPanOffset, Math.max(0, newOffset)));
  }, [isPanning, panStartX, panStartOffset, visibleDataRange, width]);
  
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);
  
  // Zoom handler
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1; // Zoom out on scroll down, zoom in on scroll up
    const newZoom = Math.max(1, Math.min(10, zoomLevel + delta)); // Limit zoom between 1x and 10x
    
    if (newZoom !== zoomLevel) {
      // Calculate mouse position relative to chart
      const rect = chartContainerRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = e.clientX - rect.left;
        const mouseDataIndex = Math.floor((mouseX / rect.width) * visibleDataRange.visiblePoints + visibleDataRange.start);
        
        setZoomLevel(newZoom);
        
        // Adjust pan to keep the point under mouse in view
        const newVisiblePoints = Math.floor(visibleDataRange.totalPoints / newZoom);
        const newPanOffset = Math.max(0, Math.min(
          visibleDataRange.totalPoints - newVisiblePoints,
          mouseDataIndex - (mouseX / rect.width) * newVisiblePoints
        ));
        setPanOffset(newPanOffset);
      } else {
        setZoomLevel(newZoom);
      }
    }
  }, [zoomLevel, visibleDataRange]);
  
  // Cleanup mouse events
  useEffect(() => {
    if (isPanning) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isPanning, handleMouseMove, handleMouseUp]);
  
  // Reset pan/zoom when data changes significantly
  useEffect(() => {
    setPanOffset(0);
    setZoomLevel(1);
  }, [data.length]);
  
  // Use currentPrice if provided (most precise), otherwise use the last data point value
  const displayPrice = currentPrice !== undefined ? currentPrice : (data.length > 0 ? data[data.length - 1].value : 0);
  
  // Default entry price to first data point if not provided
  const entryPriceValue = entryPrice !== undefined ? entryPrice : (data.length > 0 ? data[0].value : displayPrice);
  
  // Determine if price is going up or down relative to entry
  const isPriceAboveEntry = displayPrice > entryPriceValue;

  const chartData = useMemo(() => {
    if (!visibleDataRange.visibleData || visibleDataRange.visibleData.length === 0) return null;

    const prices = visibleDataRange.visibleData.map(d => d.value);
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    const priceRange = maxPrice - minPrice || 1;

    const leftPadding = 50; // Space on left for Y-axis labels
    const rightPadding = 15; // Small padding on right to keep badge visible
    const topPadding = 30;
    const bottomPadding = 40; // Space for X-axis labels
    const chartWidth = width - leftPadding - rightPadding;
    const chartHeight = height - topPadding - bottomPadding;

    const points = visibleDataRange.visibleData.map((d, i) => ({
      ...d,
      x: leftPadding + (i / (visibleDataRange.visibleData.length - 1 || 1)) * chartWidth,
      y: topPadding + chartHeight - ((d.value - minPrice) / priceRange) * chartHeight,
    }));

    // Create gradient path
    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPath = `${pathData} L ${points[points.length - 1].x} ${topPadding + chartHeight} L ${points[0].x} ${topPadding + chartHeight} Z`;

    // Find ALL crossing points where price crosses entry price (both directions)
    type Crossing = { index: number; x: number; y: number; direction: 'down' | 'up' };
    const crossings: Crossing[] = [];
    
    if (entryPrice !== undefined) {
      // Find all crossing points
      for (let i = 1; i < points.length; i++) {
          const p1 = points[i - 1];
          const p2 = points[i];
        
        // Crossing from above entry to below entry (going down)
          if (p1.value >= entryPrice && p2.value < entryPrice) {
          const t = (entryPrice - p1.value) / (p2.value - p1.value || 1);
          crossings.push({
            index: i - 1,
            x: p1.x + (p2.x - p1.x) * t,
            y: p1.y + (p2.y - p1.y) * t,
            direction: 'down'
          });
        }
        // Crossing from below entry to above entry (going up)
        else if (p1.value < entryPrice && p2.value >= entryPrice) {
          const t = (entryPrice - p1.value) / (p2.value - p1.value || 1);
          crossings.push({
            index: i - 1,
            x: p1.x + (p2.x - p1.x) * t,
            y: p1.y + (p2.y - p1.y) * t,
            direction: 'up'
          });
        }
      }
    }

    // Build green and red path segments based on crossings
    let greenPathData = '';
    let redPathData = '';
    let greenAreaPaths: string[] = [];
    let redAreaPaths: string[] = [];
    
    if (entryPrice !== undefined && points.length > 0) {
      // Determine starting color based on first point
      const startIsGreen = points[0].value >= entryPrice;
      
      // If no crossings, entire line is one color
      if (crossings.length === 0) {
        if (startIsGreen) {
          greenPathData = pathData;
          greenAreaPaths = [areaPath];
        } else {
          redPathData = pathData;
          redAreaPaths = [areaPath];
        }
      } else {
        // Build segments between crossings
        let currentIsGreen = startIsGreen;
        let segmentStart = 0;
        
        for (let c = 0; c <= crossings.length; c++) {
          const crossing = crossings[c];
          const segmentEnd = crossing ? crossing.index + 1 : points.length;
          
          // Get points for this segment (exclude the point after crossing, as it's in next segment)
          const segmentPoints = points.slice(segmentStart, Math.min(segmentEnd, points.length));
          
          if (segmentPoints.length > 0) {
            let segmentPath = '';
            if (segmentStart === 0) {
              // First segment - start from first point
              segmentPath = segmentPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
              if (crossing) {
                // Add crossing point to complete the segment
                segmentPath += ` L ${crossing.x} ${crossing.y}`;
              } else if (segmentEnd === points.length) {
                // Last segment, include final point
                const finalPoint = points[points.length - 1];
                if (segmentPoints[segmentPoints.length - 1] !== finalPoint) {
                  segmentPath += ` L ${finalPoint.x} ${finalPoint.y}`;
                }
              }
            } else {
              // Subsequent segments start from previous crossing
              const prevCrossing = crossings[c - 1];
              segmentPath = `M ${prevCrossing.x} ${prevCrossing.y}`;
              // Add all points in this segment
              segmentPath += segmentPoints.map((p) => ` L ${p.x} ${p.y}`).join(' ');
              if (crossing) {
                // Add crossing point
                segmentPath += ` L ${crossing.x} ${crossing.y}`;
              } else if (segmentEnd === points.length) {
                // Last segment, ensure we include final point
                const finalPoint = points[points.length - 1];
                if (segmentPoints.length === 0 || segmentPoints[segmentPoints.length - 1] !== finalPoint) {
                  segmentPath += ` L ${finalPoint.x} ${finalPoint.y}`;
                }
              }
            }
            
            // Create area path for this segment
            const firstPoint = segmentPoints[0];
            const lastPoint = segmentPoints.length > 0 ? segmentPoints[segmentPoints.length - 1] : points[segmentStart];
            const areaStartX = segmentStart === 0 ? firstPoint.x : crossings[c - 1].x;
            const areaEndX = crossing ? crossing.x : (points[points.length - 1].x);
            
            let segmentAreaPath = segmentPath;
            segmentAreaPath += ` L ${areaEndX} ${topPadding + chartHeight} L ${areaStartX} ${topPadding + chartHeight} Z`;
            
            if (currentIsGreen) {
              greenPathData += (greenPathData ? ' ' : '') + segmentPath;
              greenAreaPaths.push(segmentAreaPath);
            } else {
              redPathData += (redPathData ? ' ' : '') + segmentPath;
              redAreaPaths.push(segmentAreaPath);
            }
          }
          
          segmentStart = crossing ? crossing.index + 1 : points.length;
          if (crossing) {
            currentIsGreen = crossing.direction === 'up'; // Flip color after crossing
          }
        }
      }
    } else {
      // No entry price, all green
      greenPathData = pathData;
      greenAreaPaths = [areaPath];
    }

    return {
      points,
      pathData,
      greenPathData,
      redPathData,
      areaPath,
      greenAreaPaths,
      redAreaPaths,
      minPrice,
      maxPrice,
      priceRange,
      leftPadding,
      rightPadding,
      topPadding,
      bottomPadding,
      chartWidth,
      chartHeight,
    };
  }, [visibleDataRange.visibleData, width, height, entryPrice, displayPrice]);

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

  // Format Y-axis labels - support from 0.01 to 1M
  const formatPrice = (price: number) => {
    if (price >= 1000000) return `${(price / 1000000).toFixed(2)}M`;
    if (price >= 1000) return `${(price / 1000).toFixed(price >= 10000 ? 0 : 1)}k`;
    if (price >= 1) return price.toFixed(2);
    if (price >= 0.1) return price.toFixed(3);
    if (price >= 0.01) return price.toFixed(4);
    return price.toFixed(6);
  };

  // Generate X-axis labels (time) - evenly spaced with max 7-8 labels
  const xAxisLabels = useMemo(() => {
    if (!chartData || visibleDataRange.visibleData.length === 0) return [];
    
    const labels: Array<{ index: number; time: string; x: number }> = [];
    
    // Always show max 8 labels (or less if we don't have enough data points)
    const maxLabels = Math.min(8, visibleDataRange.visibleData.length);
    const numLabels = Math.max(2, maxLabels); // At least 2 labels (start and end)
    
    // Calculate evenly spaced X positions
    const startX = chartData.leftPadding;
    const endX = chartData.leftPadding + chartData.chartWidth;
    const totalWidth = chartData.chartWidth;
    const spacing = totalWidth / (numLabels - 1); // Equal spacing between labels
    
    // Generate evenly spaced X positions
    const xPositions: number[] = [];
    for (let i = 0; i < numLabels; i++) {
      xPositions.push(startX + (i * spacing));
    }
    
    // Map X positions to data indices
    for (let i = 0; i < xPositions.length; i++) {
      const x = xPositions[i];
      
      // Calculate which data point corresponds to this X position
      // X position relative to chart start
      const relativeX = x - chartData.leftPadding;
      // Calculate index in visible data
      const normalizedPosition = Math.max(0, Math.min(1, relativeX / chartData.chartWidth));
      const dataIndex = Math.round(normalizedPosition * (visibleDataRange.visibleData.length - 1));
      
      // Clamp to valid range
      const clampedIndex = Math.max(0, Math.min(visibleDataRange.visibleData.length - 1, dataIndex));
      
      labels.push({
        index: clampedIndex,
        time: visibleDataRange.visibleData[clampedIndex].time,
        x: x
      });
    }
    
    // Ensure first and last labels are at exact positions with correct data
    if (labels.length > 0) {
      labels[0] = {
        index: 0,
        time: visibleDataRange.visibleData[0].time,
        x: startX
      };
      
      const lastIndex = visibleDataRange.visibleData.length - 1;
      labels[labels.length - 1] = {
        index: lastIndex,
        time: visibleDataRange.visibleData[lastIndex].time,
        x: endX
      };
    }
    
    return labels;
  }, [chartData, visibleDataRange.visibleData]);

  return (
    <div 
      ref={chartContainerRef}
      className="relative w-full h-full"
      onMouseDown={handleMouseDown}
      onWheel={handleWheel}
      style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
    >
      {/* Zoom/Pan indicator */}
      {(zoomLevel > 1 || panOffset > 0) && (
        <div className="absolute top-2 right-2 z-10 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-3 text-xs text-white">
          <div className="flex items-center gap-1.5">
            <span className="opacity-70">Zoom:</span>
            <span className="font-semibold">{zoomLevel.toFixed(1)}x</span>
          </div>
          {panOffset > 0 && (
            <div className="flex items-center gap-1.5 border-l border-white/20 pl-3">
              <span className="opacity-70">View:</span>
              <span className="font-semibold">
                {Math.floor((panOffset / visibleDataRange.totalPoints) * 100)}% - {Math.floor(((panOffset + visibleDataRange.visiblePoints) / visibleDataRange.totalPoints) * 100)}%
              </span>
            </div>
          )}
          <button
            onClick={() => {
              setPanOffset(0);
              setZoomLevel(1);
            }}
            className="ml-2 px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-[10px] transition-colors"
            title="Reset view"
          >
            Reset
          </button>
        </div>
      )}
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className="w-full h-full">
        <defs>
          {/* Neon glow filter for green */}
          <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          
          {/* Neon glow filter for red */}
          <filter id="neonGlowRed" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          
          {/* Stronger glow for outer effect - green */}
          <filter id="neonGlowOuter" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" result="outerGlow"/>
            <feMerge>
              <feMergeNode in="outerGlow"/>
            </feMerge>
          </filter>
          
          {/* Stronger glow for outer effect - red */}
          <filter id="neonGlowOuterRed" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" result="outerGlow"/>
            <feMerge>
              <feMergeNode in="outerGlow"/>
            </feMerge>
          </filter>
          
          {/* Gradient for green area */}
          <linearGradient id="lineGradientGreen" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#50C878" stopOpacity={0.3} />
            <stop offset="50%" stopColor="#50C878" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#50C878" stopOpacity={0.05} />
          </linearGradient>
          
          {/* Gradient for red area */}
          <linearGradient id="lineGradientRed" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FF6B6B" stopOpacity={0.3} />
            <stop offset="50%" stopColor="#FF6B6B" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#FF6B6B" stopOpacity={0.05} />
          </linearGradient>
          
          {/* Gradient for arrow circle background when price is above entry (green/yellow) */}
          <linearGradient id="arrowGradientGreen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d9f08f" />
            <stop offset="50%" stopColor="#c0e156" />
            <stop offset="100%" stopColor="#9cc32a" />
          </linearGradient>
          
          {/* Gradient for arrow circle background when price is below entry (red) */}
          <linearGradient id="arrowGradientRed" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF6B6B" />
            <stop offset="50%" stopColor="#FF4444" />
            <stop offset="100%" stopColor="#CC0000" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yAxisLabels.map((price, i) => {
          const y = chartData.topPadding + (chartData.chartHeight / (numLabels - 1)) * i;
          return (
            <g key={`grid-${i}`}>
              <line
                x1={chartData.leftPadding}
                y1={y}
                x2={chartData.leftPadding + chartData.chartWidth}
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
          return (
            <g key={`x-grid-${i}`}>
              <line
                x1={label.x}
                y1={chartData.topPadding}
                x2={label.x}
                y2={chartData.topPadding + chartData.chartHeight}
                stroke="#E0E0E0"
                strokeWidth={1}
                strokeDasharray="2,2"
                opacity={0.5}
              />
            </g>
          );
        })}

        {/* Gradient area under line - removed per user request */}

        {/* Green line segment (before crossing entry price) */}
        {chartData.greenPathData && chartData.greenPathData.length > 0 && (
          <>
            {/* Outer glow layer - green */}
            <path
              d={chartData.greenPathData}
              fill="none"
              stroke="#50C878"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#neonGlowOuter)"
              opacity="0.4"
            />
            
            {/* Main glowing neon line - green */}
            <path
              d={chartData.greenPathData}
              fill="none"
              stroke="#50C878"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#neonGlow)"
            />
            
            {/* Inner bright line for core glow - green */}
            <path
              d={chartData.greenPathData}
              fill="none"
              stroke="#7FFFD4"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}
        
        {/* Red line segment (after crossing entry price) */}
        {chartData.redPathData && chartData.redPathData.length > 0 && (
          <>
            {/* Outer glow layer - red */}
            <path
              d={chartData.redPathData}
              fill="none"
              stroke="#FF6B6B"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#neonGlowOuterRed)"
              opacity="0.4"
            />
            
            {/* Main glowing neon line - red */}
            <path
              d={chartData.redPathData}
              fill="none"
              stroke="#FF6B6B"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#neonGlowRed)"
            />
            
            {/* Inner bright line for core glow - red */}
            <path
              d={chartData.redPathData}
              fill="none"
              stroke="#FF9999"
              strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
            />
          </>
        )}

        {/* Horizontal dashed price line with badge - precise calculation */}
        {(() => {
          // Get the actual end point of the graph line (last point in visible data)
          const lastPoint = chartData.points.length > 0 ? chartData.points[chartData.points.length - 1] : null;
          
          // Use the last point's Y position, or fallback to current price calculation
          const lineEndY = lastPoint ? lastPoint.y : (() => {
          const normalizedPrice = (displayPrice - chartData.minPrice) / chartData.priceRange;
            return chartData.topPadding + chartData.chartHeight - (normalizedPrice * chartData.chartHeight);
          })();
          
          // Clamp Y to chart bounds to ensure it's always visible
          const clampedY = Math.max(chartData.topPadding, Math.min(chartData.topPadding + chartData.chartHeight, lineEndY));
          
          return (
            <g>
              {/* Horizontal dashed line */}
              <line
                x1={chartData.leftPadding}
                y1={clampedY}
                x2={chartData.leftPadding + chartData.chartWidth}
                y2={clampedY}
                stroke="#1A1A1A"
                strokeWidth={1}
                strokeDasharray="4,3"
                opacity={0.6}
              />
              
              {/* Current price badge - rectangular with rounded corners, positioned at end of graph line */}
              <g>
                {/* Badge positioned to the left of the right edge so line end is visible */}
                {(() => {
                  // Position badge further left so graph line end is visible
                  const badgeX = chartData.leftPadding + chartData.chartWidth - 120; // Moved 25px more left
                  const badgeY = clampedY - 14; // Adjusted to accommodate taller badge
                  const badgeWidth = 100; // Slightly wider to fit text better
                  const badgeHeight = 32; // Increased from 24 to 32 to fit all text
                  const radius = 8;
                  
                  // Calculate text width to ensure it fits
                  const priceText = `$${displayPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  // Approximate text width: ~6px per character for fontSize 12
                  const priceTextWidth = priceText.length * 6;
                  const arrowWidth = 10; // Space for arrow
                  const padding = 8; // Left and right padding
                  const minWidth = arrowWidth + priceTextWidth + (padding * 2);
                  
                  // Use calculated width or minimum width, but cap at reasonable max
                  const actualWidth = Math.max(minWidth, Math.min(100, badgeWidth));
                  
                  return (
                    <>
                      {/* Main badge background - black rounded rectangle, no border */}
                      <rect
                        x={badgeX}
                        y={badgeY}
                        width={actualWidth}
                        height={badgeHeight}
                        rx={radius}
                        ry={radius}
                        fill="#1A1A1A"
                        fillOpacity="0.95"
                        className="drop-shadow-lg"
                      />
                      
                      {/* Circular background with gradient - green when above entry, red when below */}
                      <circle
                        cx={badgeX + 20}
                        cy={clampedY}
                        r="10"
                        fill={isPriceAboveEntry ? "url(#arrowGradientGreen)" : "url(#arrowGradientRed)"}
                        className="drop-shadow-sm"
                      />
                      
                      {/* Arrow direction changes based on entry price position */}
                      {isPriceAboveEntry ? (
                        /* Upward-facing arrow (when price is above entry) */
                        <path
                          d={`M ${badgeX + 20} ${clampedY - 5}
                              L ${badgeX + 15} ${clampedY + 1}
                              L ${badgeX + 17} ${clampedY + 1}
                              L ${badgeX + 17} ${clampedY + 5}
                              L ${badgeX + 23} ${clampedY + 5}
                              L ${badgeX + 23} ${clampedY + 1}
                              L ${badgeX + 25} ${clampedY + 1}
                              Z`}
                          fill="#1A1A1A"
                        />
                      ) : (
                        /* Downward-facing arrow (when price is below entry) */
                        <path
                          d={`M ${badgeX + 20} ${clampedY + 5}
                              L ${badgeX + 15} ${clampedY - 1}
                              L ${badgeX + 17} ${clampedY - 1}
                              L ${badgeX + 17} ${clampedY - 5}
                              L ${badgeX + 23} ${clampedY - 5}
                              L ${badgeX + 23} ${clampedY - 1}
                              L ${badgeX + 25} ${clampedY - 1}
                              Z`}
                          fill="#1A1A1A"
                        />
                      )}
                      
                      {/* Price text - white for contrast, positioned to fit */}
                <text
                        x={badgeX + 35}
                        y={clampedY + 2}
                  textAnchor="start"
                  fill="white"
                        fontSize="12"
                        fontWeight="700"
                  className="font-sans"
                        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                >
                        {priceText}
                </text>
                
                      {/* "Current" label */}
                <text
                        x={badgeX + 35}
                        y={clampedY + 12}
                  textAnchor="start"
                        fill="rgba(255,255,255,0.85)"
                  fontSize="9"
                        fontWeight="500"
                  className="font-sans"
                >
                        Current
                </text>
                    </>
                  );
                })()}
              </g>
              
              {/* Entry price badge on the left side - fixed position */}
              {(() => {
                const entryY = chartData.topPadding + chartData.chartHeight - ((entryPriceValue - chartData.minPrice) / chartData.priceRange) * chartData.chartHeight;
                const clampedEntryY = Math.max(chartData.topPadding, Math.min(chartData.topPadding + chartData.chartHeight, entryY));
                
                return (
                  <>
                    {/* Horizontal dashed line for entry price - more visible */}
                    <line
                      x1={chartData.leftPadding}
                      x2={chartData.leftPadding + chartData.chartWidth}
                      y1={clampedEntryY}
                      y2={clampedEntryY}
                      stroke="#8B5CF6"
                      strokeWidth={1.5}
                      strokeDasharray="6,4"
                      opacity={0.6}
                    />
                    
                    {/* Glow effect behind entry badge */}
                    <ellipse
                      cx={chartData.leftPadding - 37.5}
                      cy={clampedEntryY}
                      rx="32"
                      ry="11"
                      fill="#8B5CF6"
                      opacity="0.2"
                    />
                    
                    {/* Entry price badge on the left - more prominent with rounded corners and arrow */}
                    <path
                      d={`M ${chartData.leftPadding - 70} ${clampedEntryY - 11}
                          Q ${chartData.leftPadding - 70} ${clampedEntryY - 11} ${chartData.leftPadding - 70} ${clampedEntryY - 11}
                          L ${chartData.leftPadding - 12} ${clampedEntryY - 11}
                          Q ${chartData.leftPadding - 7} ${clampedEntryY - 11} ${chartData.leftPadding - 5} ${clampedEntryY - 6}
                          L ${chartData.leftPadding - 3} ${clampedEntryY}
                          Q ${chartData.leftPadding - 5} ${clampedEntryY + 6} ${chartData.leftPadding - 12} ${clampedEntryY + 11}
                          L ${chartData.leftPadding - 70} ${clampedEntryY + 11}
                          Q ${chartData.leftPadding - 70} ${clampedEntryY + 11} ${chartData.leftPadding - 70} ${clampedEntryY + 11}
                          Z`}
                      fill="#8B5CF6"
                      fillOpacity="0.95"
                      stroke="#8B5CF6"
                      strokeWidth="1.5"
                      className="drop-shadow-lg"
                    />
                    
                    {/* Entry label */}
                    <text
                      x={chartData.leftPadding - 41}
                      y={clampedEntryY - 4}
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.9)"
                      fontSize="8"
                      fontWeight="500"
                      className="font-sans"
                    >
                      Entry
                    </text>
                    
                    {/* Entry price text */}
                    <text
                      x={chartData.leftPadding - 41}
                      y={clampedEntryY + 6}
                      textAnchor="middle"
                      fill="white"
                      fontSize="10"
                      fontWeight="700"
                      className="font-sans"
                      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                    >
                      {formatPrice(entryPriceValue)}
                    </text>
                  </>
                );
              })()}
            </g>
          );
        })()}

        {/* Hover indicator - smaller premium badge, positioned lower */}
        {hoveredIndex !== null && chartData.points[hoveredIndex] && (
          <>
            <line
              x1={chartData.points[hoveredIndex].x}
              y1={chartData.topPadding}
              x2={chartData.points[hoveredIndex].x}
              y2={chartData.topPadding + chartData.chartHeight}
              stroke="#1A1A1A"
              strokeWidth={1}
              strokeDasharray="4,2"
              opacity={0.5}
            />
            <circle
              cx={chartData.points[hoveredIndex].x}
              cy={chartData.points[hoveredIndex].y}
              r={4}
              fill="#1A1A1A"
            />
            {/* Smaller premium badge - narrower with reduced padding */}
            <rect
              x={chartData.points[hoveredIndex].x - 42}
              y={chartData.points[hoveredIndex].y - 26}
              width="84"
              height="26"
              rx="10"
              fill="#01525a"
              opacity={0.95}
              className="drop-shadow-sm"
            />
            <text
              x={chartData.points[hoveredIndex].x}
              y={chartData.points[hoveredIndex].y - 14}
              textAnchor="middle"
              fill="white"
              fontSize="9"
              fontWeight="500"
              className="font-sans"
            >
              {visibleDataRange.visibleData[hoveredIndex].time}
            </text>
            <text
              x={chartData.points[hoveredIndex].x}
              y={chartData.points[hoveredIndex].y - 3}
              textAnchor="middle"
              fill="white"
              fontSize="9"
              fontWeight="600"
              className="font-sans"
            >
              ${visibleDataRange.visibleData[hoveredIndex].value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </text>
          </>
        )}

        {/* Invisible hover areas */}
        {chartData.points.map((p, i) => (
          <rect
            key={i}
            x={i > 0 ? (chartData.points[i - 1].x + p.x) / 2 : chartData.leftPadding}
            y={chartData.topPadding}
            width={i < chartData.points.length - 1 ? (chartData.points[i + 1].x - (i > 0 ? chartData.points[i - 1].x : chartData.leftPadding)) / 2 : chartData.leftPadding + chartData.chartWidth - p.x}
            height={chartData.chartHeight}
            fill="transparent"
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
            style={{ cursor: isPanning ? 'grabbing' : 'pointer' }}
          />
        ))}

        {/* Y-axis price labels */}
        {yAxisLabels.map((price, i) => {
          const y = chartData.topPadding + (chartData.chartHeight / (numLabels - 1)) * i;
          return (
            <g key={`y-label-${i}`}>
              <text
                x={chartData.leftPadding - 10}
                y={y + 4}
                fill="#AAAAAA"
                fontSize="11"
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
          return (
            <g key={`x-label-${i}`}>
              <text
                x={label.x}
                y={chartData.topPadding + chartData.chartHeight + 20}
                fill="#AAAAAA"
                fontSize="11"
                textAnchor={i === 0 ? "start" : i === xAxisLabels.length - 1 ? "end" : "middle"}
                className="font-sans"
              >
                {label.time}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

