import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Calculator } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ConversionFactor {
  id: string;
  ingredient_name: string;
  from_unit: string;
  to_unit: string;
  conversion_factor: number;
}

export const ConversionFactorsPage = () => {
  const [conversions, setConversions] = useState<ConversionFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [newConversion, setNewConversion] = useState({
    ingredient_name: '',
    from_unit: '',
    to_unit: '',
    conversion_factor: 1
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchConversions();
  }, []);

  const fetchConversions = async () => {
    try {
      // We'll store conversion factors in a special table or reuse pantry_items with a special user_id
      const { data, error } = await supabase
        .from('pantry_items')
        .select('*')
        .eq('user_id', '22222222-2222-2222-2222-222222222222'); // Special ID for conversions

      if (error) throw error;

      const formattedConversions = (data || []).map(item => ({
        id: item.id,
        ingredient_name: item.name,
        from_unit: item.unit,
        to_unit: item.location, // Using location field for to_unit
        conversion_factor: Number(item.quantity)
      }));

      setConversions(formattedConversions);
    } catch (error) {
      console.error('Error fetching conversions:', error);
      toast({
        title: "Error",
        description: "Failed to load conversion factors",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addConversion = async () => {
    if (!newConversion.ingredient_name.trim() || !newConversion.from_unit.trim() || !newConversion.to_unit.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('pantry_items')
        .insert({
          name: newConversion.ingredient_name,
          unit: newConversion.from_unit,
          location: newConversion.to_unit,
          quantity: newConversion.conversion_factor,
          user_id: '22222222-2222-2222-2222-222222222222',
          notes: 'conversion_factor'
        });

      if (error) throw error;

      setNewConversion({
        ingredient_name: '',
        from_unit: '',
        to_unit: '',
        conversion_factor: 1
      });

      fetchConversions();
      toast({
        title: "Success",
        description: "Conversion factor added"
      });
    } catch (error) {
      console.error('Error adding conversion:', error);
      toast({
        title: "Error",
        description: "Failed to add conversion factor",
        variant: "destructive"
      });
    }
  };

  const removeConversion = async (id: string) => {
    if (!confirm('Are you sure you want to remove this conversion factor?')) return;

    try {
      const { error } = await supabase
        .from('pantry_items')
        .delete()
        .eq('id', id);

      if (error) throw error;

      fetchConversions();
      toast({
        title: "Success",
        description: "Conversion factor removed"
      });
    } catch (error) {
      console.error('Error removing conversion:', error);
      toast({
        title: "Error",
        description: "Failed to remove conversion factor",
        variant: "destructive"
      });
    }
  };

  const deleteAllConversions = async () => {
    if (!confirm('Are you sure you want to delete ALL conversion factors? This cannot be undone.')) return;

    try {
      const { error } = await supabase
        .from('pantry_items')
        .delete()
        .eq('user_id', '22222222-2222-2222-2222-222222222222');

      if (error) throw error;

      fetchConversions();
      toast({
        title: "Success",
        description: "All conversion factors deleted"
      });
    } catch (error) {
      console.error('Error deleting all conversions:', error);
      toast({
        title: "Error",
        description: "Failed to delete conversion factors",
        variant: "destructive"
      });
    }
  };

  // Helper function to get conversion factor for recipes
  const getConversionFactor = (ingredientName: string, fromUnit: string, toUnit: string): number | null => {
    const conversion = conversions.find(c => 
      c.ingredient_name.toLowerCase() === ingredientName.toLowerCase() &&
      c.from_unit.toLowerCase() === fromUnit.toLowerCase() &&
      c.to_unit.toLowerCase() === toUnit.toLowerCase()
    );
    return conversion ? conversion.conversion_factor : null;
  };

  if (loading) {
    return <div className="text-center p-8">Loading conversion factors...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-mint flex items-center justify-center">
              <Calculator className="h-4 w-4" />
            </div>
            Unit Conversion Factors
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Add New Conversion */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3">Add New Conversion Factor</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="from-unit">From Unit</Label>
                <Input
                  id="from-unit"
                  placeholder="e.g., whole"
                  value={newConversion.from_unit}
                  onChange={(e) => setNewConversion(prev => ({ ...prev, from_unit: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="ingredient">Ingredient</Label>
                <Input
                  id="ingredient"
                  placeholder="e.g., lemon"
                  value={newConversion.ingredient_name}
                  onChange={(e) => setNewConversion(prev => ({ ...prev, ingredient_name: e.target.value }))}
                />
              </div>
              <div className="flex items-center justify-center">
                <span className="text-sm font-medium">is equivalent to</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="factor">Factor</Label>
                  <Input
                    id="factor"
                    type="number"
                    placeholder="2"
                    value={newConversion.conversion_factor}
                    onChange={(e) => setNewConversion(prev => ({ ...prev, conversion_factor: Number(e.target.value) }))}
                    step="0.01"
                    min="0"
                  />
                </div>
                <div>
                  <Label htmlFor="to-unit">To Unit</Label>
                  <Input
                    id="to-unit"
                    placeholder="e.g., tbsp"
                    value={newConversion.to_unit}
                    onChange={(e) => setNewConversion(prev => ({ ...prev, to_unit: e.target.value }))}
                  />
                </div>
              </div>
            </div>
                <div className="flex justify-end mt-4">
                  <Button onClick={addConversion}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Conversion
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Example: 1 whole lemon is equivalent to 2 tbsp lemon juice
                </p>
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <h4 className="text-sm font-semibold mb-2">Quick Add Common Fruit Conversions:</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setNewConversion({ingredient_name: 'lemon', from_unit: 'whole', to_unit: 'tbsp', conversion_factor: 2})}
                    >
                      1 Lemon = 2 tbsp juice
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setNewConversion({ingredient_name: 'lime', from_unit: 'whole', to_unit: 'tsp', conversion_factor: 1.5})}
                    >
                      1 Lime = 1.5 tsp juice
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setNewConversion({ingredient_name: 'orange', from_unit: 'whole', to_unit: 'tbsp', conversion_factor: 3})}
                    >
                      1 Orange = 3 tbsp juice
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Delete All Button */}
            <div className="flex justify-end">
              <Button variant="destructive" onClick={deleteAllConversions}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete All Conversion Factors
              </Button>
            </div>

            {/* Conversions List */}
            <div className="space-y-3">
              {conversions.length === 0 ? (
                <Card className="text-center p-8">
                  <CardContent>
                    <Calculator className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      No conversion factors defined yet. Add some to help with unit conversions in recipes!
                    </p>
                  </CardContent>
                </Card>
              ) : (
                conversions.map(conversion => (
                  <Card key={conversion.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium">
                          {conversion.ingredient_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          1 {conversion.from_unit} is equivalent to {conversion.conversion_factor} {conversion.to_unit}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => removeConversion(conversion.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Export helper function for use in other components
export const getConversionFactor = async (ingredientName: string, fromUnit: string, toUnit: string): Promise<number | null> => {
  try {
    const { data, error } = await supabase
      .from('pantry_items')
      .select('*')
      .eq('user_id', '22222222-2222-2222-2222-222222222222')
      .eq('name', ingredientName)
      .eq('unit', fromUnit)
      .eq('location', toUnit)
      .single();

    if (error) return null;
    return Number(data.quantity);
  } catch {
    return null;
  }
};