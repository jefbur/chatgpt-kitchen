import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";

interface ConsolidatedItem {
  name: string;
  shoreQuantity?: number;
  shoreUnit?: string;
  shoreId?: string;
  jacksonQuantity?: number;
  jacksonUnit?: string;
  jacksonId?: string;
  isPurchased: boolean;
  isDeficit?: boolean;
  isStaple?: boolean;
}

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

interface ConsolidatedGroceryListProps {
  items: ShoppingItem[];
  onUpdateQuantity: (id: string, quantity: number) => void;
  onUpdateUnit: (id: string, unit: string) => void;
  onTogglePurchased: (id: string, purchased: boolean) => void;
  onRemoveItem: (id: string) => void;
  commonUnits: string[];
}

export const ConsolidatedGroceryList = ({ 
  items, 
  onUpdateQuantity, 
  onUpdateUnit, 
  onTogglePurchased, 
  onRemoveItem,
  commonUnits 
}: ConsolidatedGroceryListProps) => {
  
  const consolidateItems = (items: ShoppingItem[]): ConsolidatedItem[] => {
    const consolidated: { [key: string]: ConsolidatedItem } = {};
    
    items.forEach(item => {
      // Clean item name (remove & prefix for shore items)
      const cleanName = item.item_name.startsWith('&') ? item.item_name.substring(1) : item.item_name;
      const isShoreItem = item.item_name.startsWith('&');
      
      if (!consolidated[cleanName]) {
        consolidated[cleanName] = {
          name: cleanName,
          isPurchased: false,
          isDeficit: item.isDeficit,
          isStaple: item.is_staple
        };
      }
      
      if (isShoreItem) {
        consolidated[cleanName].shoreQuantity = item.quantity;
        consolidated[cleanName].shoreUnit = item.unit;
        consolidated[cleanName].shoreId = item.id;
      } else {
        consolidated[cleanName].jacksonQuantity = item.quantity;
        consolidated[cleanName].jacksonUnit = item.unit;
        consolidated[cleanName].jacksonId = item.id;
      }
      
      // Update purchase status - item is purchased if ALL locations are purchased
      consolidated[cleanName].isPurchased = item.is_purchased && 
        (consolidated[cleanName].isPurchased || !consolidated[cleanName].shoreId || !consolidated[cleanName].jacksonId);
    });
    
    return Object.values(consolidated);
  };

  const consolidatedItems = consolidateItems(items);

  const handleQuantityChange = (item: ConsolidatedItem, location: 'shore' | 'jackson', newQuantity: number) => {
    const id = location === 'shore' ? item.shoreId : item.jacksonId;
    if (id) {
      onUpdateQuantity(id, newQuantity);
    }
  };

  const handleUnitChange = (item: ConsolidatedItem, location: 'shore' | 'jackson', newUnit: string) => {
    const id = location === 'shore' ? item.shoreId : item.jacksonId;
    if (id) {
      onUpdateUnit(id, newUnit);
    }
  };

  const handlePurchasedChange = (item: ConsolidatedItem, checked: boolean) => {
    // Handle each location separately for purchased status
    if (item.shoreId) onTogglePurchased(item.shoreId, checked);
    if (item.jacksonId) onTogglePurchased(item.jacksonId, checked);
  };

  const handleRemove = (item: ConsolidatedItem) => {
    if (item.shoreId) onRemoveItem(item.shoreId);
    if (item.jacksonId) onRemoveItem(item.jacksonId);
  };

  return (
    <div className="space-y-3">
      {consolidatedItems.map((item, index) => (
        <Card key={index} className={`p-4 ${item.isPurchased ? 'bg-muted/50' : ''}`}>
          <div className="flex items-center gap-4">
            <Checkbox
              checked={item.isPurchased}
              onCheckedChange={(checked) => handlePurchasedChange(item, checked as boolean)}
            />
            
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={`font-medium ${item.isPurchased ? 'line-through text-muted-foreground' : ''}`}>
                  {item.name}
                </span>
                {item.isDeficit && <Badge variant="destructive">!</Badge>}
                {item.isStaple && <Badge variant="outline">*</Badge>}
                {item.shoreId && <Badge variant="secondary">&</Badge>}
              </div>
            </div>

            {/* Shore quantity/unit if exists */}
            {item.shoreId && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">Shore</Badge>
                <Input
                  type="number"
                  value={item.shoreQuantity || 0}
                  onChange={(e) => handleQuantityChange(item, 'shore', Number(e.target.value))}
                  className="w-16 h-8 text-xs"
                  min="0"
                  step="1"
                />
                <Select 
                  value={item.shoreUnit || 'each'} 
                  onValueChange={(value) => handleUnitChange(item, 'shore', value)}
                >
                  <SelectTrigger className="w-16 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {commonUnits.map(unit => (
                      <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Jackson quantity/unit if exists */}
            {item.jacksonId && (
              <div className="flex items-center gap-2">
                <Badge variant="default" className="text-xs">Jackson</Badge>
                <Input
                  type="number"
                  value={item.jacksonQuantity || 0}
                  onChange={(e) => handleQuantityChange(item, 'jackson', Number(e.target.value))}
                  className="w-16 h-8 text-xs"
                  min="0"
                  step="1"
                />
                <Select 
                  value={item.jacksonUnit || 'each'} 
                  onValueChange={(value) => handleUnitChange(item, 'jackson', value)}
                >
                  <SelectTrigger className="w-16 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {commonUnits.map(unit => (
                      <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleRemove(item)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
};