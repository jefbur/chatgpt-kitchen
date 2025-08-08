import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AddInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemAdded: () => void;
  editItem?: {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    location: string;
    site: 'jackson' | 'shore';
  } | null;
}

const jacksonLocations = [
  'Inside fridge', 'Garage fridge', 'Inside freezer', 'Garage freezer', 
  'Chest freezer', 'Pantry', 'Counter', 'Bread drawer', 'Overflow'
];

const shoreLocations = ['Fridge', 'Freezer', 'Pantry'];

const quantityOptions = Array.from({ length: 20 }, (_, i) => (i + 1) * 0.5);

const units = ['teaspoon', 'tablespoon', 'cup', 'fluid ounce', 'pint', 'quart', 'gallon', 'ounce', 'pound', 'stick', 'can', 'jar', 'bunch', 'head', 'clove', 'each', 'bottle', 'bag'];

export const AddInventoryDialog = ({ open, onOpenChange, onItemAdded, editItem }: AddInventoryDialogProps) => {
  const [formData, setFormData] = useState({
    name: '',
    quantity: 1,
    unit: 'each',
    site: 'jackson' as 'jackson' | 'shore',
    location: 'Pantry'
  });
  const { toast } = useToast();

  // Update form data when editItem changes
  useEffect(() => {
    if (editItem) {
      setFormData({
        name: editItem.name,
        quantity: editItem.quantity,
        unit: editItem.unit,
        site: editItem.site,
        location: editItem.location
      });
    } else {
      setFormData({
        name: '',
        quantity: 1,
        unit: 'each',
        site: 'jackson',
        location: 'Pantry'
      });
    }
  }, [editItem]);

  const currentLocations = formData.site === 'jackson' ? jacksonLocations : shoreLocations;

  const checkExistingItem = async (name: string, location: string) => {
    const { data, error } = await supabase
      .from('pantry_items')
      .select('id, quantity')
      .eq('name', name)
      .eq('location', location)
      .neq('user_id', '11111111-1111-1111-1111-111111111111')
      .maybeSingle();

    if (error) throw error;
    return data;
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Please enter an ingredient name",
        variant: "destructive"
      });
      return;
    }

    try {
      if (editItem) {
        // Update existing item
        const { error } = await supabase
          .from('pantry_items')
          .update({
            name: formData.name,
            quantity: formData.quantity,
            unit: formData.unit,
            location: formData.location
          })
          .eq('id', editItem.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Item updated successfully"
        });
      } else {
        // Check if item already exists in the same location
        const existingItem = await checkExistingItem(formData.name, formData.location);
        
        if (existingItem) {
          // Update existing item quantity
          const newQuantity = Number(existingItem.quantity) + formData.quantity;
          const { error } = await supabase
            .from('pantry_items')
            .update({ quantity: newQuantity })
            .eq('id', existingItem.id);

          if (error) throw error;

          toast({
            title: "Success",
            description: `Updated existing item. New quantity: ${newQuantity} ${formData.unit}`
          });
        } else {
          // Add new item
          const { error } = await supabase
            .from('pantry_items')
            .insert({
              name: formData.name,
              quantity: formData.quantity,
              unit: formData.unit,
              location: formData.location,
              user_id: '00000000-0000-0000-0000-000000000000'
            });

          if (error) throw error;

          toast({
            title: "Success",
            description: "Item added to inventory"
          });
        }
      }

      onItemAdded();
      onOpenChange(false);
      
      // Reset form
      setFormData({
        name: '',
        quantity: 1,
        unit: 'each',
        site: 'jackson',
        location: 'Pantry'
      });
    } catch (error) {
      console.error('Error saving item:', error);
      toast({
        title: "Error",
        description: editItem ? "Failed to update item" : "Failed to add item",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="add-inventory-description">
        <DialogHeader>
          <DialogTitle>{editItem ? 'Edit Inventory Item' : 'Add Inventory Item'}</DialogTitle>
        </DialogHeader>
        <div id="add-inventory-description" className="sr-only">
          {editItem ? 'Edit an existing inventory item' : 'Add a new item to inventory'}
        </div>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Ingredient Name</Label>
            <Input
              id="name"
              placeholder="Enter ingredient name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              step="0.5"
              min="0"
              placeholder="Enter quantity"
              value={formData.quantity}
              onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
            />
          </div>

          <div>
            <Label htmlFor="unit">Unit</Label>
            <Select value={formData.unit} onValueChange={(value) => setFormData(prev => ({ ...prev, unit: value }))}>
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

          {!editItem && (
            <div className="space-y-2">
              <Label>Site</Label>
              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="jackson"
                    checked={formData.site === 'jackson'}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFormData(prev => ({ ...prev, site: 'jackson', location: jacksonLocations[0] }));
                      }
                    }}
                  />
                  <Label htmlFor="jackson">Jackson</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="shore"
                    checked={formData.site === 'shore'}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFormData(prev => ({ ...prev, site: 'shore', location: shoreLocations[0] }));
                      }
                    }}
                  />
                  <Label htmlFor="shore">Shore</Label>
                </div>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="location">Location</Label>
            <Select value={formData.location} onValueChange={(value) => setFormData(prev => ({ ...prev, location: value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currentLocations.map(location => (
                  <SelectItem key={location} value={location}>{location}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSubmit} className="flex-1">
              {editItem ? 'Update Item' : 'Add Item'}
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
