interface BarChartProps {
  data: number[];
  labels: string[];
  maxValue?: string;
  title?: string;
  showProfitLoss?: boolean;
  highValue?: number;
  lowValue?: number;
}

export function BarChart({ 
  data, 
  labels, 
  maxValue, 
  title, 
  showProfitLoss = false,
  highValue,
  lowValue
}: BarChartProps) {
  // For profit/loss charts, we need to handle positive and negative values
  const allValues = showProfitLoss ? [...data, ...(data.map(v => -Math.abs(v)))] : data;
  const maxAbsValue = Math.max(...allValues.map(Math.abs));
  const minValue = showProfitLoss ? Math.min(...data) : 0;
  const maxHeight = showProfitLoss ? maxAbsValue : Math.max(...data);
  
  // Find the highest and lowest points
  const highestIndex = data.indexOf(Math.max(...data));
  const lowestIndex = data.indexOf(Math.min(...data));
  
  return (
    <div>
      {title && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-slate-500 text-[10px]">{title}</span>
          {maxValue && <span className="text-slate-900 text-[10px] font-semibold">{maxValue}</span>}
        </div>
      )}
      {showProfitLoss && (highValue !== undefined || lowValue !== undefined) && (
        <div className="flex items-center justify-between mb-1 text-[9px]">
          {highValue !== undefined && (
            <span className="text-green-600 font-medium">High: ${highValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          )}
          {lowValue !== undefined && (
            <span className="text-red-600 font-medium">Low: ${lowValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          )}
        </div>
      )}
      <div className={`flex justify-between gap-0.5 h-28 relative ${showProfitLoss ? '' : 'items-end'}`}>
        {/* Zero line for profit/loss chart - positioned at exact center */}
        {showProfitLoss && (
          <div className="absolute left-0 right-0 top-1/2 h-px bg-slate-300 z-10" style={{ transform: 'translateY(-0.5px)' }}></div>
        )}
        
        {data.map((value, index) => {
          const isPositive = value >= 0;
          const isHighest = showProfitLoss && index === highestIndex;
          const isLowest = showProfitLoss && index === lowestIndex;
          const barHeight = showProfitLoss 
            ? (Math.abs(value) / maxAbsValue) * 50 
            : (value / maxHeight) * 100;
          
          return (
            <div key={index} className="flex-1 flex flex-col items-center relative" style={{ height: 'calc(100% - 24px)' }}>
              {showProfitLoss ? (
                <div className="w-full h-full relative">
                  {/* Positive bar (profit) - grows upward from center, bottom edge aligns with zero line */}
                  {isPositive && (
                    <div
                      className={`w-full rounded-t transition-all absolute ${
                        isHighest 
                          ? "bg-green-500 ring-2 ring-green-300" 
                          : "bg-green-400"
                      }`}
                      style={{ 
                        height: `${barHeight}%`,
                        bottom: 'calc(50% - 0.5px)',
                        minHeight: value > 0 ? '2px' : '0'
                      }}
                      title={`$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    ></div>
                  )}
                  {/* Negative bar (loss) - grows downward from center, top edge aligns with zero line */}
                  {!isPositive && (
                    <div
                      className={`w-full rounded-b transition-all absolute ${
                        isLowest 
                          ? "bg-red-500 ring-2 ring-red-300" 
                          : "bg-red-400"
                      }`}
                      style={{ 
                        height: `${barHeight}%`,
                        top: 'calc(50% - 0.5px)',
                        minHeight: value < 0 ? '2px' : '0'
                      }}
                      title={`$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    ></div>
                  )}
                </div>
              ) : (
                <div
                  className={`w-full rounded-t ${
                    index % 2 === 0 ? "bg-yellow-400" : "bg-slate-400"
                  }`}
                  style={{ height: `${barHeight}%` }}
                ></div>
              )}
              <span className="text-slate-500 text-[8px] text-center leading-tight absolute bottom-0" style={{ bottom: '-20px' }}>{labels[index]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
