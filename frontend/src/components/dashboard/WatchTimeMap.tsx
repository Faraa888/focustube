import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface WatchTimeMapProps {
  hourlyData: number[]; // Array of 24 numbers (seconds per hour)
  breakdownWeek: {
    productive: number;
    neutral: number;
    distracting: number;
  };
}

export default function WatchTimeMap({ hourlyData, breakdownWeek }: WatchTimeMapProps) {
  // Convert seconds to minutes for display
  const hourlyMinutes = hourlyData.map(seconds => Math.round(seconds / 60));
  // Dynamic scale: max value + 10% padding, but ensure minimum scale for visibility
  const maxWatchTime = Math.max(...hourlyMinutes, 0);
  // If max is very small (< 5 min), use 10 min as scale. Otherwise use max + 10%
  const maxMinutes = maxWatchTime > 0 
    ? Math.max(Math.ceil(maxWatchTime * 1.1), maxWatchTime < 5 ? 10 : maxWatchTime)
    : 60; // Default 60 if no data

  // Calculate total for percentage breakdown
  const totalWeek = breakdownWeek.productive + breakdownWeek.neutral + breakdownWeek.distracting;
  const productivePercent = totalWeek > 0 ? Math.round((breakdownWeek.productive / totalWeek) * 100) : 0;
  const neutralPercent = totalWeek > 0 ? Math.round((breakdownWeek.neutral / totalWeek) * 100) : 0;
  const distractingPercent = totalWeek > 0 ? Math.round((breakdownWeek.distracting / totalWeek) * 100) : 0;

  // Format hour labels (12 AM, 2 AM, ..., 10 PM)
  const formatHour = (hour: number) => {
    if (hour === 0) return "12 AM";
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return "12 PM";
    return `${hour - 12} PM`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Watch-Time Map</CardTitle>
        <CardDescription>
          When you watch YouTube throughout the day
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Breakdown summary */}
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>Productive: {productivePercent}%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span>Neutral: {neutralPercent}%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span>Distracting: {distractingPercent}%</span>
            </div>
          </div>

          {/* Bar chart */}
          <div className="h-64 flex items-end justify-between gap-1">
            {hourlyMinutes.map((minutes, hour) => {
              const height = maxMinutes > 0 ? (minutes / maxMinutes) * 100 : 0;
              // Color based on hour (simplified - could be enhanced with actual category breakdown per hour)
              const getColor = (hour: number) => {
                // Morning hours (6-12) tend to be more productive
                if (hour >= 6 && hour < 12) return "bg-green-500";
                // Afternoon (12-18) mixed
                if (hour >= 12 && hour < 18) return "bg-yellow-500";
                // Evening/night (18-6) more distracting
                return "bg-red-500";
              };

              return (
                <div key={hour} className="flex-1 flex flex-col items-center group relative">
                  <div
                    className={`w-full ${getColor(hour)} rounded-t transition-all hover:opacity-80 cursor-pointer`}
                    style={{ height: `${height}%`, minHeight: minutes > 0 ? "4px" : "0" }}
                    title={`${formatHour(hour)}: ${minutes} min`}
                  >
                    {minutes > 0 && (
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {minutes}m
                      </div>
                    )}
                  </div>
                  {hour % 2 === 0 && (
                    <div className="text-xs text-muted-foreground mt-1 transform -rotate-45 origin-top-left whitespace-nowrap">
                      {formatHour(hour)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

