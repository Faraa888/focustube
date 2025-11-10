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
  const productivePercent = totalWeek > 0 ? Math.round((breakdownWeek.productive / totalWeek) * 100) : 0;
  const distractingPercent = totalWeek > 0 ? Math.round((breakdownWeek.distracting / totalWeek) * 100) : 0;

  // Find peak productive and distracting hours
  const productiveHours: number[] = [];
  const distractingHours: number[] = [];

  // Simplified: assume morning (6-12) = productive, evening (18-24) = distracting
  // In a real implementation, we'd use actual category breakdown per hour
  hourlyWatchTime.forEach((seconds, hour) => {
    if (seconds > 0) {
      if (hour >= 6 && hour < 12) {
        productiveHours.push(hour);
      } else if (hour >= 18 || hour < 6) {
        distractingHours.push(hour);
      }
    }
  });

  const formatHour = (hour: number) => {
    if (hour === 0) return "12 AM";
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return "12 PM";
    return `${hour - 12} PM`;
  };

  const getPeakProductive = () => {
    if (productiveHours.length === 0) return "No productive viewing detected";
    const avgHour = Math.round(
      productiveHours.reduce((sum, h) => sum + h, 0) / productiveHours.length
    );
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return `${dayNames[0]} ${formatHour(avgHour)} tutorials`;
  };

  const getPeakDistracting = () => {
    if (distractingHours.length === 0) return "No distracting viewing detected";
    const avgHour = Math.round(
      distractingHours.reduce((sum, h) => sum + h, 0) / distractingHours.length
    );
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return `${dayNames[4]} ${formatHour(avgHour)} Shorts`;
  };

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
            <div className="text-2xl font-bold">{productivePercent}%</div>
            <div className="text-xs text-muted-foreground">Educational</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{distractingPercent}%</div>
            <div className="text-xs text-muted-foreground">Entertainment</div>
          </div>
        </div>

        <div className="pt-4 border-t">
          <p className="text-sm">
            <strong>Most productive viewing:</strong> {getPeakProductive()}
          </p>
          <p className="text-sm mt-2">
            <strong>Most waste:</strong> {getPeakDistracting()}
          </p>
        </div>

        {distractingPercent > 50 && (
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-3">
              Consider cleaning up? You watched {distractingPercent}% distracting content this week.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/app/settings">Block All Distractions</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

