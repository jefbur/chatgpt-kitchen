import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AddRecipeDialogProps {
  onRecipeAdded: () => void;
}

export const AddRecipeDialog = ({ onRecipeAdded }: AddRecipeDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    servings: 4,
    prepTime: 0,
    cookTime: 0,
    ingredients: '',
    instructions: '',
    notes: '',
    tags: ''
  });
  const { toast } = useToast();

  const units = ['teaspoon', 'tablespoon', 'cup', 'fluid ounce', 'pint', 'quart', 'gallon', 'ounce', 'pound', 'stick', 'can', 'jar', 'bunch', 'head', 'clove', 'each', 'bottle', 'bag'];
  const unitAbbreviations: { [key: string]: string } = {
    'tsp': 'teaspoon', 'tbsp': 'tablespoon', 'c': 'cup', 'fl oz': 'fluid ounce', 
    'pt': 'pint', 'qt': 'quart', 'gal': 'gallon', 'oz': 'ounce', 'lb': 'pound', 'lbs': 'pound'
  };

  const parseIngredients = (ingredientsText: string) => {
    const lines = ingredientsText.split('\n').filter(line => line.trim());
    return lines.map(line => {
      const parts = line.trim().split(/\s+/);
      const quantity = parseFloat(parts[0]) || 1;
      let unit = parts[1]?.toLowerCase() || '';
      
      // Check for abbreviations
      if (unitAbbreviations[unit]) {
        unit = unitAbbreviations[unit];
      }
      
      // Check if unit is in our list, otherwise default to 'each'
      if (!units.includes(unit)) {
        unit = 'each';
      }
      
      // If no unit was provided, treat the second part as part of ingredient name
      const nameStartIndex = parts[1] && units.includes(unit) ? 2 : 1;
      const name = parts.slice(nameStartIndex).join(' ') || line.trim();
      
      return {
        ingredient_name: name,
        quantity,
        unit,
        location: 'Pantry' // Default location
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create recipe
      const { data: recipe, error: recipeError } = await supabase
        .from('recipes')
        .insert({
          name: formData.name,
          description: formData.description,
          servings: formData.servings,
          prep_time: formData.prepTime,
          cook_time: formData.cookTime,
          instructions: formData.instructions,
          notes: formData.notes,
          tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()) : [],
          user_id: '00000000-0000-0000-0000-000000000000'
        })
        .select()
        .single();

      if (recipeError) throw recipeError;

      // Parse and add ingredients
      if (formData.ingredients.trim()) {
        const ingredients = parseIngredients(formData.ingredients);
        const ingredientRecords = ingredients.map(ingredient => ({
          ...ingredient,
          recipe_id: recipe.id
        }));

        const { error: ingredientsError } = await supabase
          .from('recipe_ingredients')
          .insert(ingredientRecords);

        if (ingredientsError) throw ingredientsError;
      }

      toast({
        title: "Success",
        description: "Recipe added successfully"
      });

      setFormData({
        name: '',
        description: '',
        servings: 4,
        prepTime: 0,
        cookTime: 0,
        ingredients: '',
        instructions: '',
        notes: '',
        tags: ''
      });

      setOpen(false);
      onRecipeAdded();
    } catch (error) {
      console.error('Error adding recipe:', error);
      toast({
        title: "Error",
        description: "Failed to add recipe",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="mint">
          <Plus className="h-4 w-4 mr-2" />
          Add Recipe
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="add-recipe-description">
        <DialogHeader>
          <DialogTitle>Add New Recipe</DialogTitle>
        </DialogHeader>
        <div id="add-recipe-description" className="sr-only">
          Create a new recipe with ingredients and instructions
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Recipe Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter recipe name"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Servings</label>
              <Input
                type="number"
                value={formData.servings}
                onChange={(e) => setFormData(prev => ({ ...prev, servings: Number(e.target.value) }))}
                min="1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Prep Time (minutes)</label>
              <Input
                type="number"
                value={formData.prepTime}
                onChange={(e) => setFormData(prev => ({ ...prev, prepTime: Number(e.target.value) }))}
                min="0"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Cook Time (minutes)</label>
              <Input
                type="number"
                value={formData.cookTime}
                onChange={(e) => setFormData(prev => ({ ...prev, cookTime: Number(e.target.value) }))}
                min="0"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of the recipe"
              rows={2}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Ingredients (one per line)</label>
            <Textarea
              value={formData.ingredients}
              onChange={(e) => setFormData(prev => ({ ...prev, ingredients: e.target.value }))}
              placeholder="2 cups flour&#10;1 cup milk&#10;2 eggs"
              rows={6}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Instructions</label>
            <Textarea
              value={formData.instructions}
              onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
              placeholder="Step by step instructions"
              rows={6}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Notes</label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional notes or tips"
              rows={3}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Tags (comma separated)</label>
            <Input
              value={formData.tags}
              onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
              placeholder="dinner, easy, italian"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Adding...' : 'Add Recipe'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
