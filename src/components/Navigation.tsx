import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChefHat, Package, Calendar, ShoppingCart, List, Home, Calculator, History } from "lucide-react";

interface NavigationProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export const Navigation = ({ currentPage, onNavigate }: NavigationProps) => {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home, variant: 'dreamy' as const },
    { id: 'inventory', label: 'Pantry', icon: Package, variant: 'lavender' as const },
    { id: 'recipes', label: 'Recipes', icon: ChefHat, variant: 'default' as const },
    { id: 'meal-plan', label: 'Jackson Meals', icon: Calendar, variant: 'butter' as const },
    { id: 'shore-meal-plan', label: 'Shore Meals', icon: Calendar, variant: 'mint' as const },
    { id: 'grocery', label: 'Grocery List', icon: ShoppingCart, variant: 'baby-blue' as const },
    { id: 'history', label: 'History', icon: History, variant: 'secondary' as const },
    { id: 'staples', label: 'Staples', icon: List, variant: 'secondary' as const },
    { id: 'conversions', label: 'Conversions', icon: Calculator, variant: 'mint' as const },
  ];

  return (
    <Card className="w-full mb-6">
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-2 justify-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                variant={currentPage === item.id ? item.variant : 'outline'}
                onClick={() => onNavigate(item.id)}
                className="flex items-center gap-2"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};