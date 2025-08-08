import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Wand2, Clock, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AIRecipeDialogProps {
  onRecipeAdded: () => void;
}

export const AIRecipeDialog = ({ onRecipeAdded }: AIRecipeDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState<any>(null);
  const [formData, setFormData] = useState({
    ingredients: '',
    theme: '',
    dietary: ''
  });
  const { toast } = useToast();

  const generateRecipe = async () => {
    if (!formData.ingredients.trim()) {
      toast({
        title: "Error",
        description: "Please enter some ingredients",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-recipe', {
        body: {
          ingredients: formData.ingredients,
          theme: formData.theme,
          dietary: formData.dietary
        }
      });

      if (error) throw error;
      setGeneratedRecipe(data);
    } catch (error) {
      console.error('Error generating recipe:', error);
      toast({
        title: "Error",
        description: "Failed to generate recipe. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addRecipeToCollection = async () => {
    if (!generatedRecipe) return;

    try {
      // Create recipe
      const { data: recipe, error: recipeError } = await supabase
        .from('recipes')
        .insert({
          name: generatedRecipe.name,
          description: generatedRecipe.description,
          servings: generatedRecipe.servings,
          prep_time: generatedRecipe.prep_time,
          cook_time: generatedRecipe.cook_time,
          instructions: generatedRecipe.instructions,
          notes: generatedRecipe.notes,
          tags: generatedRecipe.tags || [],
          user_id: '00000000-0000-0000-0000-000000000000'
        })
        .select()
        .single();

      if (recipeError) throw recipeError;

      // Add ingredients
      if (generatedRecipe.ingredients && generatedRecipe.ingredients.length > 0) {
        const ingredientRecords = generatedRecipe.ingredients.map((ingredient: string) => {
          const parts = ingredient.split(/\s+/);
          const quantity = parseFloat(parts[0]) || 1;
          const unit = parts[1] || 'each';
          const name = parts.slice(2).join(' ') || ingredient;
          
          return {
            recipe_id: recipe.id,
            ingredient_name: name,
            quantity,
            unit,
            location: 'Pantry'
          };
        });

        const { error: ingredientsError } = await supabase
          .from('recipe_ingredients')
          .insert(ingredientRecords);

        if (ingredientsError) throw ingredientsError;
      }

      toast({
        title: "Success",
        description: "AI recipe added to your collection"
      });

      setGeneratedRecipe(null);
      setFormData({ ingredients: '', theme: '', dietary: '' });
      setOpen(false);
      onRecipeAdded();
    } catch (error) {
      console.error('Error adding AI recipe:', error);
      toast({
        title: "Error",
        description: "Failed to add recipe to collection",
        variant: "destructive"
      });
    }
  };

  const tryAgain = () => {
    setGeneratedRecipe(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="lavender">
          <Wand2 className="h-4 w-4 mr-2" />
          AI Recipe
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="ai-recipe-description">
        <DialogHeader>
          <DialogTitle>AI Recipe Generator</DialogTitle>
        </DialogHeader>
        <div id="ai-recipe-description" className="sr-only">
          Generate recipes using AI based on available ingredients
        </div>

        {!generatedRecipe ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Available Ingredients</label>
              <Textarea
                value={formData.ingredients}
                onChange={(e) => setFormData(prev => ({ ...prev, ingredients: e.target.value }))}
                placeholder="chicken, rice, onions, garlic..."
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Theme (optional)</label>
              <Input
                value={formData.theme}
                onChange={(e) => setFormData(prev => ({ ...prev, theme: e.target.value }))}
                placeholder="dinner for 12, beach theme, comfort food..."
              />
            </div>

            <div>
              <label className="text-sm font-medium">Dietary Requirements (optional)</label>
              <Input
                value={formData.dietary}
                onChange={(e) => setFormData(prev => ({ ...prev, dietary: e.target.value }))}
                placeholder="dairy-free, vegetarian, low-carb..."
              />
            </div>

            <Button 
              onClick={generateRecipe} 
              disabled={loading} 
              className="w-full"
            >
              {loading ? 'Generating Recipe...' : 'Generate Recipe'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-xl font-bold mb-2">{generatedRecipe.name}</h3>
                <p className="text-muted-foreground mb-4">{generatedRecipe.description}</p>
                
                <div className="flex gap-4 mb-4">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span className="text-sm">{generatedRecipe.servings} servings</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">{generatedRecipe.prep_time + generatedRecipe.cook_time} min</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold">Ingredients:</h4>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {generatedRecipe.ingredients?.map((ingredient: string, index: number) => (
                        <li key={index}>{ingredient}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold">Instructions:</h4>
                    <p className="text-sm whitespace-pre-wrap">{generatedRecipe.instructions}</p>
                  </div>

                  {generatedRecipe.notes && (
                    <div>
                      <h4 className="font-semibold">Notes:</h4>
                      <p className="text-sm">{generatedRecipe.notes}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button onClick={addRecipeToCollection} className="flex-1">
                Add to Collection
              </Button>
              <Button onClick={tryAgain} variant="outline" className="flex-1">
                Try Again
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};