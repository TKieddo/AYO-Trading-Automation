import { Badge } from "../atoms/Badge";

interface MarketPairCardProps {
  pair: string[];
  changePercent: string;
  value: string;
  sliderValue: number; // 0-100
  price: string;
}

export function MarketPairCard({ 
  pair, 
  changePercent, 
  value, 
  sliderValue,
  price 
}: MarketPairCardProps) {
  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-2">
          {pair.map((token, index) => (
            <Badge key={index} variant="gray">{token}</Badge>
          ))}
        </div>
        <span className="text-green-400 text-xs">{changePercent}</span>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 bg-gray-700 rounded flex items-center justify-center">
          <span className="text-white text-xs font-bold">X</span>
        </div>
        <span className="text-white font-semibold">{value}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-yellow-400 transition-all duration-300" 
            style={{ width: `${sliderValue}%` }}
          ></div>
        </div>
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        <span className="text-white text-xs">{price}</span>
      </div>
    </div>
  );
}
