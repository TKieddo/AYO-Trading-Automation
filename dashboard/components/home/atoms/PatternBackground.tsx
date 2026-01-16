export function PatternBackground() {
  // Crypto/trading symbols and elements
  const symbols = ['X', 'O', '+', '/', '\\', ':', '-', '□', '▲', '▼', '●', '■'];
  const cryptoPairs = ['BTC', 'ETH', 'SOL', 'USDT', 'BNB', 'ADA', 'XRP', 'DOGE'];
  const numbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* SVG Pattern Layer - More visible */}
      <svg 
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 500 700"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Large geometric blocks - right side (reduced opacity) */}
        <rect x="320" y="40" width="100" height="140" fill="#84cc16" opacity="0.15" rx="6" />
        <rect x="360" y="220" width="80" height="120" fill="#84cc16" opacity="0.12" rx="5" />
        <rect x="340" y="420" width="110" height="100" fill="#84cc16" opacity="0.14" rx="6" />
        <rect x="380" y="550" width="70" height="90" fill="#84cc16" opacity="0.11" rx="4" />
        
        {/* Bottom left blocks */}
        <rect x="20" y="480" width="90" height="120" fill="#84cc16" opacity="0.15" rx="6" />
        <rect x="40" y="580" width="60" height="80" fill="#84cc16" opacity="0.12" rx="4" />
        
        {/* Crypto pair labels scattered (reduced opacity) */}
        <text x="60" y="70" fontSize="11" fill="#84cc16" fontFamily="monospace" fontWeight="bold" opacity="0.20">BTC</text>
        <text x="180" y="110" fontSize="10" fill="#84cc16" fontFamily="monospace" opacity="0.18">ETH</text>
        <text x="250" y="160" fontSize="12" fill="#84cc16" fontFamily="monospace" fontWeight="bold" opacity="0.22">SOL</text>
        <text x="120" y="240" fontSize="9" fill="#84cc16" fontFamily="monospace" opacity="0.16">USDT</text>
        <text x="280" y="280" fontSize="11" fill="#84cc16" fontFamily="monospace" opacity="0.19">BNB</text>
        <text x="90" y="340" fontSize="10" fill="#84cc16" fontFamily="monospace" opacity="0.17">XRP</text>
        <text x="200" y="390" fontSize="13" fill="#84cc16" fontFamily="monospace" fontWeight="bold" opacity="0.21">ADA</text>
        <text x="140" y="500" fontSize="10" fill="#84cc16" fontFamily="monospace" opacity="0.18">DOGE</text>
        
        {/* Brand name and Forex (reduced opacity) */}
        <text x="220" y="80" fontSize="18" fill="#84cc16" fontFamily="monospace" fontWeight="bold" opacity="0.25">AYO</text>
        <text x="320" y="140" fontSize="16" fill="#84cc16" fontFamily="monospace" fontWeight="bold" opacity="0.23">FOREX</text>
        <text x="50" y="420" fontSize="17" fill="#84cc16" fontFamily="monospace" fontWeight="bold" opacity="0.22">AYO</text>
        <text x="380" y="480" fontSize="15" fill="#84cc16" fontFamily="monospace" fontWeight="bold" opacity="0.20">FOREX</text>
        <text x="150" y="250" fontSize="19" fill="#84cc16" fontFamily="monospace" fontWeight="bold" opacity="0.24">AYO</text>
        <text x="280" y="380" fontSize="16" fill="#84cc16" fontFamily="monospace" fontWeight="bold" opacity="0.21">FOREX</text>
        
        {/* Price-like numbers scattered (reduced opacity) */}
        <text x="350" y="100" fontSize="9" fill="#84cc16" fontFamily="monospace" opacity="0.14">$42,150</text>
        <text x="50" y="200" fontSize="8" fill="#84cc16" fontFamily="monospace" opacity="0.12">$2,850</text>
        <text x="220" y="320" fontSize="10" fill="#84cc16" fontFamily="monospace" opacity="0.16">$98.50</text>
        <text x="100" y="450" fontSize="9" fill="#84cc16" fontFamily="monospace" opacity="0.13">$0.52</text>
        <text x="300" y="520" fontSize="8" fill="#84cc16" fontFamily="monospace" opacity="0.11">$315</text>
        
        {/* Scattered symbols (reduced opacity) */}
        <text x="45" y="85" fontSize="18" fill="#84cc16" fontFamily="monospace" fontWeight="bold" opacity="0.25">X</text>
        <text x="160" y="130" fontSize="15" fill="#84cc16" fontFamily="monospace" opacity="0.20">O</text>
        <text x="230" y="190" fontSize="20" fill="#84cc16" fontFamily="monospace" fontWeight="bold" opacity="0.26">+</text>
        <text x="110" y="260" fontSize="13" fill="#84cc16" fontFamily="monospace" opacity="0.17">/</text>
        <text x="270" y="310" fontSize="16" fill="#84cc16" fontFamily="monospace" opacity="0.21">\</text>
        <text x="85" y="360" fontSize="14" fill="#84cc16" fontFamily="monospace" opacity="0.19">:</text>
        <text x="190" y="410" fontSize="19" fill="#84cc16" fontFamily="monospace" fontWeight="bold" opacity="0.23">▲</text>
        <text x="130" y="510" fontSize="15" fill="#84cc16" fontFamily="monospace" opacity="0.20">▼</text>
        <text x="240" y="560" fontSize="17" fill="#84cc16" fontFamily="monospace" fontWeight="bold" opacity="0.22">●</text>
        <text x="360" y="180" fontSize="14" fill="#84cc16" fontFamily="monospace" opacity="0.18">■</text>
        <text x="70" y="300" fontSize="16" fill="#84cc16" fontFamily="monospace" opacity="0.21">+</text>
        
        {/* Dense symbol clusters (reduced opacity) */}
        <g opacity="0.16">
          <text x="330" y="120" fontSize="11" fill="#84cc16" fontFamily="monospace" fontWeight="bold">X</text>
          <text x="345" y="120" fontSize="10" fill="#84cc16" fontFamily="monospace">O</text>
          <text x="360" y="120" fontSize="12" fill="#84cc16" fontFamily="monospace" fontWeight="bold">+</text>
          <text x="375" y="120" fontSize="11" fill="#84cc16" fontFamily="monospace">/</text>
          <text x="390" y="120" fontSize="10" fill="#84cc16" fontFamily="monospace">\</text>
        </g>
        
        <g opacity="0.18">
          <text x="30" y="220" fontSize="10" fill="#84cc16" fontFamily="monospace" fontWeight="bold">X</text>
          <text x="42" y="220" fontSize="9" fill="#84cc16" fontFamily="monospace">O</text>
          <text x="54" y="220" fontSize="10" fill="#84cc16" fontFamily="monospace" fontWeight="bold">X</text>
          <text x="66" y="220" fontSize="9" fill="#84cc16" fontFamily="monospace">O</text>
          <text x="78" y="220" fontSize="10" fill="#84cc16" fontFamily="monospace">+</text>
        </g>
        
        <g opacity="0.14">
          <text x="380" y="350" fontSize="11" fill="#84cc16" fontFamily="monospace">▲</text>
          <text x="395" y="350" fontSize="10" fill="#84cc16" fontFamily="monospace">▼</text>
          <text x="410" y="350" fontSize="11" fill="#84cc16" fontFamily="monospace">●</text>
          <text x="425" y="350" fontSize="10" fill="#84cc16" fontFamily="monospace">■</text>
        </g>
        
        {/* Circuit-like connecting lines (reduced opacity) */}
        <g stroke="#84cc16" strokeWidth="2" opacity="0.12" fill="none">
          <path d="M 50 100 L 150 125 L 200 85 L 250 105 L 300 95" />
          <path d="M 100 300 L 180 285 L 220 325 L 280 305 L 340 295" />
          <path d="M 150 450 L 200 435 L 250 475 L 300 455 L 360 445" />
          <path d="M 80 200 L 120 180 L 160 220" />
        </g>
        
        {/* Trading chart-like elements (reduced opacity) */}
        <g stroke="#84cc16" strokeWidth="2.5" opacity="0.10" fill="none">
          {/* Candlestick-like shapes */}
          <line x1="380" y1="250" x2="380" y2="280" />
          <rect x="375" y="250" width="10" height="8" fill="#84cc16" opacity="0.08" />
          <line x1="420" y1="380" x2="420" y2="410" />
          <rect x="415" y="380" width="10" height="12" fill="#84cc16" opacity="0.08" />
        </g>
        
        {/* Small geometric shapes (reduced opacity) */}
        <rect x="360" y="160" width="10" height="10" fill="#84cc16" opacity="0.18" rx="2" />
        <rect x="75" y="290" width="12" height="12" fill="#84cc16" opacity="0.16" rx="2" />
        <circle cx="185" cy="385" r="6" fill="#84cc16" opacity="0.19" />
        <circle cx="285" cy="430" r="5" fill="#84cc16" opacity="0.17" />
        <rect x="400" y="480" width="8" height="8" fill="#84cc16" opacity="0.15" rx="1" />
        <circle cx="55" cy="540" r="4" fill="#84cc16" opacity="0.14" />
        
        {/* Percentage signs scattered (reduced opacity) */}
        <text x="170" y="150" fontSize="12" fill="#84cc16" fontFamily="monospace" opacity="0.15">%</text>
        <text x="290" y="240" fontSize="11" fill="#84cc16" fontFamily="monospace" opacity="0.13">%</text>
        <text x="150" y="380" fontSize="13" fill="#84cc16" fontFamily="monospace" opacity="0.17">%</text>
        <text x="320" y="460" fontSize="12" fill="#84cc16" fontFamily="monospace" opacity="0.14">%</text>
      </svg>
      
      {/* Enhanced glow effects (reduced opacity) */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-lime-400/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-60 h-60 bg-lime-500/10 rounded-full blur-2xl"></div>
      <div className="absolute top-1/2 right-1/4 w-40 h-40 bg-lime-300/8 rounded-full blur-xl"></div>
      <div className="absolute top-1/3 left-1/3 w-50 h-50 bg-lime-400/7 rounded-full blur-2xl"></div>
    </div>
  );
}
