export function PatternBackground() {
  // Generate symbol patterns
  const symbols = ['X', 'O', '+', '/', '\\', ':', '-', '□'];
  
  return (
    <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
      {/* Base gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/5 via-transparent to-slate-800/10"></div>
      
      {/* SVG Pattern Layer */}
      <svg 
        className="absolute inset-0 w-full h-full opacity-[0.15]"
        viewBox="0 0 400 600"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="symbolPattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            {/* Random symbols in grid */}
            <text x="5" y="15" fontSize="8" fill="#84cc16" fontFamily="monospace" fontWeight="bold">X</text>
            <text x="25" y="25" fontSize="6" fill="#84cc16" fontFamily="monospace" opacity="0.7">O</text>
            <text x="15" y="35" fontSize="7" fill="#84cc16" fontFamily="monospace" opacity="0.6">+</text>
          </pattern>
          
          <pattern id="symbolPattern2" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
            <text x="10" y="20" fontSize="10" fill="#84cc16" fontFamily="monospace" fontWeight="bold" opacity="0.8">/</text>
            <text x="35" y="35" fontSize="8" fill="#84cc16" fontFamily="monospace" opacity="0.5">\</text>
            <text x="20" y="50" fontSize="9" fill="#84cc16" fontFamily="monospace" opacity="0.6">:</text>
          </pattern>
          
          <pattern id="geometricPattern" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
            <rect x="10" y="10" width="12" height="12" fill="none" stroke="#84cc16" strokeWidth="1" opacity="0.4" />
            <circle cx="45" cy="25" r="4" fill="#84cc16" opacity="0.3" />
            <line x1="20" y1="50" x2="30" y2="60" stroke="#84cc16" strokeWidth="1" opacity="0.4" />
            <line x1="50" y1="50" x2="60" y2="60" stroke="#84cc16" strokeWidth="1" opacity="0.4" />
          </pattern>
        </defs>
        
        {/* Large geometric blocks - right side */}
        <rect x="280" y="50" width="80" height="120" fill="#84cc16" opacity="0.08" rx="4" />
        <rect x="320" y="200" width="60" height="100" fill="#84cc16" opacity="0.06" rx="3" />
        <rect x="300" y="450" width="90" height="80" fill="#84cc16" opacity="0.07" rx="4" />
        
        {/* Bottom left block */}
        <rect x="20" y="480" width="70" height="100" fill="#84cc16" opacity="0.08" rx="4" />
        
        {/* Pattern fills */}
        <rect width="100%" height="100%" fill="url(#symbolPattern)" />
        <rect width="100%" height="100%" fill="url(#symbolPattern2)" opacity="0.5" />
        <rect width="100%" height="100%" fill="url(#geometricPattern)" opacity="0.3" />
        
        {/* Scattered symbols */}
        <text x="50" y="80" fontSize="14" fill="#84cc16" fontFamily="monospace" fontWeight="bold" opacity="0.2">X</text>
        <text x="150" y="120" fontSize="12" fill="#84cc16" fontFamily="monospace" opacity="0.15">O</text>
        <text x="200" y="180" fontSize="16" fill="#84cc16" fontFamily="monospace" fontWeight="bold" opacity="0.18">+</text>
        <text x="100" y="250" fontSize="10" fill="#84cc16" fontFamily="monospace" opacity="0.12">/</text>
        <text x="250" y="300" fontSize="13" fill="#84cc16" fontFamily="monospace" opacity="0.16">\</text>
        <text x="80" y="350" fontSize="11" fill="#84cc16" fontFamily="monospace" opacity="0.14">:</text>
        <text x="180" y="400" fontSize="15" fill="#84cc16" fontFamily="monospace" fontWeight="bold" opacity="0.2">X</text>
        <text x="120" y="500" fontSize="12" fill="#84cc16" fontFamily="monospace" opacity="0.15">O</text>
        <text x="220" y="550" fontSize="14" fill="#84cc16" fontFamily="monospace" fontWeight="bold" opacity="0.17">+</text>
        
        {/* Dense symbol clusters */}
        <g opacity="0.1">
          <text x="320" y="100" fontSize="8" fill="#84cc16" fontFamily="monospace">X</text>
          <text x="335" y="100" fontSize="8" fill="#84cc16" fontFamily="monospace">O</text>
          <text x="350" y="100" fontSize="8" fill="#84cc16" fontFamily="monospace">+</text>
          <text x="365" y="100" fontSize="8" fill="#84cc16" fontFamily="monospace">/</text>
        </g>
        
        <g opacity="0.12">
          <text x="30" y="200" fontSize="7" fill="#84cc16" fontFamily="monospace">X</text>
          <text x="40" y="200" fontSize="7" fill="#84cc16" fontFamily="monospace">O</text>
          <text x="50" y="200" fontSize="7" fill="#84cc16" fontFamily="monospace">X</text>
          <text x="60" y="200" fontSize="7" fill="#84cc16" fontFamily="monospace">O</text>
        </g>
        
        {/* Circuit-like lines */}
        <g stroke="#84cc16" strokeWidth="1" opacity="0.08" fill="none">
          <path d="M 50 100 L 150 120 L 200 80 L 250 100" />
          <path d="M 100 300 L 180 280 L 220 320 L 280 300" />
          <path d="M 150 450 L 200 430 L 250 470 L 300 450" />
        </g>
        
        {/* Small geometric shapes */}
        <rect x="350" y="150" width="8" height="8" fill="#84cc16" opacity="0.15" />
        <rect x="70" y="280" width="10" height="10" fill="#84cc16" opacity="0.12" />
        <circle cx="180" cy="380" r="5" fill="#84cc16" opacity="0.14" />
        <circle cx="280" cy="420" r="4" fill="#84cc16" opacity="0.13" />
      </svg>
      
      {/* Subtle glow effects */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-lime-400/5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-lime-500/5 rounded-full blur-2xl"></div>
    </div>
  );
}
