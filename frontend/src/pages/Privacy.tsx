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
                FocusTube collects only what's necessary to help you stay intentional on YouTube. Most data is processed locally. Anonymized data is sent only for Pro features like AI classification.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-4">What We Collect</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Video titles, channel names and search queries (for AI classification)</li>
                <li>Time spent watching videos</li>
                <li>Your usage preferences and settings</li>
                <li>Email address for login and support</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-4">How We Use Your Data</h2>
              <p className="text-muted-foreground">
                Your data powers features like nudges, spiral detection, and distraction tracking. It's never sold, and never used for ads. Only anonymized usage patterns are shared to improve FocusTube.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-4">Data Security</h2>
              <p className="text-muted-foreground">
                All communication is encrypted using HTTPS. Sensitive data stays encrypted, and AI classification runs through secure, private channels. We use industry-standard protections across the stack.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-4">Your Rights</h2>
              <p className="text-muted-foreground">
                You have the right to access, modify, or delete your data at any time. Contact us at 
                <a href="mailto:support@focustube.co.uk" className="text-primary hover:underline ml-1">
                  support@focustube.co.uk
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
