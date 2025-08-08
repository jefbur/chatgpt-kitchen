import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TransferItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  location: string;
  site: 'jackson' | 'shore';
  transferQuantity?: number;
}

interface TransferItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransferComplete: () => void;
  currentSite: 'jackson' | 'shore';
}

const jacksonLocations = [
  'Inside fridge', 'Garage fridge', 'Inside freezer', 'Garage freezer', 
  'Chest freezer', 'Pantry', 'Counter', 'Bread drawer', 'Overflow'
];

const shoreLocations = ['Fridge', 'Freezer', 'Pantry'];

export const TransferItemsDialog = ({ open, onOpenChange, onTransferComplete, currentSite }: TransferItemsDialogProps) => {
  const [items, setItems] = useState<TransferItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [targetLocation, setTargetLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const targetSite = currentSite === 'jackson' ? 'shore' : 'jackson';
  const targetLocations = targetSite === 'jackson' ? jacksonLocations : shoreLocations;

  useEffect(() => {
    if (open) {
      fetchItems();
      setTargetLocation(targetLocations[0]);
    }
  }, [open, currentSite]);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('pantry_items')
        .select('*')
        .neq('user_id', '11111111-1111-1111-1111-111111111111');

      if (error) throw error;

      const mappedItems: TransferItem[] = (data || []).map(item => ({
        id: item.id,
        name: item.name,
        quantity: Number(item.quantity),
        unit: item.unit || 'each',
        location: item.location,
        site: (item.location === 'Fridge' || item.location === 'Freezer' || item.location === 'Pantry') ? 'shore' as const : 'jackson' as const,
        transferQuantity: Number(item.quantity)
      })).filter(item => item.site === currentSite);

      setItems(mappedItems);
    } catch (error) {
      console.error('Error fetching items:', error);
      toast({
        title: "Error",
        description: "Failed to load items",
        variant: "destructive"
      });
    }
  };

  const handleSelectAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(item => item.id)));
    }
  };

  const handleItemSelect = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const updateTransferQuantity = (itemId: string, quantity: number) => {
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, transferQuantity: Math.max(0, Math.min(quantity, item.quantity)) } : item
    ));
  };

  const handleTransfer = async () => {
    if (selectedItems.size === 0) {
      toast({
        title: "Error",
        description: "Please select items to transfer",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const selectedItemsData = items.filter(item => selectedItems.has(item.id));
      
      for (const item of selectedItemsData) {
        const transferQty = item.transferQuantity || item.quantity;
        const remainingQty = item.quantity - transferQty;
        
        if (transferQty > 0) {
          // Check if item already exists at target location
          const { data: existingItem } = await supabase
            .from('pantry_items')
            .select('*')
            .eq('name', item.name)
            .eq('location', targetLocation)
            .neq('user_id', '11111111-1111-1111-1111-111111111111')
            .single();

          if (existingItem) {
            // Update existing item quantity
            await supabase
              .from('pantry_items')
              .update({ quantity: Number(existingItem.quantity) + transferQty })
              .eq('id', existingItem.id);
          } else {
            // Create new item at target location
            await supabase
              .from('pantry_items')
              .insert({
                name: item.name,
                quantity: transferQty,
                unit: item.unit,
                location: targetLocation,
                user_id: '00000000-0000-0000-0000-000000000000'
              });
          }

          // Update or remove original item
          if (remainingQty > 0) {
            await supabase
              .from('pantry_items')
              .update({ quantity: remainingQty })
              .eq('id', item.id);
          } else {
            await supabase
              .from('pantry_items')
              .delete()
              .eq('id', item.id);
          }
        }
      }

      toast({
        title: "Success",
        description: `Items transferred to ${targetSite}`
      });

      onTransferComplete();
      onOpenChange(false);
      setSelectedItems(new Set());
    } catch (error) {
      console.error('Error transferring items:', error);
      toast({
        title: "Error",
        description: "Failed to transfer items",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" aria-describedby="transfer-dialog-description">
        <DialogHeader>
          <DialogTitle>
            Transfer Items from {currentSite} to {targetSite}
          </DialogTitle>
        </DialogHeader>
        <div id="transfer-dialog-description" className="sr-only">
          Transfer inventory items between Jackson and Shore locations
        </div>
        
        <div className="space-y-4">
          <div>
            <Label>Target Location in {targetSite}</Label>
            <Select value={targetLocation} onValueChange={setTargetLocation}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {targetLocations.map(location => (
                  <SelectItem key={location} value={location}>{location}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox 
              id="select-all"
              checked={selectedItems.size === items.length && items.length > 0}
              onCheckedChange={handleSelectAll}
            />
            <Label htmlFor="select-all">Select All ({items.length} items)</Label>
          </div>

          <div className="grid gap-2 max-h-96 overflow-y-auto">
            {items.map(item => (
              <Card key={item.id} className="p-3">
                <CardContent className="p-0">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      checked={selectedItems.has(item.id)}
                      onCheckedChange={() => handleItemSelect(item.id)}
                    />
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <span className="font-medium">{item.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {item.location}
                        </Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        Available: {item.quantity} {item.unit}
                      </span>
                    </div>
                    {selectedItems.has(item.id) && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Transfer:</span>
                        <Input
                          type="number"
                          value={Math.floor(item.transferQuantity || item.quantity)}
                          onChange={(e) => updateTransferQuantity(item.id, Math.floor(Number(e.target.value)))}
                          className="w-20"
                          min="0"
                          max={item.quantity}
                          step="1"
                        />
                        <span className="text-sm text-muted-foreground">{item.unit}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {items.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No items available to transfer
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button 
              onClick={handleTransfer} 
              disabled={selectedItems.size === 0 || loading}
              className="flex-1"
            >
              {loading ? "Transferring..." : `Transfer ${selectedItems.size} Item(s)`}
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