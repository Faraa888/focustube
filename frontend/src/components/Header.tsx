import { Link } from "react-router-dom";
import { Button } from "./ui/button";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

const Header = () => {
  return (
    <header className="fixed top-0 w-full z-50 bg-background/95 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="text-2xl font-bold text-primary hover:opacity-80 transition-opacity">
          FocusTube
        </Link>
        
        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <Link to="/" className="text-foreground hover:text-primary transition-colors text-sm font-medium">
            Home
          </Link>
          <Link to="/pricing" className="text-foreground hover:text-primary transition-colors text-sm font-medium">
            Pricing
          </Link>
          <Link to="/download" className="text-foreground hover:text-primary transition-colors text-sm font-medium">
            Download
          </Link>
          <Link to="/login" className="text-foreground hover:text-primary transition-colors text-sm font-medium">
            Login
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <Button asChild className="hidden md:inline-flex" data-evt="header_cta">
            <Link to="/signup">Start Free Trial</Link>
          </Button>
          
          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <nav className="flex flex-col gap-4 mt-8">
                <Link to="/" className="text-lg font-medium hover:text-primary transition-colors">
                  Home
                </Link>
                <Link to="/pricing" className="text-lg font-medium hover:text-primary transition-colors">
                  Pricing
                </Link>
                <Link to="/download" className="text-lg font-medium hover:text-primary transition-colors">
                  Download
                </Link>
                <Link to="/login" className="text-lg font-medium hover:text-primary transition-colors">
                  Login
                </Link>
                <Button asChild className="mt-4" data-evt="mobile_menu_cta">
                  <Link to="/signup">Start Free Trial</Link>
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default Header;
