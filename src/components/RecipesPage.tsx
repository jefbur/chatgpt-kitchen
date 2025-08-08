import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, ChefHat, Calendar, Sparkles, Clock, Eye, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AIRecipeDialog } from "./AIRecipeDialog";
import { AddRecipeDialog } from "./AddRecipeDialog";
import { RecipeIngredientsEditor } from "./RecipeIngredientsEditor";
import { getConversionFactor } from "./ConversionFactorsPage";

interface Recipe {
  id: string;
  name: string;
  ingredients: string;
  directions: string;
  notes: string;
  tags: string[];
  servings?: number;
  cookTime?: string;
}

export const RecipesPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [editingRecipe, setEditingRecipe] = useState<any>(null);
  const [editingIngredients, setEditingIngredients] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchRecipes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('recipes')
        .select(`
          *,
          recipe_ingredients (
            ingredient_name,
            quantity,
            unit
          )
        `)
        .order('name');

      if (error) throw error;
      const recipeData = data || [];
      setRecipes(recipeData);
      return recipeData;
    } catch (error) {
      console.error('Error fetching recipes:', error);
      toast({
        title: "Error",
        description: "Failed to load recipes",
        variant: "destructive"
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initializeRecipes = async () => {
      const recipeData = await fetchRecipes();
      
      // Check if we need to highlight a specific recipe
      const highlightRecipeId = sessionStorage.getItem('highlightRecipe');
      if (highlightRecipeId) {
        // Clear the stored ID
        sessionStorage.removeItem('highlightRecipe');
        // Scroll to and highlight the recipe after a brief delay
        setTimeout(() => {
          const recipeCard = document.querySelector(`[data-recipe-id="${highlightRecipeId}"]`);
          if (recipeCard) {
            recipeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            recipeCard.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
            // Remove highlight after 3 seconds
            setTimeout(() => {
              recipeCard.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
            }, 3000);
          }
        }, 500);
      }

      // Check if we need to view a specific recipe
      const viewRecipeId = sessionStorage.getItem('viewRecipe');
      if (viewRecipeId) {
        sessionStorage.removeItem('viewRecipe');
        const recipe = recipeData.find(r => r.id === viewRecipeId);
        if (recipe) {
          handleViewRecipe(recipe);
        }
      }

      // Check if we need to edit a specific recipe
      const editRecipeId = sessionStorage.getItem('editRecipe');
      if (editRecipeId) {
        sessionStorage.removeItem('editRecipe');
        const recipe = recipeData.find(r => r.id === editRecipeId);
        if (recipe) {
          handleEditRecipe(recipe);
        }
      }
    };

    initializeRecipes();
  }, []);

  const allTags = [...new Set(recipes.flatMap(recipe => recipe.tags || []))];
  
  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = recipe.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         recipe.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTags = selectedTags.length === 0 || 
                       selectedTags.some(tag => (recipe.tags || []).includes(tag));
    return matchesSearch && matchesTags;
  });

  const handleViewRecipe = (recipe: any) => {
    setSelectedRecipe(recipe);
  };

  const handleEditRecipe = (recipe: any) => {
    setEditingRecipe(recipe);
  };

  const handleCookAtShore = async (recipe: any) => {
    try {
      // Get recipe ingredients
      const { data: ingredients, error: ingredientsError } = await supabase
        .from('recipe_ingredients')
        .select('*')
        .eq('recipe_id', recipe.id);

      if (ingredientsError) throw ingredientsError;

      let successfulDeductions = 0;
      let missingIngredients: string[] = [];

      // Deduct ingredients from Shore pantry (user_id: 11111111-1111-1111-1111-111111111111)
      for (const ingredient of ingredients || []) {
        // Skip salt, pepper, olive oil, oil - assume endless supply
        if (['salt', 'pepper', 'olive oil', 'oil'].includes(ingredient.ingredient_name.toLowerCase())) {
          successfulDeductions++;
          continue;
        }

        const { data: pantryItems, error: pantryError } = await supabase
          .from('pantry_items')
          .select('*')
          .eq('name', ingredient.ingredient_name)
          .eq('user_id', '11111111-1111-1111-1111-111111111111');

        if (pantryError) throw pantryError;

        if (pantryItems && pantryItems.length > 0) {
          const pantryItem = pantryItems[0];
          
          let actualIngredientQuantity = Number(ingredient.quantity);
          
          // Check if units match or if we need conversion
          if (pantryItem.unit !== ingredient.unit) {
            const conversionFactor = await getConversionFactor(ingredient.ingredient_name, pantryItem.unit, ingredient.unit);
            if (conversionFactor) {
              // Convert pantry quantity to recipe unit
              const convertedPantryQuantity = Number(pantryItem.quantity) * conversionFactor;
              actualIngredientQuantity = convertedPantryQuantity >= actualIngredientQuantity ? actualIngredientQuantity : convertedPantryQuantity;
            } else {
              toast({
                title: "Unit Conversion Needed",
                description: `Cannot subtract ${ingredient.quantity} ${ingredient.unit || 'each'} of ${ingredient.ingredient_name} from ${pantryItem.quantity} ${pantryItem.unit}. Please add conversion factor.`,
                variant: "destructive"
              });
              continue;
            }
          }
          
          const currentQuantity = Number(pantryItem.quantity);
          
          // If not enough, set to 0, otherwise subtract
          const newQuantity = currentQuantity >= actualIngredientQuantity ? 
            currentQuantity - actualIngredientQuantity : 0;
          
          const { error: updateError } = await supabase
            .from('pantry_items')
            .update({ quantity: newQuantity })
            .eq('id', pantryItem.id);

          if (updateError) throw updateError;
          successfulDeductions++;
        } else {
          missingIngredients.push(`${ingredient.ingredient_name} (${ingredient.location})`);
        }
      }

      if (missingIngredients.length > 0) {
        toast({
          title: "Partial Success",
          description: `${recipe.name} marked as made at Shore. Missing ingredients: ${missingIngredients.join(', ')}`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Success",
          description: `${recipe.name} marked as made at Shore. All ${successfulDeductions} ingredients deducted.`
        });
      }
    } catch (error) {
      console.error('Error marking recipe as made at Shore:', error);
      toast({
        title: "Error",
        description: `Failed to mark recipe as made at Shore: ${error.message || 'Unknown error'}`,
        variant: "destructive"
      });
    }
  };

  const handleCookAtJackson = async (recipe: any) => {
    try {
      // Get recipe ingredients
      const { data: ingredients, error: ingredientsError } = await supabase
        .from('recipe_ingredients')
        .select('*')
        .eq('recipe_id', recipe.id);

      if (ingredientsError) throw ingredientsError;

      let successfulDeductions = 0;
      let missingIngredients: string[] = [];

      // Deduct ingredients from Jackson pantry (user_id: 00000000-0000-0000-0000-000000000000)
      for (const ingredient of ingredients || []) {
        // Skip salt, pepper, olive oil, oil - assume endless supply
        if (['salt', 'pepper', 'olive oil', 'oil'].includes(ingredient.ingredient_name.toLowerCase())) {
          successfulDeductions++;
          continue;
        }

        // Smart fruit to juice conversion
        let actualIngredientName = ingredient.ingredient_name;
        let actualQuantity = Number(ingredient.quantity);
        let actualUnit = ingredient.unit || 'each';

        // Check for fruit to juice conversions
        const fruitConversions = {
          'lemon': { from: 'whole', to: 'lemon juice', factor: 2, unit: 'tbsp' },
          'lime': { from: 'whole', to: 'lime juice', factor: 1.5, unit: 'tsp' },
          'orange': { from: 'whole', to: 'orange juice', factor: 3, unit: 'tbsp' }
        };

        for (const [fruit, conversion] of Object.entries(fruitConversions)) {
          if (actualIngredientName.toLowerCase().includes(fruit) && actualUnit === 'whole') {
            // Convert to juice equivalent
            actualIngredientName = conversion.to;
            actualQuantity = actualQuantity * conversion.factor;
            actualUnit = conversion.unit;
            break;
          } else if (actualIngredientName.toLowerCase().includes(`${fruit} juice`)) {
            // Already juice, just check for whole fruit in pantry
            actualIngredientName = fruit;
            // Find whole fruits and convert
            const wholeNeeded = Math.ceil(actualQuantity / conversion.factor);
            actualQuantity = wholeNeeded;
            actualUnit = 'whole';
            break;
          }
        }

        // Search all locations at Jackson (check all items, not just pantry)
        const { data: pantryItems, error: pantryError } = await supabase
          .from('pantry_items')
          .select('*')
          .eq('name', actualIngredientName)
          .eq('user_id', '00000000-0000-0000-0000-000000000000');

        if (pantryError) throw pantryError;

        if (pantryItems && pantryItems.length > 0) {
          const pantryItem = pantryItems[0];
          
          // Check if units match or if we need conversion
          if (pantryItem.unit !== actualUnit) {
            const conversionFactor = await getConversionFactor(actualIngredientName, pantryItem.unit, actualUnit);
            if (conversionFactor) {
              // Convert pantry quantity to recipe unit
              const convertedPantryQuantity = Number(pantryItem.quantity) * conversionFactor;
              actualQuantity = convertedPantryQuantity >= actualQuantity ? actualQuantity : convertedPantryQuantity;
            } else {
              toast({
                title: "Unit Conversion Needed",
                description: `Cannot subtract ${actualQuantity} ${actualUnit} of ${actualIngredientName} from ${pantryItem.quantity} ${pantryItem.unit}. Please add conversion factor.`,
                variant: "destructive"
              });
              continue;
            }
          }
          
          const currentQuantity = Number(pantryItem.quantity);
          
          // If not enough, set to 0, otherwise subtract
          const newQuantity = currentQuantity >= actualQuantity ? 
            currentQuantity - actualQuantity : 0;
          
          const { error: updateError } = await supabase
            .from('pantry_items')
            .update({ quantity: newQuantity })
            .eq('id', pantryItem.id);

          if (updateError) throw updateError;
          successfulDeductions++;
        } else {
          missingIngredients.push(`${actualIngredientName} (any location)`);
        }
      }

      if (missingIngredients.length > 0) {
        toast({
          title: "Partial Success",
          description: `${recipe.name} marked as made in Jackson. Missing ingredients: ${missingIngredients.join(', ')}`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Success",
          description: `${recipe.name} marked as made in Jackson. All ${successfulDeductions} ingredients deducted.`
        });
      }
    } catch (error) {
      console.error('Error marking recipe as made in Jackson:', error);
      toast({
        title: "Error",
        description: `Failed to mark recipe as made in Jackson: ${error.message || 'Unknown error'}`,
        variant: "destructive"
      });
    }
  };

  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [recipeToSchedule, setRecipeToSchedule] = useState<any>(null);

  const handleScheduleRecipe = (recipe: any) => {
    setRecipeToSchedule(recipe);
    setShowScheduleDialog(true);
  };

  const deleteRecipe = async (recipeId: string) => {
    if (!confirm('Are you sure you want to delete this recipe? This action cannot be undone.')) return;

    try {
      // Delete recipe ingredients first
      const { error: ingredientsError } = await supabase
        .from('recipe_ingredients')
        .delete()
        .eq('recipe_id', recipeId);

      if (ingredientsError) throw ingredientsError;

      // Delete the recipe
      const { error: recipeError } = await supabase
        .from('recipes')
        .delete()
        .eq('id', recipeId);

      if (recipeError) throw recipeError;

      fetchRecipes();
      toast({
        title: "Success",
        description: "Recipe deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting recipe:', error);
      toast({
        title: "Error",
        description: "Failed to delete recipe",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-lavender flex items-center justify-center">
              👨‍🍳
            </div>
            Digital Cookbook
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
          <div className="space-y-4 mb-6">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-64">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search recipes or ingredients..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <AddRecipeDialog onRecipeAdded={fetchRecipes} />

              <AIRecipeDialog onRecipeAdded={fetchRecipes} />
            </div>

            {/* Tag Filters */}
            <div className="flex flex-wrap gap-2">
              <span className="text-sm font-medium">Filter by tags:</span>
              {allTags.map(tag => (
                <Button
                  key={tag}
                  size="sm"
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  onClick={() => {
                    setSelectedTags(prev => 
                      prev.includes(tag) 
                        ? prev.filter(t => t !== tag)
                        : [...prev, tag]
                    );
                  }}
                >
                  {tag}
                </Button>
              ))}
              {selectedTags.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedTags([])}
                >
                  Clear filters
                </Button>
              )}
            </div>
          </div>

          {/* Recipes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRecipes.map(recipe => (
              <Card key={recipe.id} data-recipe-id={recipe.id} className="hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
                <CardHeader className="bg-gradient-to-r from-lavender to-lavender/80 text-lavender-foreground">
                  <CardTitle className="text-lg">{recipe.name}</CardTitle>
                  <div className="flex gap-2 text-sm">
                    {recipe.servings && (
                      <span className="flex items-center gap-1">
                        👥 {recipe.servings}
                      </span>
                    )}
                    {recipe.cookTime && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {recipe.cookTime}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-semibold text-sm mb-1">Ingredients:</h4>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {recipe.recipe_ingredients?.map((ing: any) => `${ing.quantity} ${ing.unit === 'each' ? '' : ing.unit + ' '}${ing.ingredient_name}`).join(', ') || 'No ingredients listed'}
                      </p>
                    </div>
                    
                    <div className="flex flex-wrap gap-1">
                      {recipe.tags.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    <div className="space-y-2 pt-2">
                      <div className="grid grid-cols-3 gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleViewRecipe(recipe)}>
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleEditRecipe(recipe)}>
                          <Edit className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingIngredients(recipe)}>
                          <Edit className="h-3 w-3 mr-1" />
                          Ingredients
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleCookAtShore(recipe)} className="text-xs px-1">
                          <ChefHat className="h-3 w-3 mr-1" />
                          Made at Shore
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleCookAtJackson(recipe)} className="text-xs px-1">
                          <ChefHat className="h-3 w-3 mr-1" />
                          Made in Jackson
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button size="sm" variant="butter" onClick={() => handleScheduleRecipe(recipe)}>
                          <Calendar className="h-3 w-3 mr-1" />
                          Schedule
                        </Button>
                        <Button size="sm" variant="baby-blue" onClick={() => deleteRecipe(recipe.id)}>
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>

                    {recipe.notes && (
                      <p className="text-xs text-muted-foreground italic border-t pt-2">
                        💡 {recipe.notes}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredRecipes.length === 0 && (
            <Card className="text-center p-8">
              <CardContent>
                <ChefHat className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  No recipes found. Create your first recipe to get started!
                </p>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* View Recipe Dialog */}
      <Dialog open={!!selectedRecipe} onOpenChange={() => setSelectedRecipe(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedRecipe?.name}</DialogTitle>
          </DialogHeader>
          {selectedRecipe && (
            <div className="space-y-6">
              <div className="flex gap-4 text-sm text-muted-foreground">
                {selectedRecipe.servings && (
                  <span className="flex items-center gap-1">
                    👥 {selectedRecipe.servings} servings
                  </span>
                )}
                {selectedRecipe.prep_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Prep: {selectedRecipe.prep_time}m
                  </span>
                )}
                {selectedRecipe.cook_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Cook: {selectedRecipe.cook_time}m
                  </span>
                )}
              </div>

              {selectedRecipe.description && (
                <div>
                  <h4 className="font-semibold mb-2">Description:</h4>
                  <p className="text-muted-foreground">{selectedRecipe.description}</p>
                </div>
              )}

              <div>
                <h4 className="font-semibold mb-2">Ingredients:</h4>
                <ul className="space-y-1">
                  {selectedRecipe.recipe_ingredients?.map((ingredient: any, index: number) => (
                    <li key={index}>
                      <span>{ingredient.quantity} {ingredient.unit === 'each' ? '' : ingredient.unit + ' '}{ingredient.ingredient_name}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {selectedRecipe.instructions && (
                <div>
                  <h4 className="font-semibold mb-2">Instructions:</h4>
                  <p className="whitespace-pre-wrap">{selectedRecipe.instructions}</p>
                </div>
              )}

              {selectedRecipe.notes && (
                <div>
                  <h4 className="font-semibold mb-2">Notes:</h4>
                  <p className="text-muted-foreground">{selectedRecipe.notes}</p>
                </div>
              )}

              {selectedRecipe.tags && selectedRecipe.tags.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Tags:</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedRecipe.tags.map((tag: string) => (
                      <Badge key={tag} variant="outline">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-4 border-t">
                <Button onClick={() => { setSelectedRecipe(null); handleEditRecipe(selectedRecipe); }}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Recipe
                </Button>
                <Button variant="outline" onClick={() => { setSelectedRecipe(null); setEditingIngredients(selectedRecipe); }}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Ingredients
                </Button>
                <Button variant="outline" onClick={() => handleCookAtShore(selectedRecipe)}>
                  <ChefHat className="h-4 w-4 mr-2" />
                  Made at Shore
                </Button>
                <Button variant="outline" onClick={() => handleCookAtJackson(selectedRecipe)}>
                  <ChefHat className="h-4 w-4 mr-2" />
                  Made in Jackson
                </Button>
                <Button variant="butter" onClick={() => handleScheduleRecipe(selectedRecipe)}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Recipe Dialog */}
      <Dialog open={!!editingRecipe} onOpenChange={() => setEditingRecipe(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Recipe</DialogTitle>
          </DialogHeader>
          {editingRecipe && (
            <EditRecipeForm 
              recipe={editingRecipe} 
              onSave={() => { 
                setEditingRecipe(null); 
                fetchRecipes(); 
              }} 
              onCancel={() => setEditingRecipe(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Schedule Recipe Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Recipe: {recipeToSchedule?.name}</DialogTitle>
          </DialogHeader>
          <ScheduleRecipeForm 
            recipe={recipeToSchedule}
            onScheduled={() => {
              setShowScheduleDialog(false);
              setRecipeToSchedule(null);
            }}
            onCancel={() => {
              setShowScheduleDialog(false);
              setRecipeToSchedule(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <RecipeIngredientsEditor
        open={!!editingIngredients}
        onOpenChange={() => setEditingIngredients(null)}
        recipe={editingIngredients}
        onUpdate={() => {
          fetchRecipes();
          setEditingIngredients(null);
        }}
      />
    </div>
  );
};

// Edit Recipe Form Component
const EditRecipeForm = ({ recipe, onSave, onCancel }: { recipe: any, onSave: () => void, onCancel: () => void }) => {
  const [formData, setFormData] = useState({
    name: recipe.name || '',
    description: recipe.description || '',
    instructions: recipe.instructions || '',
    notes: recipe.notes || '',
    servings: recipe.servings || 1,
    prep_time: recipe.prep_time || 0,
    cook_time: recipe.cook_time || 0,
    tags: (recipe.tags || []).join(', ')
  });
  const { toast } = useToast();

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from('recipes')
        .update({
          name: formData.name,
          description: formData.description,
          instructions: formData.instructions,
          notes: formData.notes,
          servings: formData.servings,
          prep_time: formData.prep_time,
          cook_time: formData.cook_time,
          tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
          updated_at: new Date().toISOString()
        })
        .eq('id', recipe.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Recipe updated successfully"
      });

      onSave();
    } catch (error) {
      console.error('Error updating recipe:', error);
      toast({
        title: "Error",
        description: "Failed to update recipe",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-4">
      <Input
        placeholder="Recipe name"
        value={formData.name}
        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
      />
      
      <Textarea
        placeholder="Description"
        value={formData.description}
        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
        rows={2}
      />

      <Textarea
        placeholder="Ingredients (one per line, format: quantity unit ingredient name)"
        value={recipe.recipe_ingredients?.map((ing: any) => `${ing.quantity} ${ing.unit} ${ing.ingredient_name}`).join('\n') || ''}
        onChange={(e) => {
          // This would need to be handled by updating recipe_ingredients table
          // For now, we'll show the current ingredients read-only
        }}
        rows={4}
        readOnly
        className="bg-muted"
      />

      <Textarea
        placeholder="Instructions"
        value={formData.instructions}
        onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
        rows={6}
      />

      <Textarea
        placeholder="Notes (optional)"
        value={formData.notes}
        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
        rows={2}
      />

      <Input
        placeholder="Tags (comma separated)"
        value={formData.tags}
        onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
      />

      <div className="flex gap-2">
        <Input
          placeholder="Servings"
          type="number"
          value={formData.servings}
          onChange={(e) => setFormData(prev => ({ ...prev, servings: parseInt(e.target.value) || 1 }))}
          className="w-32"
        />
        <Input
          placeholder="Prep time (min)"
          type="number"
          value={formData.prep_time}
          onChange={(e) => setFormData(prev => ({ ...prev, prep_time: parseInt(e.target.value) || 0 }))}
          className="w-32"
        />
        <Input
          placeholder="Cook time (min)"
          type="number"
          value={formData.cook_time}
          onChange={(e) => setFormData(prev => ({ ...prev, cook_time: parseInt(e.target.value) || 0 }))}
          className="w-32"
        />
      </div>

      <div className="flex gap-2 pt-4">
        <Button onClick={handleSave} className="flex-1">
          Save Changes
        </Button>
        <Button onClick={onCancel} variant="outline" className="flex-1">
          Cancel
        </Button>
      </div>
    </div>
  );
};

// Schedule Recipe Form Component
const ScheduleRecipeForm = ({ recipe, onScheduled, onCancel }: { recipe: any, onScheduled: () => void, onCancel: () => void }) => {
  const [formData, setFormData] = useState({
    mealPlan: 'A',
    dayOfWeek: 'Monday',
    mealType: 'Breakfast'
  });
  const { toast } = useToast();

  const handleScheduleJackson = async () => {
    try {
      const { error } = await supabase
        .from('meal_plans')
        .insert({
          recipe_id: recipe.id,
          week_type: formData.mealPlan.toUpperCase(),
          day_of_week: formData.dayOfWeek,
          meal_type: formData.mealType,
          location: 'Jackson',
          user_id: '00000000-0000-0000-0000-000000000000'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: `${recipe.name} scheduled for Jackson ${formData.dayOfWeek} ${formData.mealType}`
      });

      onScheduled();
    } catch (error) {
      console.error('Error scheduling recipe for Jackson:', error);
      toast({
        title: "Error",
        description: "Failed to schedule recipe for Jackson",
        variant: "destructive"
      });
    }
  };

  const handleScheduleShore = async () => {
    try {
      const { error } = await supabase
        .from('meal_plans')
        .insert({
          recipe_id: recipe.id,
          week_type: formData.mealPlan.toUpperCase(),
          day_of_week: formData.dayOfWeek,
          meal_type: formData.mealType,
          location: 'Shore',
          user_id: '00000000-0000-0000-0000-000000000000'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: `${recipe.name} scheduled for Shore ${formData.dayOfWeek} ${formData.mealType}`
      });

      onScheduled();
    } catch (error) {
      console.error('Error scheduling recipe for Shore:', error);
      toast({
        title: "Error",
        description: "Failed to schedule recipe for Shore",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Meal Plan</label>
        <Select value={formData.mealPlan} onValueChange={(value) => setFormData(prev => ({ ...prev, mealPlan: value }))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="A">Plan A</SelectItem>
            <SelectItem value="B">Plan B</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium">Day of Week</label>
        <Select value={formData.dayOfWeek} onValueChange={(value) => setFormData(prev => ({ ...prev, dayOfWeek: value }))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Monday">Monday</SelectItem>
            <SelectItem value="Tuesday">Tuesday</SelectItem>
            <SelectItem value="Wednesday">Wednesday</SelectItem>
            <SelectItem value="Thursday">Thursday</SelectItem>
            <SelectItem value="Friday">Friday</SelectItem>
            <SelectItem value="Saturday">Saturday</SelectItem>
            <SelectItem value="Sunday">Sunday</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium">Meal Type</label>
        <Select value={formData.mealType} onValueChange={(value) => setFormData(prev => ({ ...prev, mealType: value }))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Breakfast">Breakfast</SelectItem>
            <SelectItem value="Lunch">Lunch</SelectItem>
            <SelectItem value="Dinner">Dinner</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 pt-4">
        <Button onClick={handleScheduleJackson} className="flex-1" variant="lavender">
          Schedule Jackson
        </Button>
        <Button onClick={handleScheduleShore} className="flex-1" variant="baby-blue">
          Schedule Shore
        </Button>
        <Button onClick={onCancel} variant="outline" className="flex-1">
          Cancel
        </Button>
      </div>
    </div>
  );
};