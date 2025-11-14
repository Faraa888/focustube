import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface WatchTimeMapProps {
  hourlyData: number[] | Array<{ productive: number; neutral: number; distracting: number }>; // Array of 24 numbers (seconds per hour) or category breakdown
  breakdownWeek: {
    productive: number;
    neutral: number;
    distracting: number;
  };
}

export default function WatchTimeMap({ hourlyData, breakdownWeek }: WatchTimeMapProps) {
  // Handle both old format (number[]) and new format (category breakdown)
  const hourlyBreakdown = hourlyData.map((item) => {
    if (typeof item === "number") {
      // Old format: just total seconds
      return { productive: 0, neutral: item, distracting: 0 };
    }
    // New format: category breakdown
    return item;
  });

  // Convert to minutes and calculate totals per hour
  const hourlyMinutes = hourlyBreakdown.map((hour) => {
    const totalSeconds = hour.productive + hour.neutral + hour.distracting;
    return {
      total: Math.round(totalSeconds / 60),
      productive: Math.round(hour.productive / 60),
      neutral: Math.round(hour.neutral / 60),
      distracting: Math.round(hour.distracting / 60),
    };
  });

  // Dynamic scale: tallest bar = 100% (with 10% padding for visual clarity)
  const maxWatchTime = Math.max(...hourlyMinutes.map(h => h.total), 0);
  const maxMinutes = maxWatchTime > 0 
    ? Math.ceil(maxWatchTime * 1.1) // 10% padding, no minimum - scales to actual max
    : 60; // Default 60 if no data at all

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
            {hourlyMinutes.map((hourData, hour) => {
              const totalMinutes = hourData.total;
              const height = maxMinutes > 0 ? (totalMinutes / maxMinutes) * 100 : 0;
              
              // Determine dominant category for color
              let barColor = "bg-muted";
              if (totalMinutes > 0) {
                const maxCategory = Math.max(hourData.productive, hourData.neutral, hourData.distracting);
                if (maxCategory === hourData.productive) {
                  barColor = "bg-green-500";
                } else if (maxCategory === hourData.distracting) {
                  barColor = "bg-red-500";
                } else {
                  barColor = "bg-yellow-500";
                }
              }

              return (
                <div key={hour} className="flex-1 flex flex-col items-center group relative">
                  <div
                    className={`w-full ${barColor} rounded-t transition-all hover:opacity-80 cursor-pointer`}
                    style={{ 
                      height: `${height}%`
                    }}
                    title={`${formatHour(hour)}: ${totalMinutes} min (P:${hourData.productive} N:${hourData.neutral} D:${hourData.distracting})`}
                  >
                    {totalMinutes > 0 && (
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-background/90 px-1 rounded z-10">
                        {totalMinutes}m
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

