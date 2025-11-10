import { Card, CardContent } from "@/components/ui/card";

interface FocusScoreProps {
  score: number; // 0-100
}

export default function FocusScore({ score }: FocusScoreProps) {
  // Determine color based on score
  const getColor = (score: number) => {
    if (score >= 75) return "#22c55e"; // green
    if (score >= 50) return "#eab308"; // yellow
    return "#ef4444"; // red
  };

  const color = getColor(score);
  const circumference = 2 * Math.PI * 45; // radius = 45
  const offset = circumference - (score / 100) * circumference;

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <div className="flex flex-col items-center justify-center">
          <div className="relative w-32 h-32 mb-4">
            <svg className="transform -rotate-90 w-32 h-32">
              <circle
                cx="64"
                cy="64"
                r="45"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-muted"
              />
              <circle
                cx="64"
                cy="64"
                r="45"
                stroke={color}
                strokeWidth="8"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-3xl font-bold" style={{ color }}>
                  {score}
                </div>
                <div className="text-xs text-muted-foreground">%</div>
              </div>
            </div>
          </div>
          <h3 className="text-xl font-semibold mb-1">Focus Score</h3>
          <p className="text-sm text-muted-foreground text-center">
            Based on % of time spent on goal-aligned content vs distractions over past 7 days
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

