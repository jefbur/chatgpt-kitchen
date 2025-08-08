import { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { HomePage } from "@/components/HomePage";
import { InventoryPage } from "@/components/InventoryPage";
import { RecipesPage } from "@/components/RecipesPage";
import { MealPlanPage } from "@/components/MealPlanPage";
import { ShoreMealPlanPage } from "@/components/ShoreMealPlanPage";
import { GroceryListPage } from "@/components/GroceryListPage";
import { HistoryPage } from "@/components/HistoryPage";
import { StaplesPage } from "@/components/StaplesPage";
import { ConversionFactorsPage } from "@/components/ConversionFactorsPage";

const Index = () => {
  const [currentPage, setCurrentPage] = useState('home');

  useEffect(() => {
    // Listen for navigation messages from meal plan
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'navigate' && event.data.page) {
        setCurrentPage(event.data.page);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage onNavigate={setCurrentPage} />;
      case 'inventory':
        return <InventoryPage />;
      case 'recipes':
        return <RecipesPage />;
      case 'meal-plan':
        return <MealPlanPage />;
      case 'shore-meal-plan':
        return <ShoreMealPlanPage />;
      case 'grocery':
        return <GroceryListPage />;
      case 'history':
        return <HistoryPage />;
      case 'staples':
        return <StaplesPage />;
      case 'conversions':
        return <ConversionFactorsPage />;
      default:
        return <HomePage onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-muted p-4">
      <div className="max-w-7xl mx-auto">
        <Navigation currentPage={currentPage} onNavigate={setCurrentPage} />
        {renderPage()}
      </div>
    </div>
  );
};

export default Index;
