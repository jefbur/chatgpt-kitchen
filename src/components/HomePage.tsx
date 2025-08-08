import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, ChefHat, Calendar, ShoppingCart, List, Sparkles } from "lucide-react";
import heroImage from "@/assets/hero-kitchen.jpg";

interface HomePageProps {
  onNavigate: (page: string) => void;
}

export const HomePage = ({ onNavigate }: HomePageProps) => {
  const quickActions = [
    {
      title: "Manage Pantry",
      description: "View and organize your Jackson & Shore inventories",
      icon: Package,
      action: () => onNavigate('inventory'),
      variant: 'mint' as const,
      gradient: 'from-mint to-mint/80'
    },
    {
      title: "Browse Recipes",
      description: "Explore your digital cookbook and create new dishes",
      icon: ChefHat,
      action: () => onNavigate('recipes'),
      variant: 'lavender' as const,
      gradient: 'from-lavender to-lavender/80'
    },
    {
      title: "Plan Meals",
      description: "Schedule Week A & B meal plans",
      icon: Calendar,
      action: () => onNavigate('meal-plan'),
      variant: 'butter' as const,
      gradient: 'from-butter to-butter/80'
    },
    {
      title: "Grocery List",
      description: "Smart shopping list from meal plans & staples",
      icon: ShoppingCart,
      action: () => onNavigate('grocery'),
      variant: 'baby-blue' as const,
      gradient: 'from-baby-blue to-baby-blue/80'
    },
    {
      title: "Staples Management",
      description: "Set minimum quantities for essential items",
      icon: List,
      action: () => onNavigate('staples'),
      variant: 'pink' as const,
      gradient: 'from-pink to-pink/80'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-muted">
      {/* Hero Section */}
      <div className="relative h-64 overflow-hidden rounded-lg mb-8">
        <img 
          src={heroImage} 
          alt="Dream Kitchen" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-lavender/20 to-baby-blue/20 flex items-center justify-center">
          <div className="text-center text-white">
            <h1 className="text-4xl font-bold mb-2 drop-shadow-lg">
              Your Dream Kitchen
            </h1>
            <p className="text-xl drop-shadow-md">
              Complete recipe & inventory management for Jackson & Shore
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Card 
              key={action.title} 
              className="hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer border-2"
              onClick={action.action}
            >
              <CardHeader className={`bg-gradient-to-r ${action.gradient} text-white rounded-t-lg`}>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="h-6 w-6" />
                  {action.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <p className="text-muted-foreground mb-4">{action.description}</p>
                <Button variant={action.variant} className="w-full">
                  Get Started
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Welcome Message */}
      <Card className="text-center p-8 bg-gradient-to-r from-primary/10 via-lavender/10 to-baby-blue/10">
        <CardContent>
          <Sparkles className="h-12 w-12 mx-auto mb-4 text-primary" />
          <h2 className="text-2xl font-semibold mb-4">Welcome to Your Kitchen Command Center</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Manage your ingredients across two locations, plan perfect meals, 
            generate smart grocery lists, and never run out of your favorite staples. 
            Your kitchen, organized beautifully.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
