interface CityData {
  city: string;
  count: number;
}

// Saudi city positions (approximate lat/lng mapped to SVG viewBox 0-400 x 0-400)
const cityPositions: Record<string, { x: number; y: number }> = {
  'مكه': { x: 130, y: 240 },
  'مكة': { x: 130, y: 240 },
  'مكة المكرمة': { x: 130, y: 240 },
  'جدة': { x: 115, y: 225 },
  'المدينة': { x: 135, y: 180 },
  'المدينة المنورة': { x: 135, y: 180 },
  'الرياض': { x: 245, y: 210 },
  'الطائف': { x: 145, y: 250 },
  'ينبع': { x: 115, y: 180 },
  'الدمام': { x: 300, y: 185 },
  'تبوك': { x: 135, y: 120 },
  'أبها': { x: 165, y: 310 },
  'جيزان': { x: 145, y: 340 },
  'حائل': { x: 200, y: 140 },
  'القصيم': { x: 210, y: 160 },
  'بريدة': { x: 210, y: 160 },
  'نجران': { x: 205, y: 330 },
  'الخبر': { x: 305, y: 190 },
  'رابغ': { x: 120, y: 210 },
};

export default function SaudiHeatMap({ data }: { data: CityData[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);

  const getRadius = (count: number) => 12 + (count / maxCount) * 30;
  const getOpacity = (count: number) => 0.3 + (count / maxCount) * 0.5;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-fade-in-up">
      <h3 className="text-lg font-bold text-text mb-4">توزيع أماكن الإقامة</h3>
      <div className="relative">
        <svg viewBox="0 0 400 400" className="w-full max-w-md mx-auto">
          {/* Saudi Arabia simplified outline */}
          <path
            d="M90,100 L150,80 L200,75 L260,90 L310,120 L340,170 L330,200 L310,190 L305,210 L280,230 L260,260 L240,280 L220,310 L200,340 L180,350 L155,345 L140,330 L130,310 L120,280 L110,260 L105,240 L100,220 L95,200 L90,170 L85,140 Z"
            fill="#F0F4FF"
            stroke="#D1D5DB"
            strokeWidth="1.5"
          />

          {/* City dots */}
          {data.map((item, i) => {
            const normalizedCity = item.city.trim();
            const pos = Object.entries(cityPositions).find(([key]) =>
              normalizedCity.includes(key) || key.includes(normalizedCity)
            );
            if (!pos) return null;
            const { x, y } = pos[1];

            return (
              <g key={i}>
                {/* Glow */}
                <circle
                  cx={x} cy={y}
                  r={getRadius(item.count)}
                  fill="#007AFF"
                  opacity={getOpacity(item.count) * 0.3}
                />
                {/* Dot */}
                <circle
                  cx={x} cy={y}
                  r={8}
                  fill="#007AFF"
                  opacity={getOpacity(item.count)}
                  stroke="white"
                  strokeWidth="2"
                />
                {/* Label */}
                <text
                  x={x} y={y - 14}
                  textAnchor="middle"
                  fontSize="10"
                  fontFamily="Tajawal, sans-serif"
                  fontWeight="600"
                  fill="#1D1D1F"
                >
                  {item.city}
                </text>
                <text
                  x={x} y={y + 4}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="700"
                  fill="white"
                >
                  {item.count}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-text-secondary">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-primary opacity-30"></div>
            <span>أقل</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 rounded-full bg-primary opacity-70"></div>
            <span>أكثر</span>
          </div>
        </div>
      </div>
    </div>
  );
}
