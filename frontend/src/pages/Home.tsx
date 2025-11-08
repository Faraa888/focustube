import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FeatureCard from "@/components/FeatureCard";
import { Shield, Sparkles, Clock, BarChart3, Zap, Ban, Check } from "lucide-react";
import heroImage from "@/assets/hero-focus.jpg";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const Home = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <Badge variant="secondary" className="mb-4">
              14-day free trial • No credit card required
            </Badge>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              Use YouTube on purpose.
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Stop research spirals. FocusTube filters noise, sets limits, and nudges you back to intent.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild data-evt="start_trial">
                <Link to="/signup">Start 14-Day Free Trial</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/download">Install Extension</Link>
              </Button>
            </div>
          </div>
          
          <div className="relative rounded-lg overflow-hidden border border-border shadow-2xl">
            <img 
              src={heroImage} 
              alt="FocusTube dashboard showing focus metrics and analytics"
              className="w-full h-auto"
            />
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-12 px-4 bg-card/50">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="flex flex-wrap justify-center items-center gap-8 text-muted-foreground">
            <div>
              <div className="text-3xl font-bold text-foreground">10,000+</div>
              <div className="text-sm">Active users</div>
            </div>
            <div className="h-12 w-px bg-border" />
            <div>
              <div className="text-3xl font-bold text-foreground">45%</div>
              <div className="text-sm">Avg. distraction reduction</div>
            </div>
            <div className="h-12 w-px bg-border" />
            <div>
              <div className="text-3xl font-bold text-foreground">4.8/5</div>
              <div className="text-sm">Chrome Store rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Statement */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            You don't need more discipline.
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            You need better defaults. FocusTube gives you the guardrails to stay intentional without fighting yourself every click.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 bg-card/30">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            How it works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Install</h3>
              <p className="text-muted-foreground">
                Add the extension to Chrome in one click. No complex setup.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Set goals</h3>
              <p className="text-muted-foreground">
                Tell FocusTube what you're learning and what distracts you.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Browse with guardrails</h3>
              <p className="text-muted-foreground">
                FocusTube filters distractions and nudges you back on track.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Built for intentional creators
          </h2>
          <p className="text-xl text-muted-foreground text-center mb-12">
            Smarter limits. AI clarity. Fast, gentle nudges.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={Ban}
              title="Blocks Shorts"
              description="Hide the endless scroll of YouTube Shorts so you stay focused on your learning path."
            />
            <FeatureCard
              icon={Sparkles}
              title="AI Filtering"
              description="Smart content filtering that understands your goals and filters out distractions automatically."
            />
            <FeatureCard
              icon={Clock}
              title="Time Nudges"
              description="Gentle reminders when you've been browsing too long, not harsh lockouts that frustrate you."
            />
            <FeatureCard
              icon={BarChart3}
              title="Personal Insights"
              description="See your focus trends, watch patterns, and progress toward your learning goals."
            />
            <FeatureCard
              icon={Shield}
              title="Privacy First"
              description="All processing happens locally. Your viewing history never leaves your device."
            />
            <FeatureCard
              icon={Zap}
              title="Zero Friction"
              description="Works seamlessly with YouTube. No clunky overlays or broken features."
            />
          </div>
        </div>
      </section>

      {/* Free vs Pro */}
      <section className="py-20 px-4 bg-card/30">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Free vs Pro
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="border border-border rounded-lg p-6">
              <h3 className="text-2xl font-bold mb-4">Free</h3>
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Block YouTube Shorts</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Basic search filtering</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Daily time limit</span>
                </div>
              </div>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/download">Get Started</Link>
              </Button>
            </div>
            
            <div className="border-2 border-primary rounded-lg p-6 relative">
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                Most Popular
              </Badge>
              <h3 className="text-2xl font-bold mb-4">Pro</h3>
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Everything in Free</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>AI content filtering</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Advanced dashboard & insights</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Custom focus goals</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Priority support</span>
                </div>
              </div>
              <Button className="w-full" asChild data-evt="buy_pro">
                <Link to="/pricing">View Pricing</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Frequently Asked Questions
          </h2>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>How long is the free trial?</AccordionTrigger>
              <AccordionContent>
                14 days, no credit card required. You get full access to Pro features during the trial period.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>Is my data private?</AccordionTrigger>
              <AccordionContent>
                Yes. All processing happens locally in your browser. We never see or store your YouTube viewing history.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>How much does Pro cost?</AccordionTrigger>
              <AccordionContent>
                $7/month or $60/year (save 30%). See full pricing details on our pricing page.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger>Can I uninstall anytime?</AccordionTrigger>
              <AccordionContent>
                Absolutely. Uninstall from Chrome like any extension. No lock-in, cancel your subscription anytime.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-5">
              <AccordionTrigger>Does it only work on Chrome?</AccordionTrigger>
              <AccordionContent>
                Currently yes, Chrome and Edge (Chromium-based). Firefox and Safari support coming soon.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-6">
              <AccordionTrigger>How does AI filtering work?</AccordionTrigger>
              <AccordionContent>
                Our AI analyzes video titles, thumbnails, and descriptions to match against your goals and filter out distractions, all processed locally.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 bg-primary/5 border-y border-primary/20">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Ready to reclaim your focus?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            FocusTube isn't about blocking everything. It's about helping you use YouTube the way you meant to.
          </p>
          <Button size="lg" asChild data-evt="final_cta">
            <Link to="/signup">Start 14-Day Free Trial</Link>
          </Button>
          <p className="text-sm text-muted-foreground mt-4">
            No credit card required • Cancel anytime
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Home;
