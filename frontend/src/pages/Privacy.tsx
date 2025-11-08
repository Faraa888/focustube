import Header from "@/components/Header";
import Footer from "@/components/Footer";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-5xl font-bold mb-8">Privacy Policy</h1>
          
          <div className="prose prose-invert max-w-none space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-4">Data Collection</h2>
              <p className="text-muted-foreground">
                FocusTube collects minimal data to provide you with the best experience. We track your YouTube usage patterns 
                locally on your device and only send anonymized data to our servers for AI classification when you're on the Pro plan.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-4">What We Collect</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Video titles and search queries (for AI classification)</li>
                <li>Time spent watching videos (stored locally)</li>
                <li>User preferences and settings</li>
                <li>Email address (for account management)</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-4">How We Use Your Data</h2>
              <p className="text-muted-foreground">
                Your data is used solely to improve your focus and productivity. We never sell your data to third parties. 
                AI classification results are cached to reduce API calls and improve performance.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-4">Data Security</h2>
              <p className="text-muted-foreground">
                We use industry-standard encryption and security practices to protect your data. All API communications are 
                encrypted using HTTPS, and sensitive information is never stored in plain text.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-4">Your Rights</h2>
              <p className="text-muted-foreground">
                You have the right to access, modify, or delete your data at any time. Contact us at 
                <a href="mailto:privacy@focustube.app" className="text-primary hover:underline ml-1">
                  privacy@focustube.app
                </a> for data requests.
              </p>
            </div>

            <div className="pt-8 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Last updated: {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Privacy;
