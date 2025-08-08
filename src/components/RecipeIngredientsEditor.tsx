import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, ShoppingCart, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface RecipeIngredientsEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe: any;
  onUpdate: () => void;
}

interface Ingredient {
  id?: string;
  ingredient_name: string;
  quantity: number;
  unit: string;
  location: string;
}

const units = ['teaspoon', 'tablespoon', 'cup', 'fluid ounce', 'pint', 'quart', 'gallon', 'ounce', 'pound', 'stick', 'can', 'jar', 'bunch', 'head', 'clove', 'each', 'bottle', 'bag'];
const jacksonLocations = ['Inside fridge', 'Garage fridge', 'Inside freezer', 'Garage freezer', 'Chest freezer', 'Pantry', 'Counter', 'Bread drawer', 'Overflow'];
const shoreLocations = ['Fridge', 'Freezer', 'Pantry'];

export const RecipeIngredientsEditor = ({ open, onOpenChange, recipe, onUpdate }: RecipeIngredientsEditorProps) => {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (recipe && open) {
      fetchIngredients();
    }
  }, [recipe, open]);

  const fetchIngredients = async () => {
    if (!recipe) return;
    
    try {
      const { data, error } = await supabase
        .from('recipe_ingredients')
        .select('*')
        .eq('recipe_id', recipe.id);

      if (error) throw error;
      setIngredients(data || []);
    } catch (error) {
      console.error('Error fetching ingredients:', error);
      toast({
        title: "Error",
        description: "Failed to load ingredients",
        variant: "destructive"
      });
    }
  };

  const addIngredient = () => {
    setIngredients([...ingredients, {
      ingredient_name: '',
      quantity: 1,
      unit: 'each',
      location: 'Pantry'
    }]);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: any) => {
    setIngredients(ingredients.map((ing, i) => 
      i === index ? { ...ing, [field]: value } : ing
    ));
  };

  const addToInventory = async (ingredient: Ingredient, site: 'jackson' | 'shore') => {
    try {
      const userId = site === 'shore' ? '11111111-1111-1111-1111-111111111111' : '00000000-0000-0000-0000-000000000000';
      
      // Check if ingredient already exists
      const { data: existing, error: checkError } = await supabase
        .from('pantry_items')
        .select('*')
        .eq('name', ingredient.ingredient_name)
        .eq('user_id', userId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') throw checkError;
      
      if (existing) {
        // Add to existing quantity
        const newQuantity = Number(existing.quantity) + Number(ingredient.quantity);
        await supabase
          .from('pantry_items')
          .update({ quantity: newQuantity })
          .eq('id', existing.id);
      } else {
        // Create new inventory item
        await supabase
          .from('pantry_items')
          .insert({
            name: ingredient.ingredient_name,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
            location: ingredient.location,
            user_id: userId
          });
      }

      toast({
        title: "Success",
        description: `${ingredient.ingredient_name} added to ${site} inventory`
      });
    } catch (error) {
      console.error('Error adding to inventory:', error);
      toast({
        title: "Error",
        description: "Failed to add to inventory",
        variant: "destructive"
      });
    }
  };

  const addToShoppingList = async (ingredient: Ingredient) => {
    try {
      await supabase
        .from('shopping_list')
        .insert({
          item_name: ingredient.ingredient_name,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          location: ingredient.location,
          user_id: '00000000-0000-0000-0000-000000000000'
        });

      toast({
        title: "Success",
        description: `${ingredient.ingredient_name} added to shopping list`
      });
    } catch (error) {
      console.error('Error adding to shopping list:', error);
      toast({
        title: "Error",
        description: "Failed to add to shopping list",
        variant: "destructive"
      });
    }
  };

  const saveIngredients = async () => {
    if (!recipe) return;
    
    setLoading(true);
    try {
      // Delete existing ingredients
      await supabase
        .from('recipe_ingredients')
        .delete()
        .eq('recipe_id', recipe.id);

      // Insert updated ingredients
      if (ingredients.length > 0) {
        const ingredientsToInsert = ingredients
          .filter(ing => ing.ingredient_name.trim())
          .map(ing => ({
            recipe_id: recipe.id,
            ingredient_name: ing.ingredient_name,
            quantity: ing.quantity,
            unit: ing.unit,
            location: ing.location
          }));

        if (ingredientsToInsert.length > 0) {
          const { error } = await supabase
            .from('recipe_ingredients')
            .insert(ingredientsToInsert);

          if (error) throw error;
        }
      }

      toast({
        title: "Success",
        description: "Recipe ingredients updated"
      });
      
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving ingredients:', error);
      toast({
        title: "Error",
        description: "Failed to save ingredients",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Recipe Ingredients - {recipe?.name}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Ingredients</h3>
            <Button onClick={addIngredient} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Ingredient
            </Button>
          </div>

          <div className="space-y-3">
            {ingredients.map((ingredient, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-4">
                      <Label>Name</Label>
                      <Input
                        value={ingredient.ingredient_name}
                        onChange={(e) => updateIngredient(index, 'ingredient_name', e.target.value)}
                        placeholder="Ingredient name"
                      />
                    </div>
                    
                    <div className="col-span-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        value={ingredient.quantity}
                        onChange={(e) => updateIngredient(index, 'quantity', Number(e.target.value))}
                        min="0"
                        step="0.1"
                      />
                    </div>
                    
                    <div className="col-span-2">
                      <Label>Unit</Label>
                      <Select 
                        value={ingredient.unit} 
                        onValueChange={(value) => updateIngredient(index, 'unit', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {units.map(unit => (
                            <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="col-span-3">
                      <Label>Location</Label>
                      <Select 
                        value={ingredient.location} 
                        onValueChange={(value) => updateIngredient(index, 'location', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <optgroup label="Jackson">
                            {jacksonLocations.map(location => (
                              <SelectItem key={location} value={location}>{location}</SelectItem>
                            ))}
                          </optgroup>
                          <optgroup label="Shore">
                            {shoreLocations.map(location => (
                              <SelectItem key={location} value={location}>{location}</SelectItem>
                            ))}
                          </optgroup>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="col-span-1 flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeIngredient(index)}
                        title="Remove ingredient"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  {ingredient.ingredient_name && (
                    <div className="flex gap-2 mt-3 pt-3 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addToInventory(ingredient, 'jackson')}
                      >
                        <Package className="h-3 w-3 mr-1" />
                        + Jackson
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addToInventory(ingredient, 'shore')}
                      >
                        <Package className="h-3 w-3 mr-1" />
                        + Shore
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addToShoppingList(ingredient)}
                      >
                        <ShoppingCart className="h-3 w-3 mr-1" />
                        + Shopping List
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={saveIngredients} disabled={loading} className="flex-1">
              {loading ? "Saving..." : "Save Changes"}
            </Button>
            <Button onClick={() => onOpenChange(false)} variant="outline" className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
