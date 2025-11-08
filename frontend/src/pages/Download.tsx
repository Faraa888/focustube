import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download as DownloadIcon, Chrome, Check } from "lucide-react";

const Download = () => {
  // TODO: Replace with actual Chrome Web Store URL
  const CHROME_STORE_URL = "https://chrome.google.com/webstore/detail/focustube/YOUR_EXTENSION_ID";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-20 mt-16 max-w-4xl">
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">
            Free • Takes 30 seconds
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Install FocusTube
          </h1>
          <p className="text-xl text-muted-foreground">
            Start using YouTube with intention in under a minute
          </p>
        </div>

        {/* Install Card */}
        <Card className="mb-12 border-primary/50">
          <CardContent className="pt-8">
            <div className="text-center">
              <Chrome className="h-16 w-16 mx-auto mb-4 text-primary" />
              <h2 className="text-2xl font-bold mb-2">Chrome Extension</h2>
              <p className="text-muted-foreground mb-6">
                Works on Chrome, Edge, Brave, and other Chromium browsers
              </p>
              <Button 
                size="lg" 
                asChild 
                data-evt="install_extension"
                className="mb-4"
              >
                <a 
                  href={CHROME_STORE_URL}
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <DownloadIcon className="mr-2 h-5 w-5" />
                  Add to Chrome — It's Free
                </a>
              </Button>
              <p className="text-sm text-muted-foreground">
                ⭐️ Rated 4.8/5 by 10,000+ users
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Setup Steps */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-center mb-8">
            Quick Setup (3 steps)
          </h2>
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center font-bold text-primary text-lg">
                    1
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-1">Install the extension</CardTitle>
                    <CardDescription>
                      Click "Add to Chrome" above, then click "Add extension" in the popup
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center font-bold text-primary text-lg">
                    2
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-1">Set your goals</CardTitle>
                    <CardDescription>
                      The extension will ask what you want to learn and what distracts you (takes 30 seconds)
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center font-bold text-primary text-lg">
                    3
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-1">Start browsing YouTube</CardTitle>
                    <CardDescription>
                      FocusTube works automatically. Visit YouTube and see the difference!
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </div>
        </div>

        {/* Post-Install Tips */}
        <Card className="bg-card/50 mb-12">
          <CardHeader>
            <CardTitle>After installing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm">
                <strong>Pin the extension:</strong> Click the puzzle icon in Chrome, find FocusTube, and click the pin icon
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm">
                <strong>Create an account:</strong> Sign up to sync your settings and access the dashboard
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm">
                <strong>Customize:</strong> Adjust settings anytime by clicking the extension icon
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <div className="text-center space-y-4">
          <p className="text-muted-foreground mb-6">
            Already installed the extension?
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="outline" size="lg" asChild>
              <Link to="/signup">Create Account</Link>
            </Button>
            <Button variant="ghost" size="lg" asChild>
              <Link to="/app/dashboard">Open Dashboard</Link>
            </Button>
          </div>
        </div>

        {/* Support */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground mb-2">
            Need help installing?
          </p>
          <Button variant="link" asChild>
            <a href="mailto:support@focustube.com">Contact Support</a>
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Download;
