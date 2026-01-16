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
            <span className="text-lime-600 font-medium">High: ${highValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          )}
          {lowValue !== undefined && (
            <span className="text-orange-600 font-medium">Low: ${lowValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          )}
        </div>
      )}
      <div className={`flex justify-between gap-0.5 h-28 relative ${showProfitLoss ? '' : 'items-end'}`}>
        {data.map((value, index) => {
          const isPositive = value >= 0;
          const isHighest = showProfitLoss && index === highestIndex;
          const isLowest = showProfitLoss && index === lowestIndex;
          const barHeight = showProfitLoss 
            ? (Math.abs(value) / maxAbsValue) * 50 
            : (value / maxHeight) * 100;
          
          return (
            <div key={index} className="flex-1 flex flex-col items-center relative h-full pb-6">
              {showProfitLoss ? (
                <div className="w-full h-full relative flex items-center justify-center">
                  {/* Positive bar (profit) - grows upward from center */}
                  {isPositive && (
                    <div
                      className={`w-full rounded-t transition-all absolute ${
                        isHighest 
                          ? "bg-lime-500 ring-2 ring-lime-300" 
                          : "bg-lime-400"
                      }`}
                      style={{ 
                        height: `${barHeight}%`,
                        bottom: '50%',
                        minHeight: value > 0 ? '2px' : '0'
                      }}
                      title={`$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    ></div>
                  )}
                  {/* Negative bar (loss) - grows downward from center */}
                  {!isPositive && (
                    <div
                      className={`w-full rounded-b transition-all absolute ${
                        isLowest 
                          ? "bg-orange-500 ring-2 ring-orange-300" 
                          : "bg-orange-400"
                      }`}
                      style={{ 
                        height: `${barHeight}%`,
                        top: '50%',
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
              <span className="text-slate-500 text-[8px] text-center leading-tight absolute bottom-0">{labels[index]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
