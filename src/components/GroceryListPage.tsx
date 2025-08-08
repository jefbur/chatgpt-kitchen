import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, Plus, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ConsolidatedGroceryList } from "./ConsolidatedGroceryList";

interface ShoppingItem {
  id: string;
  item_name: string;
  quantity: number;
  unit: string;
  location: string;
  is_purchased: boolean;
  isDeficit?: boolean;
  is_staple?: boolean;
}

// Common grocery store units
const commonUnits = [
  'each', 'lbs', 'oz', 'cups', 'tbsp', 'tsp', 'gallons', 'quarts', 'pints', 
  'packages', 'boxes', 'cans', 'jars', 'bags', 'bunches', 'heads', 'loaves', 'bottle', 'bag'
];

// Grocery store categories for sorting
const groceryCategories = {
  'Produce': ['lettuce', 'tomato', 'onion', 'garlic', 'carrot', 'celery', 'pepper', 'cucumber', 'apple', 'banana', 'orange', 'lemon', 'lime', 'potato', 'mushroom', 'spinach', 'broccoli', 'cauliflower', 'avocado', 'strawberry', 'berry', 'grapes', 'melon', 'squash', 'zucchini', 'corn', 'bean', 'pea', 'herb', 'basil', 'parsley', 'cilantro', 'mint'],
  'Meat & Seafood': ['chicken', 'beef', 'pork', 'turkey', 'fish', 'salmon', 'shrimp', 'crab', 'lobster', 'sausage', 'bacon', 'ham', 'ground beef', 'steak', 'chop'],
  'Dairy': ['milk', 'cheese', 'butter', 'yogurt', 'cream', 'egg', 'sour cream', 'cottage cheese', 'cream cheese'],
  'Pantry': ['flour', 'sugar', 'rice', 'pasta', 'oil', 'vinegar', 'sauce', 'spice', 'salt', 'pepper', 'vanilla', 'baking powder', 'baking soda', 'honey', 'syrup', 'can', 'jar', 'box', 'cereal', 'crackers', 'chips', 'nuts', 'dried'],
  'Frozen': ['frozen', 'ice cream', 'ice'],
  'Beverages': ['juice', 'soda', 'water', 'coffee', 'tea', 'wine', 'beer'],
  'Bread & Bakery': ['bread', 'rolls', 'bagel', 'muffin', 'cake', 'cookie', 'pastry'],
  'Other': []
};

const categorizeItem = (itemName: string): string => {
  const lowerName = itemName.toLowerCase();
  for (const [category, keywords] of Object.entries(groceryCategories)) {
    if (keywords.some(keyword => lowerName.includes(keyword))) {
      return category;
    }
  }
  return 'Other';
};

const sortShoppingList = (items: ShoppingItem[]): ShoppingItem[] => {
  const categoryOrder = ['Produce', 'Meat & Seafood', 'Dairy', 'Frozen', 'Pantry', 'Bread & Bakery', 'Beverages', 'Other'];
  
  return items.sort((a, b) => {
    const categoryA = categorizeItem(a.item_name);
    const categoryB = categorizeItem(b.item_name);
    const orderA = categoryOrder.indexOf(categoryA);
    const orderB = categoryOrder.indexOf(categoryB);
    
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    
    return a.item_name.localeCompare(b.item_name);
  });
};

