import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Download, Upload, ArrowRightLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AddInventoryDialog } from "./AddInventoryDialog";
import { TransferItemsDialog } from "./TransferItemsDialog";
import { SpreadsheetUploadDialog } from "./SpreadsheetUploadDialog";

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  location: string;
  site: 'jackson' | 'shore';
}

const jacksonLocations = [
  'Inside fridge', 'Garage fridge', 'Inside freezer', 'Garage freezer', 
  'Chest freezer', 'Pantry', 'Counter', 'Bread drawer', 'Overflow'
];

const shoreLocations = ['Fridge', 'Freezer', 'Pantry'];

export const InventoryPage = () => {
  const [selectedSite, setSelectedSite] = useState<'jackson' | 'shore'>('jackson');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLocation, setFilterLocation] = useState('all');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchInventory();
  }, [selectedSite]);

  const fetchInventory = async () => {
    try {
      const { data, error } = await supabase
        .from('pantry_items')
        .select('*')
        .order('name');

      if (error) throw error;
      
      // Map to our interface format with proper site detection based on user_id
      const mappedInventory: InventoryItem[] = (data || []).map(item => ({
        id: item.id,
        name: item.name,
        quantity: Number(item.quantity),
        unit: item.unit || 'each',
        location: item.location,
        site: item.user_id === '11111111-1111-1111-1111-111111111111' ? 'shore' : 'jackson'
      }));

      setInventory(mappedInventory);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast({
        title: "Error",
        description: "Failed to load inventory",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTransferItems = () => {
    setShowTransferDialog(true);
  };

  const handleUploadSpreadsheet = () => {
    setShowUploadDialog(true);
  };

  const handleDownloadInventory = () => {
    const csvHeaders = ['Name', 'Quantity', 'Unit', 'Location', 'Site'];
    const csvData = inventory.map(item => [
      item.name,
      item.quantity,
      item.unit,
      item.location,
      item.site
    ]);
    
    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'inventory.csv';
    link.click();
    window.URL.revokeObjectURL(url);
    
    toast({
      title: "Success",
      description: "Inventory downloaded successfully"
    });
  };

  const updateItem = async (id: string, field: string, value: any) => {
    try {
      const { error } = await supabase
        .from('pantry_items')
        .update({ [field]: value })
        .eq('id', id);

      if (error) throw error;
      fetchInventory();
    } catch (error) {
      console.error('Error updating item:', error);
      toast({
        title: "Error",
        description: "Failed to update item",
        variant: "destructive"
      });
    }
  };

  const removeItem = async (id: string) => {
    if (!confirm('Are you sure you want to remove this item?')) return;

    try {
      const { error } = await supabase
        .from('pantry_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      fetchInventory();
      toast({
        title: "Success",
        description: "Item removed from inventory"
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

  const handleDeleteAllInventory = async () => {
    if (!confirm('Are you sure you want to delete ALL inventory items from both Jackson and Shore? This cannot be undone.')) return;

    try {
      const { error } = await supabase
        .from('pantry_items')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

      if (error) throw error;
      
      fetchInventory();
      toast({
        title: "Success",
        description: "All inventory items deleted"
      });
    } catch (error) {
      console.error('Error deleting all inventory:', error);
      toast({
        title: "Error",
        description: "Failed to delete inventory",
        variant: "destructive"
      });
    }
  };

  const currentLocations = selectedSite === 'jackson' ? jacksonLocations : shoreLocations;
  const filteredInventory = inventory
    .filter(item => item.site === selectedSite)
    .filter(item => filterLocation === 'all' || item.location === filterLocation)
    .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-mint flex items-center justify-center">
              📦
            </div>
            Food Inventory Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedSite} onValueChange={(value) => setSelectedSite(value as 'jackson' | 'shore')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="jackson" className="data-[state=active]:bg-mint">
                Jackson Location
              </TabsTrigger>
              <TabsTrigger value="shore" className="data-[state=active]:bg-baby-blue">
                Shore Location
              </TabsTrigger>
            </TabsList>

            <TabsContent value={selectedSite} className="space-y-4">
              {/* Controls */}
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-64">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search ingredients..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <Select value={filterLocation} onValueChange={setFilterLocation}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {currentLocations.map(location => (
                      <SelectItem key={location} value={location}>{location}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button variant="mint" onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={handleUploadSpreadsheet}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Spreadsheet
                </Button>
                <Button variant="outline" onClick={handleDownloadInventory}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Inventory
                </Button>
                <Button variant="lavender" onClick={handleTransferItems}>
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Transfer Items
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleDeleteAllInventory}
                  className="ml-auto"
                >
                  Delete All Inventory
                </Button>
              </div>

              {/* Inventory Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredInventory.map(item => (
                  <Card key={item.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold">{item.name}</h3>
                        <Badge variant="outline" className="text-xs">
                          {item.site}
                        </Badge>
                      </div>
                      <p className="text-lg font-bold text-primary">
                        {item.quantity} {item.unit}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        📍 {item.location}
                      </p>
                      <div className="flex gap-2 mt-3">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => setEditingItem(item)}
                        >
                          Edit
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          className="flex-1"
                          onClick={() => removeItem(item.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {loading ? (
                <div className="text-center p-8">Loading inventory...</div>
              ) : filteredInventory.length === 0 ? (
                <Card className="text-center p-8">
                  <CardContent>
                    <p className="text-muted-foreground">
                      No items found. Add some ingredients to get started!
                    </p>
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <AddInventoryDialog 
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onItemAdded={fetchInventory}
      />

      <AddInventoryDialog 
        open={!!editingItem}
        onOpenChange={() => setEditingItem(null)}
        onItemAdded={() => {
          fetchInventory();
          setEditingItem(null);
        }}
        editItem={editingItem ? {
          id: editingItem.id,
          name: editingItem.name,
          quantity: editingItem.quantity,
          unit: editingItem.unit,
          location: editingItem.location,
          site: editingItem.site
        } : null}
      />

      <TransferItemsDialog
        open={showTransferDialog}
        onOpenChange={setShowTransferDialog}
        onTransferComplete={fetchInventory}
        currentSite={selectedSite}
      />

      <SpreadsheetUploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        onUploadComplete={fetchInventory}
      />
    </div>
  );
};