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
              Free for 30 days • No card needed
            </Badge>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              YouTube without the spiral.
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-8">
              FocusTube filters out distractions, sets smart limits, and nudges you back to your goals — so you stop spiraling and start doing.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild data-evt="start_trial">
                <Link to="/signup">Start Free Trial</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/download">Install Extension</Link>
              </Button>
            </div>
          </div>
          
          <div className="relative rounded-lg overflow-hidden border border-border shadow-2xl">
            <img 
              src={heroImage} 
              alt="FocusTube dashboard showing daily usage, focus score, and distractions blocked"
              className="w-full h-auto"
            />
          </div>
        </div>
      </section>


      {/* Problem Statement */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            You don't need more willpower.
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            You've deleted the app. You've blocked Shorts. You've unsubscribed from channels.
            <br />
            And yet, you still fall down the rabbit hole.
            <br />
            FocusTube helps you break the cycle — with smarter limits and actual accountability.
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
                Add the extension to Chrome in one click. Setup takes 3 seconds.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Set goals</h3>
              <p className="text-muted-foreground">
                Tell FocusTube what you're working on and what tends to derail you.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Browse with guardrails</h3>
              <p className="text-muted-foreground">
                As you use YouTube, FocusTube filters content, tracks habits, and nudges you back on track when you slip.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            What it does
          </h2>
          <p className="text-xl text-muted-foreground text-center mb-12">
            Built for people who know better — but still spiral.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={Sparkles}
              title="Distraction Detection"
              description="Analyzes video titles, channels, and tags to flag likely distractions. Helps you spot the trap — before you're in it."
            />
            <FeatureCard
              icon={Zap}
              title="Spiral Detection"
              description="Watches for binge patterns or repeat views. Nudges you gently when you're drifting into a loop."
            />
            <FeatureCard
              icon={Ban}
              title="Blocks Shorts"
              description="Wipe out the infinite scroll by default, keep full control if you want it."
            />
            <FeatureCard
              icon={Clock}
              title="Time Boundaries"
              description="Set daily limits and focus windows. Use YouTube with intention — not on impulse."
            />
            <FeatureCard
              icon={Check}
              title="Smart Nudges"
              description="Contextual popups that ask the right questions at the right time. Never shaming — always helpful."
            />
            <FeatureCard
              icon={BarChart3}
              title="Personal Dashboard"
              description="Track how you're using YouTube. Spot your weak moments. Celebrate when you stay focused."
            />
            <FeatureCard
              icon={Shield}
              title="Channel Blocking"
              description="Pick channels that derail you and block them permanently. One click. No second guessing."
            />
            <FeatureCard
              icon={Sparkles}
              title="Focus Goals"
              description="Tell FocusTube what matters to you. Used to train the AI, personalize nudges, and give more relevant insights."
            />
          </div>
        </div>
      </section>

      {/* Who's It For */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Made for people who know better - but still spiral
          </h2>
          <p className="text-xl text-muted-foreground">
            FocusTube isn't for dopamine detox monks or zero-inbox purists. It's for people trying to get things done- who want to learn, build, improve but get derailed by YouTube just a little too easily. If you've ever gone in to watch one video... and resurfaced 2 hours later, this is for you.
          </p>
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
                  <span>Daily search limit</span>
                </div>
              </div>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/download">Use for free</Link>
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
                  <span>Distraction nudges & spiral detection</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>AI-powered video filtering</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Targetted channel blocking</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Full dahsboard & insights</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Custom goals & focus-time settings</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Focus journal prompts</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Priority support and access to new features</span>
                </div>
              </div>
              <Button className="w-full" asChild data-evt="buy_pro">
                <Link to="/signup">Start Free Trial</Link>
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
                30 days. No card needed. You get full access to Pro features during the trial period.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>Is my data private?</AccordionTrigger>
              <AccordionContent>
                We don't sell your data. Ever. Some features process locally, some use secure APIs. Nothing is sold or tracked externally.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>How much does Pro cost?</AccordionTrigger>
              <AccordionContent>
                $4.99/month or $49.99/year. Cancel Anytime
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger>Does it only work on Chrome?</AccordionTrigger>
              <AccordionContent>
                Currently yes, Chrome and Edge (Chromium-based). Safari and Firefox support coming soon.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-5">
              <AccordionTrigger>What does the AI actually do?</AccordionTrigger>
              <AccordionContent>
                FocusTube looks at video titles, tags, and channels to detect likely distractions. It's simple, effective, and fast. Over time, it learns from your habits to filter based on *your* goals.
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
            YouTube's not the problem. Losing control is. FocusTube helps you stay intentional, without blocking everything.
          </p>
          <Button size="lg" asChild data-evt="final_cta">
            <Link to="/signup">Start Free Trial</Link>
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