export const GroceryListPage = () => {
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchShoppingList();
  }, []);

  const fetchShoppingList = async () => {
    try {
      const { data, error } = await supabase
        .from('shopping_list')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setShoppingList(sortShoppingList(data || []));
    } catch (error) {
      console.error('Error fetching shopping list:', error);
      toast({
        title: "Error",
        description: "Failed to load shopping list",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (id: string, newQuantity: number) => {
    try {
      const { error } = await supabase
        .from('shopping_list')
        .update({ quantity: newQuantity })
        .eq('id', id);

      if (error) throw error;
      
      setShoppingList(prev => 
        prev.map(item => 
          item.id === id ? { ...item, quantity: newQuantity } : item
        )
      );
    } catch (error) {
      console.error('Error updating quantity:', error);
      toast({
        title: "Error",
        description: "Failed to update quantity",
        variant: "destructive"
      });
    }
  };

  const updateUnit = async (id: string, newUnit: string) => {
    try {
      const { error } = await supabase
        .from('shopping_list')
        .update({ unit: newUnit })
        .eq('id', id);

      if (error) throw error;
      
      setShoppingList(prev => 
        prev.map(item => 
          item.id === id ? { ...item, unit: newUnit } : item
        )
      );
    } catch (error) {
      console.error('Error updating unit:', error);
      toast({
        title: "Error",
        description: "Failed to update unit",
        variant: "destructive"
      });
    }
  };

  const togglePurchased = async (id: string, isPurchased: boolean) => {
    try {
      const { error } = await supabase
        .from('shopping_list')
        .update({ is_purchased: isPurchased })
        .eq('id', id);

      if (error) throw error;
      
      setShoppingList(prev => 
        prev.map(item => 
          item.id === id ? { ...item, is_purchased: isPurchased } : item
        )
      );
    } catch (error) {
      console.error('Error updating purchase status:', error);
      toast({
        title: "Error",
        description: "Failed to update purchase status",
        variant: "destructive"
      });
    }
  };

  const removeItem = async (id: string) => {
    try {
      const { error } = await supabase
        .from('shopping_list')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setShoppingList(prev => prev.filter(item => item.id !== id));
      toast({
        title: "Success",
        description: "Item removed from shopping list"
      });
    } catch (error) {
      console.error('Error removing item:', error);
      toast({
        title: "Error",
        description: "Failed to remove item",
        variant: "destructive"
      });
    }
  };

  const addGroceriesToInventory = async () => {
    try {
      const purchasedItems = shoppingList.filter(item => item.is_purchased);
      
      if (purchasedItems.length === 0) {
        toast({
          title: "No items selected",
          description: "Mark items as purchased first"
        });
        return;
      }

      for (const item of purchasedItems) {
        // Clean item name (remove & prefix if present)
        const cleanItemName = item.item_name.startsWith('&') ? item.item_name.substring(1) : item.item_name;
        const isShoreItem = item.item_name.startsWith('&');
        
        // Determine the correct user_id based on location
        const targetUserId = isShoreItem ? '11111111-1111-1111-1111-111111111111' : '00000000-0000-0000-0000-000000000000';
        
        // Check if item exists in the appropriate inventory
        const { data: existingItems } = await supabase
          .from('pantry_items')
          .select('*')
          .eq('name', cleanItemName)
          .eq('user_id', targetUserId);

        if (existingItems && existingItems.length > 0) {
          // Add to the first existing location
          const existingItem = existingItems[0];
          const newQuantity = Number(existingItem.quantity) + Number(item.quantity);
          
          await supabase
            .from('pantry_items')
            .update({ quantity: newQuantity })
            .eq('id', existingItem.id);
        } else {
          // Map location appropriately
          const mappedLocation = item.location === 'Fridge' ? 'Inside fridge' : 
                                 item.location === 'Freezer' ? 'Inside freezer' : 
                                 item.location === 'Pantry' ? 'Pantry' : 'Pantry';
          
          // Add new item to appropriate pantry
          await supabase
            .from('pantry_items')
            .insert({
              name: cleanItemName,
              quantity: item.quantity,
              unit: item.unit,
              location: mappedLocation,
              user_id: targetUserId
            });
        }

        // Remove from shopping list
        await supabase
          .from('shopping_list')
          .delete()
          .eq('id', item.id);
      }

      fetchShoppingList();
      toast({
        title: "Success",
        description: "Groceries added to inventory"
      });
    } catch (error) {
      console.error('Error adding groceries to inventory:', error);
      toast({
        title: "Error",
        description: "Failed to add groceries to inventory",
        variant: "destructive"
      });
    }
  };

  const addCustomItem = async () => {
    const itemName = prompt('Enter item name:');
    if (!itemName) return;

    const quantity = prompt('Enter quantity:');
    if (!quantity) return;

    const unit = prompt('Enter unit (e.g., lbs, cups, each):') || 'each';
    const location = prompt('Enter location:') || 'Pantry';

    try {
      const { error } = await supabase
        .from('shopping_list')
        .insert({
          item_name: itemName,
          quantity: Number(quantity),
          unit,
          location,
          user_id: '00000000-0000-0000-0000-000000000000'
        });

      if (error) throw error;
      
      fetchShoppingList();
      toast({
        title: "Success",
        description: "Item added to shopping list"
      });
    } catch (error) {
      console.error('Error adding custom item:', error);
      toast({
        title: "Error",
        description: "Failed to add item",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return <div className="text-center p-8">Loading shopping list...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-butter-yellow flex items-center justify-center">
              <ShoppingCart className="h-4 w-4" />
            </div>
            Smart Grocery List
          </CardTitle>
          <div className="text-sm text-muted-foreground">
            <p>! = Deficit from cooking | * = Staple needed | & = Shore meal plan</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button variant="mint" onClick={addCustomItem}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  const allSelected = shoppingList.every(item => item.is_purchased);
                  const newPurchasedState = !allSelected;
                  shoppingList.forEach(item => togglePurchased(item.id, newPurchasedState));
                }}
              >
                Select All
              </Button>
              <Button variant="lavender" onClick={addGroceriesToInventory}>
                <Upload className="h-4 w-4 mr-2" />
                Add Groceries to Inventory
              </Button>
            </div>

            {/* Shopping List */}
            {shoppingList.length === 0 ? (
              <Card className="text-center p-8">
                <CardContent>
                  <p className="text-muted-foreground">
                    Your shopping list is empty. Generate one from your meal plan!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <ConsolidatedGroceryList
                items={shoppingList}
                onUpdateQuantity={updateQuantity}
                onUpdateUnit={updateUnit}
                onTogglePurchased={togglePurchased}
                onRemoveItem={removeItem}
                commonUnits={commonUnits}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
