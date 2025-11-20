import Header from "@/components/Header";
import Footer from "@/components/Footer";

const Terms = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-5xl font-bold mb-8">Terms of Service</h1>
          
          <div className="prose prose-invert max-w-none space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-4">Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By using FocusTube, you agree to the terms outlined below. If anything feels off, don't use the service until you're clear on your rights.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-4">Service Description</h2>
              <p className="text-muted-foreground">
                FocusTube is a browser extension for YouTube. It filters distractions, tracks focus, and gives nudges based on your behavior. Some features rely on AI classification.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-4">User Responsibilities</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>You must be at least 13 years old to use FocusTube</li>
                <li>Keep your account details safe and secure</li>
                <li>Don't tamper with or reverse engineer the app</li>
                <li>Use the product ethically, without abuse</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-4">Subscription and Payments</h2>
              <p className="text-muted-foreground">
                Pro plans are billed monthly or annually through Stripe. Cancel anytime. Refunds are available within 30 days on annual subscription if you're unsatisfied.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-4">Limitation of Liability</h2>
              <p className="text-muted-foreground">
                FocusTube is provided as-is. We're not liable for indirect losses, missed productivity, or side effects of blocking content.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-4">Changes to Terms</h2>
              <p className="text-muted-foreground">
                We may update these terms. Continued use means you accept the updates.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-4">Contact</h2>
              <p className="text-muted-foreground">
                For questions about these terms, contact us at 
                <a href="mailto:support@focustube.co.uk" className="text-primary hover:underline ml-1">
                  support@focustube.co.uk
                </a>
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

export default Terms;
