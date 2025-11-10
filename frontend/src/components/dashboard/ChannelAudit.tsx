import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useState } from "react";

interface Channel {
  channel: string;
  videos: number;
  minutes: number;
  seconds: number;
}

interface ChannelAuditProps {
  channels: Channel[];
}

export default function ChannelAudit({ channels }: ChannelAuditProps) {
  const [blocking, setBlocking] = useState<string | null>(null);

  const handleBlock = async (channelName: string) => {
    setBlocking(channelName);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        toast({
          title: "Error",
          description: "You must be logged in to block channels",
          variant: "destructive",
        });
        setBlocking(null);
        return;
      }

      // Get current blocked channels
      const response = await fetch(
        `https://focustube-backend-4xah.onrender.com/extension/get-data?email=${encodeURIComponent(user.email)}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch current blocklist");
      }

      const result = await response.json();
      const currentBlocked = result.ok && result.data?.blocked_channels ? result.data.blocked_channels : [];

      // Check if already blocked
      const isAlreadyBlocked = currentBlocked.some(
        (ch: string) => ch.toLowerCase().trim() === channelName.toLowerCase().trim()
      );

      if (isAlreadyBlocked) {
        toast({
          title: "Already blocked",
          description: "This channel is already in your blocklist",
        });
        setBlocking(null);
        return;
      }

      // Add to blocklist
      const updatedBlocked = [...currentBlocked, channelName];

      const saveResponse = await fetch(
        "https://focustube-backend-4xah.onrender.com/extension/save-data",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: user.email,
            data: {
              blocked_channels: updatedBlocked,
            },
          }),
        }
      );

      if (saveResponse.ok) {
        toast({
          title: "Channel blocked",
          description: "Well done! Eliminating distractions helps you stay focused.",
        });
        // Refresh page to update list
        window.location.reload();
      } else {
        throw new Error("Failed to save");
      }
    } catch (error: any) {
      console.error("Error blocking channel:", error);
      toast({
        title: "Error",
        description: "Failed to block channel. Please try again.",
        variant: "destructive",
      });
    } finally {
      setBlocking(null);
    }
  };

  if (channels.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Most Viewed Channels</CardTitle>
          <CardDescription>
            Your top channels by watch time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No channel data yet. Start watching videos to see your top channels.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Most Viewed Channels</CardTitle>
        <CardDescription>
          Your top channels by watch time
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {channels.map((channel, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 rounded-lg border bg-card"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Badge variant="secondary" className="rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                  {index + 1}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{channel.channel}</div>
                  <div className="text-xs text-muted-foreground">
                    {channel.videos} {channel.videos === 1 ? "video" : "videos"} · {channel.minutes} min
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBlock(channel.channel)}
                disabled={blocking === channel.channel}
              >
                {blocking === channel.channel ? "Blocking..." : "Block"}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

