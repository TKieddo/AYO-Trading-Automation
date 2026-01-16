interface BarChartProps {
  data: number[];
  labels: string[];
  maxValue?: string;
  title?: string;
}

export function BarChart({ data, labels, maxValue, title }: BarChartProps) {
  const maxHeight = Math.max(...data);
  
  return (
    <div>
      {title && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-xs">{title}</span>
          {maxValue && <span className="text-white text-xs">{maxValue}</span>}
        </div>
      )}
      <div className="flex items-end justify-between gap-1 h-32">
        {data.map((value, index) => (
          <div key={index} className="flex-1 flex flex-col items-center">
            <div
              className={`w-full rounded-t ${
                index % 2 === 0 ? "bg-yellow-400" : "bg-gray-700"
              }`}
              style={{ height: `${(value / maxHeight) * 100}%` }}
            ></div>
            <span className="text-gray-400 text-xs mt-2">{labels[index]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
