import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

interface SpiralEvent {
  channel: string;
  count: number;
  type: string; // "today" or "week"
  detected_at: string;
  message?: string;
}

interface SpiralFeedProps {
  events: SpiralEvent[];
}

export default function SpiralFeed({ events }: SpiralFeedProps) {
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const period = hours >= 12 ? "PM" : "AM";
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`;
  };

  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Spiral Detector Feed</CardTitle>
          <CardDescription>
            Chronological list of detected spirals
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No spirals detected recently. Keep up the good focus!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spiral Detector Feed</CardTitle>
        <CardDescription>
          Chronological list of detected spirals
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {events.map((event, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-3 rounded-lg border bg-card"
            >
              <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{event.channel}</span>
                  <Badge variant={event.type === "today" ? "destructive" : "secondary"}>
                    {event.type === "today" ? "Today" : "This Week"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {event.count} {event.count === 1 ? "video" : "videos"} at {formatTime(event.detected_at)}
                </p>
                {event.message && (
                  <p className="text-xs text-muted-foreground mt-1 italic">
                    {event.message}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

