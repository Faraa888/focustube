import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface WatchTimeMapProps {
  hourlyData: Array<{ label: string; distractingMinutes: number; totalMinutes: number }> | number[] | Array<{ productive: number; neutral: number; distracting: number }>;
  breakdownWeek: {
    productive: number;
    neutral: number;
    distracting: number;
  };
}

export default function WatchTimeMap({ hourlyData, breakdownWeek }: WatchTimeMapProps) {
  // Handle new simplified format (5 time blocks)
  let timeBlocks: Array<{ label: string; distractingMinutes: number; totalMinutes: number }>;
  
  if (Array.isArray(hourlyData) && hourlyData.length > 0 && typeof hourlyData[0] === 'object' && 'label' in hourlyData[0]) {
    // New format: already grouped into 5 blocks
    timeBlocks = hourlyData as Array<{ label: string; distractingMinutes: number; totalMinutes: number }>;
  } else {
    // Fallback: empty blocks
    timeBlocks = [
      { label: "12am to 8am", distractingMinutes: 0, totalMinutes: 0 },
      { label: "8am to 12pm", distractingMinutes: 0, totalMinutes: 0 },
      { label: "12pm to 4pm", distractingMinutes: 0, totalMinutes: 0 },
      { label: "4pm to 8pm", distractingMinutes: 0, totalMinutes: 0 },
      { label: "8pm to 12am", distractingMinutes: 0, totalMinutes: 0 },
    ];
  }

  // Auto-scale Y-axis: tallest bar = 100% (with 10% padding)
  const maxDistracting = Math.max(...timeBlocks.map(b => b.distractingMinutes), 0);
  const maxMinutes = maxDistracting > 0 ? Math.ceil(maxDistracting * 1.1) : 10;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Watch-Time Map</CardTitle>
        <CardDescription>
          Distracting content by time of day (last 30 days)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Y-axis labels */}
          <div className="relative h-64">
            {/* Y-axis scale */}
            <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between text-xs text-muted-foreground">
              {[maxMinutes, Math.round(maxMinutes * 0.75), Math.round(maxMinutes * 0.5), Math.round(maxMinutes * 0.25), 0].map((val) => (
                <span key={val}>{val}</span>
              ))}
            </div>

            {/* Chart area */}
            <div className="ml-12 h-full flex items-end justify-between gap-4">
              {timeBlocks.map((block, idx) => {
                const height = maxMinutes > 0 ? (block.distractingMinutes / maxMinutes) * 100 : 0;
                const percentage = block.totalMinutes > 0 ? Math.round((block.distractingMinutes / block.totalMinutes) * 100) : 0;

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center group relative h-full">
                    {/* Bar */}
                    <div
                      className="w-full bg-red-500 rounded-t transition-all hover:opacity-80 cursor-pointer relative"
                      style={{ height: `${height}%` }}
                      title={`${block.label}: ${block.distractingMinutes} min (${percentage}% of watch time)`}
                    >
                      {block.distractingMinutes > 0 && (
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-background/90 px-1 rounded z-10">
                          {block.distractingMinutes}m
                        </div>
                      )}
                    </div>

                    {/* X-axis label */}
                    <div className="text-xs text-muted-foreground mt-2 text-center">
                      {block.label}
                    </div>

                    {/* Percentage below label */}
                    <div className="text-xs font-medium text-red-500 mt-1">
                      {percentage}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          <div className="text-sm text-muted-foreground text-center">
            Total distracting: {timeBlocks.reduce((sum, b) => sum + b.distractingMinutes, 0)} min
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
