import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface WatchTimeBucket {
  bucket: string;
  distracting_minutes: number;
  neutral_minutes: number;
  productive_minutes: number;
}

interface WatchTimeMapProps {
  hourlyData: WatchTimeBucket[] | Array<{ label: string; distractingMinutes: number; totalMinutes: number }> | number[] | Array<{ productive: number; neutral: number; distracting: number }>;
  breakdownWeek: {
    productive: number;
    neutral: number;
    distracting: number;
  };
}

/**
 * Watch-Time Overview Component
 * 
 * Stacked bar chart showing watch time by time-of-day buckets.
 * 
 * Y-axis scaling:
 * - Calculates max from all bucket totals (distracting + neutral + productive)
 * - Adds 15% headroom and rounds to a "nice" number (e.g., 17 → 20, 26 → 30)
 * 
 * Colors:
 * - Distracting: #ed2b2b (red)
 * - Neutral: #ffb800 (amber/yellow)
 * - Productive: #00bb13 (green)
 */
export default function WatchTimeMap({ hourlyData, breakdownWeek }: WatchTimeMapProps) {
  // Handle new format: array of buckets with all 3 categories
  let buckets: WatchTimeBucket[] = [];
  
  if (Array.isArray(hourlyData) && hourlyData.length > 0) {
    const first = hourlyData[0];
    if (typeof first === 'object' && 'bucket' in first && 'distracting_minutes' in first) {
      // New format: already in correct shape
      buckets = hourlyData as WatchTimeBucket[];
    } else if (typeof first === 'object' && 'label' in first && 'distractingMinutes' in first) {
      // Old format: convert to new format (only has distracting, set others to 0)
      buckets = (hourlyData as Array<{ label: string; distractingMinutes: number; totalMinutes: number }>).map(item => ({
        bucket: item.label,
        distracting_minutes: item.distractingMinutes,
        neutral_minutes: 0,
        productive_minutes: 0,
      }));
    } else {
      // Fallback: empty buckets
      buckets = [
        { bucket: "12am–8am", distracting_minutes: 0, neutral_minutes: 0, productive_minutes: 0 },
        { bucket: "8am–12pm", distracting_minutes: 0, neutral_minutes: 0, productive_minutes: 0 },
        { bucket: "12pm–4pm", distracting_minutes: 0, neutral_minutes: 0, productive_minutes: 0 },
        { bucket: "4pm–8pm", distracting_minutes: 0, neutral_minutes: 0, productive_minutes: 0 },
        { bucket: "8pm–12am", distracting_minutes: 0, neutral_minutes: 0, productive_minutes: 0 },
      ];
    }
  } else {
    // Fallback: empty buckets
    buckets = [
      { bucket: "12am–8am", distracting_minutes: 0, neutral_minutes: 0, productive_minutes: 0 },
      { bucket: "8am–12pm", distracting_minutes: 0, neutral_minutes: 0, productive_minutes: 0 },
      { bucket: "12pm–4pm", distracting_minutes: 0, neutral_minutes: 0, productive_minutes: 0 },
      { bucket: "4pm–8pm", distracting_minutes: 0, neutral_minutes: 0, productive_minutes: 0 },
      { bucket: "8pm–12am", distracting_minutes: 0, neutral_minutes: 0, productive_minutes: 0 },
    ];
  }

  // Calculate Y-axis max with nice rounding and headroom
  const calculateYAxisMax = (buckets: WatchTimeBucket[]): number => {
    if (buckets.length === 0) return 20;

    // Find max total (sum of all three categories per bucket)
    const maxTotal = Math.max(
      ...buckets.map(b => b.distracting_minutes + b.neutral_minutes + b.productive_minutes)
    );

    if (maxTotal === 0) return 20;

    // Add 15% headroom
    const withHeadroom = maxTotal * 1.15;

    // Round to a "nice" number
    const magnitude = Math.pow(10, Math.floor(Math.log10(withHeadroom)));
    const normalized = withHeadroom / magnitude;
    
    let niceValue: number;
    if (normalized <= 1) niceValue = 1;
    else if (normalized <= 2) niceValue = 2;
    else if (normalized <= 5) niceValue = 5;
    else niceValue = 10;
    
    return niceValue * magnitude;
  };

  const yAxisMax = calculateYAxisMax(buckets);
  const hasData = buckets.some(b => b.distracting_minutes + b.neutral_minutes + b.productive_minutes > 0);

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Watch-Time Overview</CardTitle>
          <CardDescription>When you watch YouTube throughout the day (last 7 days)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            No watch time in this period yet.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Watch-Time Overview</CardTitle>
        <CardDescription>When you watch YouTube throughout the day (last 7 days)</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={buckets}
            margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
            barCategoryGap="20%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
            <XAxis 
              dataKey="bucket" 
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickLine={{ stroke: "#e5e7eb" }}
            />
            <YAxis 
              domain={[0, yAxisMax]}
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickLine={{ stroke: "#e5e7eb" }}
              label={{ 
                value: "Minutes", 
                angle: -90, 
                position: "insideLeft",
                style: { textAnchor: "middle", fill: "#6b7280" }
              }}
            />
            <Tooltip 
              formatter={(value: number) => [`${value.toFixed(1)} min`, ""]}
              labelStyle={{ fontWeight: "bold", marginBottom: "4px" }}
              contentStyle={{ 
                backgroundColor: "white", 
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
              }}
            />
            <Legend 
              wrapperStyle={{ paddingTop: "20px" }}
              iconType="square"
            />
            <Bar 
              dataKey="distracting_minutes" 
              stackId="a" 
              fill="#ed2b2b" 
              name="Distracting"
              radius={[0, 0, 0, 0]}
            />
            <Bar 
              dataKey="neutral_minutes" 
              stackId="a" 
              fill="#ffb800" 
              name="Neutral"
              radius={[0, 0, 0, 0]}
            />
            <Bar 
              dataKey="productive_minutes" 
              stackId="a" 
              fill="#00bb13" 
              name="Productive"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
