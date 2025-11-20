import { useState } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Shield, Zap } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const Pricing = () => {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("yearly");
  
  const pricing = {
    monthly: { price: 4.99, total: 4.99 },
    yearly: { price: 4.20, total: 50 },
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-20 mt-16 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">
            14-day free trial • No credit card required
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Start free, upgrade when you're ready. Cancel anytime.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-12">
          <Tabs
            value={billingPeriod}
            onValueChange={(value) => setBillingPeriod(value as "monthly" | "yearly")}
            className="w-auto"
          >
            <TabsList>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="yearly">
                Yearly
                <Badge variant="secondary" className="ml-2">Save 17%</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-20">
          {/* Free Plan */}
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Free</CardTitle>
              <CardDescription>
                Core tools to help you stay focused
              </CardDescription>
              <div className="pt-4">
                <span className="text-5xl font-bold">$0</span>
                <span className="text-muted-foreground text-lg">/forever</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Block YouTube Shorts</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Basic search filtering</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Daily time limit (up to 60min)</span>
                </li>
              </ul>
              <Button variant="outline" className="w-full" size="lg" asChild>
                <Link to="/download" data-evt="pricing_free">Get Started Free</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Pro Plan */}
          <Card className="border-2 border-primary relative">
            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
              Most Popular
            </Badge>
            <CardHeader>
              <CardTitle className="text-2xl">Pro</CardTitle>
              <CardDescription>
                Built for deep work and distraction recovery
              </CardDescription>
              <div className="pt-4">
                <span className="text-5xl font-bold">
                  ${pricing[billingPeriod].price}
                </span>
                <span className="text-muted-foreground text-lg">/month</span>
                {billingPeriod === "yearly" && (
                  <div className="text-sm text-muted-foreground mt-1">
                    Billed $50/year
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="font-medium">Everything in Free, plus:</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>AI-powered video filtering</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Block specific distracting channels</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Spiral detection & distraction nudges</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Custom focus goals & session limits</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Full dashboard & analytics to stay ontop of your consumption</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Focus journal prompts</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>Priority support & early access</span>
                </li>
              </ul>
              <Button className="w-full" size="lg" asChild data-evt="pricing_pro">
                <Link to="/signup">Start 14-Day Free Trial</Link>
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                No credit card required
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Trust Badges */}
        <div className="flex flex-wrap justify-center items-center gap-8 mb-20 text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <span className="text-sm">Privacy-first</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            <span className="text-sm">Cancel anytime</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5" />
            <span className="text-sm">30-day money back</span>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">
            Pricing FAQ
          </h2>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>What happens after the free trial?</AccordionTrigger>
              <AccordionContent>
                After 14 days, you'll automatically move to the Free plan. You can upgrade to Pro anytime to keep using FocusTube features. We won't charge you automatically.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>Can I switch between plans?</AccordionTrigger>
              <AccordionContent>
                Yes! Upgrade or downgrade anytime. If you downgrade, you'll keep Pro features until the end of your billing period.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>Do you offer refunds?</AccordionTrigger>
              <AccordionContent>
                Yes, we offer a 30-day money-back guarantee on annual plans.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger>Is there a student discount?</AccordionTrigger>
              <AccordionContent>
                Yes! Students get 25% off Lifetime Access. Email us from your .edu address to verify and get your discount code.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-5">
              <AccordionTrigger>What payment methods do you accept?</AccordionTrigger>
              <AccordionContent>
                Stripe handles our payments — Visa, Mastercard, Amex. All payments are secure and encrypted.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-6">
              <AccordionTrigger>Can I use one subscription on multiple devices?</AccordionTrigger>
              <AccordionContent>
                Yes! Your Pro subscription works across all your devices where you're signed in to Chrome.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* CTA Section */}
        <div className="mt-20 text-center bg-card/50 border border-border rounded-lg p-12">
          <h2 className="text-3xl font-bold mb-4">
            Still have questions?
          </h2>
          <p className="text-muted-foreground mb-6">
            We're here to help. Reach out anytime.
          </p>
          <Button variant="outline" size="lg" asChild>
            <a href="mailto:support@focustube.co.uk">Contact Support</a>
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Pricing;
