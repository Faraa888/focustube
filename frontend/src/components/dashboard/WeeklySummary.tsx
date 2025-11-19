import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface WeeklySummaryProps {
  thisWeekMinutes: number;
  breakdownWeek: {
    productive: number;
    neutral: number;
    distracting: number;
  };
  hourlyWatchTime: number[];
}

export default function WeeklySummary({
  thisWeekMinutes,
  breakdownWeek,
  hourlyWatchTime,
}: WeeklySummaryProps) {
  // Calculate percentages
  const totalWeek = breakdownWeek.productive + breakdownWeek.neutral + breakdownWeek.distracting;
  const goalFocusedPercent = totalWeek > 0 ? Math.round((breakdownWeek.productive / totalWeek) * 100) : 0;
  const neutralPercent = totalWeek > 0 ? Math.round((breakdownWeek.neutral / totalWeek) * 100) : 0;
  const distractionsPercent = totalWeek > 0 ? Math.round((breakdownWeek.distracting / totalWeek) * 100) : 0;


  const hours = Math.floor(thisWeekMinutes / 60);
  const minutes = thisWeekMinutes % 60;
  const timeDisplay = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Return on Watch Summary</CardTitle>
        <CardDescription>
          End-of-week digest of your YouTube habits
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-2xl font-bold">{timeDisplay}</div>
            <div className="text-xs text-muted-foreground">Total watch time</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{goalFocusedPercent}%</div>
            <div className="text-xs text-muted-foreground">Goal Focused</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{distractionsPercent}%</div>
            <div className="text-xs text-muted-foreground">Distractions</div>
          </div>
        </div>
        
        {/* Neutral category shown separately if > 0 */}
        {neutralPercent > 0 && (
          <div className="pt-2 border-t">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">Neutral:</span> {neutralPercent}%
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

