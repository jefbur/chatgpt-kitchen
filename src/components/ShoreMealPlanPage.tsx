import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar, ChefHat, Copy, Trash2, CheckCircle, ShoppingCart, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface MealPlan {
  id: string;
  recipe_id: string;
  day_of_week: string;
  meal_type: string;
  week_type: string;
  location: string;
  recipe?: {
    id: string;
    name: string;
    servings: number;
  };
}

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const mealTypes = [
  { name: 'Breakfast', slots: 2 },
  { name: 'Lunch', slots: 2 },
  { name: 'Dinner', slots: 4 }
];

export const ShoreMealPlanPage = () => {
  const [currentWeek, setCurrentWeek] = useState<'A' | 'B'>('A');
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [weekNotes, setWeekNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  // Remove useNavigate as we're using internal navigation

  const saveToHistory = () => {
    const today = new Date();
    const monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    const dateString = `${monthNames[today.getMonth()]} ${today.getDate()}, 2025`;

    // Create meals grid
    const mealsGrid: { [key: string]: { [key: string]: string[] } } = {};
    
    daysOfWeek.forEach(day => {
      mealsGrid[day] = {};
      mealTypes.forEach(mealType => {
        const dayMeals = getMealsForDayAndType(day, mealType.name);
        mealsGrid[day][mealType.name] = dayMeals.map(meal => meal.recipe?.name || 'Unknown Recipe');
      });
    });

    const newEntry = {
      date: dateString,
      weekType: currentWeek,
      location: 'Shore' as const,
      meals: mealsGrid
    };

    // Get existing history
    const savedHistory = localStorage.getItem('mealPlanHistory');
    const existingHistory = savedHistory ? JSON.parse(savedHistory) : [];
    
    const updatedHistory = [newEntry, ...existingHistory];
    localStorage.setItem('mealPlanHistory', JSON.stringify(updatedHistory));

    toast({
      title: "Success",
      description: "Shore meal plan added to history"
    });
  };

  useEffect(() => {
    fetchMealPlans();
  }, [currentWeek]);

  const fetchMealPlans = async () => {
    try {
      const { data: mealPlanData, error } = await supabase
        .from('meal_plans')
        .select('*')
        .eq('week_type', currentWeek)
        .eq('location', 'Shore');

      if (error) throw error;

      // Get recipe details separately
      const recipeIds = mealPlanData?.map(mp => mp.recipe_id) || [];
      const { data: recipeData, error: recipeError } = await supabase
        .from('recipes')
        .select('id, name, servings')
        .in('id', recipeIds);

      if (recipeError) throw recipeError;

      // Combine meal plan and recipe data
      const mealPlansWithRecipes = mealPlanData?.map(mp => ({
        ...mp,
        recipe: recipeData?.find(r => r.id === mp.recipe_id)
      })) || [];

      setMealPlans(mealPlansWithRecipes);

    } catch (error) {
      console.error('Error fetching meal plans:', error);
      toast({
        title: "Error",
        description: "Failed to load meal plans",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const removeMealFromPlan = async (mealPlanId: string) => {
    try {
      const { error } = await supabase
        .from('meal_plans')
        .delete()
        .eq('id', mealPlanId);

      if (error) throw error;
      
      fetchMealPlans();
      toast({
        title: "Success",
        description: "Meal removed from plan"
      });
    } catch (error) {
      console.error('Error removing meal:', error);
      toast({
        title: "Error",
        description: "Failed to remove meal",
        variant: "destructive"
      });
    }
  };

  const markMealAsCooked = async (mealPlan: MealPlan) => {
    try {
      // Get recipe ingredients
      const { data: ingredients, error: ingredientsError } = await supabase
        .from('recipe_ingredients')
        .select('*')
        .eq('recipe_id', mealPlan.recipe_id);

      if (ingredientsError) throw ingredientsError;

      // Deduct ingredients from Shore pantry (user_id: 11111111-1111-1111-1111-111111111111)
      for (const ingredient of ingredients || []) {
        const { data: pantryItems, error: pantryError } = await supabase
          .from('pantry_items')
          .select('*')
          .eq('name', ingredient.ingredient_name)
          .eq('location', ingredient.location)
          .eq('user_id', '11111111-1111-1111-1111-111111111111');

        if (pantryError) throw pantryError;

        if (pantryItems && pantryItems.length > 0) {
          const pantryItem = pantryItems[0];
          const newQuantity = Math.max(0, Number(pantryItem.quantity) - Number(ingredient.quantity));
          
          const { error: updateError } = await supabase
            .from('pantry_items')
            .update({ quantity: newQuantity })
            .eq('id', pantryItem.id);

          if (updateError) throw updateError;

          // If quantity goes to 0, add to shopping list with & symbol
          if (newQuantity === 0) {
            const { error: shoppingError } = await supabase
              .from('shopping_list')
              .insert({
                item_name: `&${ingredient.ingredient_name}`,
                quantity: ingredient.quantity,
                unit: ingredient.unit,
                location: ingredient.location,
                user_id: '00000000-0000-0000-0000-000000000000'
              });

            if (shoppingError) console.error('Error adding to shopping list:', shoppingError);
          }
        }
      }

      toast({
        title: "Success",
        description: "Meal marked as cooked and ingredients deducted from Shore"
      });
    } catch (error) {
      console.error('Error marking meal as cooked:', error);
      toast({
        title: "Error",
        description: "Failed to mark meal as cooked",
        variant: "destructive"
      });
    }
  };

  const clearWeekPlan = async () => {
    if (!confirm('Are you sure you want to clear this week\'s Shore meal plan?')) return;

    try {
      const { error } = await supabase
        .from('meal_plans')
        .delete()
        .eq('week_type', currentWeek)
        .eq('location', 'Shore');

      if (error) throw error;

      fetchMealPlans();
      toast({
        title: "Success",
        description: "Shore week plan cleared"
      });
    } catch (error) {
      console.error('Error clearing week plan:', error);
      toast({
        title: "Error",
        description: "Failed to clear week plan",
        variant: "destructive"
      });
    }
  };

  const generateShoreGroceryList = async () => {
    try {
      // Get all recipes for the week
      const recipeIds = mealPlans.map(mp => mp.recipe_id);
      
      if (recipeIds.length === 0) {
        toast({
          title: "No meals planned",
          description: "Add some recipes to your Shore meal plan first"
        });
        return;
      }

      const { data: allIngredients, error } = await supabase
        .from('recipe_ingredients')
        .select('*')
        .in('recipe_id', recipeIds);

      if (error) throw error;

      // Aggregate ingredients by name and location
      const aggregatedIngredients = (allIngredients || []).reduce((acc, ingredient) => {
        const key = `${ingredient.ingredient_name}-${ingredient.location}`;
        if (acc[key]) {
          acc[key].quantity = Number(acc[key].quantity) + Number(ingredient.quantity);
        } else {
          acc[key] = { ...ingredient };
        }
        return acc;
      }, {} as Record<string, any>);

      // Check against current Shore pantry and add to shopping list
      for (const ingredient of Object.values(aggregatedIngredients)) {
        const { data: pantryItems } = await supabase
          .from('pantry_items')
          .select('*')
          .eq('name', ingredient.ingredient_name)
          .eq('location', ingredient.location)
          .eq('user_id', '11111111-1111-1111-1111-111111111111');

        const currentQuantity = pantryItems?.[0]?.quantity || 0;
        const neededQuantity = Math.max(0, Number(ingredient.quantity) - Number(currentQuantity));

        if (neededQuantity > 0) {
          const { error: shoppingError } = await supabase
            .from('shopping_list')
            .upsert({
              item_name: `&${ingredient.ingredient_name}`,
              quantity: neededQuantity,
              unit: ingredient.unit,
              location: ingredient.location,
              user_id: '00000000-0000-0000-0000-000000000000'
            });

          if (shoppingError) console.error('Error adding to shopping list:', shoppingError);
        }
      }

      toast({
        title: "Success",
        description: "Shore grocery list generated from meal plan"
      });
    } catch (error) {
      console.error('Error generating grocery list:', error);
      toast({
        title: "Error",
        description: "Failed to generate grocery list",
        variant: "destructive"
      });
    }
  };

  const getMealsForDayAndType = (day: string, mealType: string) => {
    return mealPlans.filter(mp => mp.day_of_week === day && mp.meal_type === mealType);
  };

  if (loading) {
    return <div className="text-center p-8">Loading Shore meal plans...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-baby-blue flex items-center justify-center">
              <Calendar className="h-4 w-4" />
            </div>
            Meal Planning at the Shore
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={currentWeek} onValueChange={(value) => setCurrentWeek(value as 'A' | 'B')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="A" className="data-[state=active]:bg-mint">
                Week A
              </TabsTrigger>
              <TabsTrigger value="B" className="data-[state=active]:bg-baby-blue">
                Week B
              </TabsTrigger>
            </TabsList>

            <TabsContent value={currentWeek} className="space-y-4">
              {/* Week Notes */}
              <Card>
                <CardContent className="p-4">
                  <Textarea
                    placeholder="Shore week notes and reminders..."
                    value={weekNotes}
                    onChange={(e) => setWeekNotes(e.target.value)}
                    className="min-h-20"
                  />
                </CardContent>
              </Card>

              {/* Meal Plan Grid */}
              <div className="overflow-x-auto">
                <div className="min-w-[1000px]">
                  {/* Header with days */}
                  <div className="grid grid-cols-8 gap-2 mb-4">
                    <div className="font-semibold text-sm">Meal Type</div>
                    {daysOfWeek.map(day => (
                      <div key={day} className="font-semibold text-sm text-center">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Meal type rows */}
                  {mealTypes.map(mealType => (
                    <div key={mealType.name} className="grid grid-cols-8 gap-2 mb-4">
                      <div className="font-medium text-sm flex items-center">
                        {mealType.name}
                        <Badge variant="outline" className="ml-2 text-xs">
                          {mealType.slots}
                        </Badge>
                      </div>
                       {daysOfWeek.map(day => (
                         <div key={day} className="space-y-1 min-h-[120px]">
                           {getMealsForDayAndType(day, mealType.name).map(meal => (
                             <Card key={meal.id} className="p-2">
                               <div className="text-xs font-medium mb-2 whitespace-normal">
                                 {meal.recipe?.name || 'Unknown Recipe'}
                               </div>
                              <div className="flex flex-col gap-1">
                                    <div className="flex gap-1 mb-1">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-6 px-2 text-xs flex-1"
                                          onClick={() => {
                                            // Store recipe ID for viewing and navigate using internal navigation
                                            sessionStorage.setItem('viewRecipe', meal.recipe_id);
                                            // Use internal navigation by posting a message
                                            window.postMessage({ type: 'navigate', page: 'recipes' }, '*');
                                          }}
                                          title="View recipe"
                                        >
                                          View Recipe
                                        </Button>
                                    </div>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 px-2 text-xs"
                                    onClick={() => markMealAsCooked(meal)}
                                    title="Mark as cooked"
                                  >
                                    <CheckCircle className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-6 px-2 text-xs"
                                    onClick={() => removeMealFromPlan(meal.id)}
                                    title="Remove from plan"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-4 border-t">
                <Button variant="baby-blue" onClick={generateShoreGroceryList}>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Plan set. Update shopping list now
                </Button>
                <Button variant="outline" onClick={clearWeekPlan}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Shore Week
                </Button>
                <Button variant="mint" onClick={saveToHistory}>
                  <History className="h-4 w-4 mr-2" />
                  Add meal plan to history
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};