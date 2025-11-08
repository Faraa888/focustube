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
                By using FocusTube, you agree to these terms of service. If you do not agree with any part of these terms, 
                please do not use our service.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-4">Service Description</h2>
              <p className="text-muted-foreground">
                FocusTube is a Chrome extension designed to help users maintain focus while using YouTube. We provide tools 
                to block distracting content, track usage, and classify videos using AI technology.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-4">User Responsibilities</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>You must be at least 13 years old to use FocusTube</li>
                <li>You are responsible for maintaining the security of your account</li>
                <li>You agree not to misuse or abuse the service</li>
                <li>You will not attempt to reverse engineer or hack the extension</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-4">Subscription and Payments</h2>
              <p className="text-muted-foreground">
                Pro plan subscriptions are billed monthly or yearly. You can cancel at any time. Refunds are provided on a 
                case-by-case basis within 14 days of purchase.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-4">Limitation of Liability</h2>
              <p className="text-muted-foreground">
                FocusTube is provided "as is" without warranties of any kind. We are not liable for any damages arising from 
                the use or inability to use the service.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-4">Changes to Terms</h2>
              <p className="text-muted-foreground">
                We reserve the right to modify these terms at any time. Continued use of the service after changes constitutes 
                acceptance of the new terms.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-4">Contact</h2>
              <p className="text-muted-foreground">
                For questions about these terms, contact us at 
                <a href="mailto:legal@focustube.app" className="text-primary hover:underline ml-1">
                  legal@focustube.app
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
