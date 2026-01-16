export function HeroBottomEdge() {
  return (
    <div className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none overflow-hidden">
      {/* Wavy bottom edge with geometric accents */}
      <svg 
        className="absolute bottom-0 left-0 w-full h-full"
        viewBox="0 0 1200 80"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="waveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#000000" stopOpacity="1" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {/* Main wavy path */}
        <path
          d="M 0 40 Q 150 20, 300 35 T 600 30 T 900 40 T 1200 25 L 1200 80 L 0 80 Z"
          fill="url(#waveGradient)"
        />
        
        {/* Secondary smaller wave overlay */}
        <path
          d="M 0 45 Q 200 25, 400 40 T 800 35 T 1200 30 L 1200 80 L 0 80 Z"
          fill="url(#waveGradient)"
          opacity="0.6"
        />
        
        {/* Geometric accent shapes along the wave */}
        <circle cx="150" cy="30" r="3" fill="#84cc16" opacity="0.4" />
        <circle cx="450" cy="25" r="2.5" fill="#84cc16" opacity="0.35" />
        <circle cx="750" cy="32" r="2" fill="#84cc16" opacity="0.3" />
        <circle cx="1050" cy="28" r="2.5" fill="#84cc16" opacity="0.35" />
        
        {/* Small geometric triangles */}
        <polygon points="300,35 305,25 310,35" fill="#84cc16" opacity="0.3" />
        <polygon points="600,30 605,20 610,30" fill="#84cc16" opacity="0.25" />
        <polygon points="900,40 905,30 910,40" fill="#84cc16" opacity="0.3" />
        
        {/* Decorative lines */}
        <line x1="0" y1="50" x2="1200" y2="50" stroke="#84cc16" strokeWidth="0.5" opacity="0.15" />
        <line x1="0" y1="55" x2="1200" y2="55" stroke="#84cc16" strokeWidth="0.5" opacity="0.1" />
      </svg>
    </div>
  );
}
