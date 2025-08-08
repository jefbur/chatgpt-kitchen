import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, Plus, Trash2, Upload, Download, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface StapleItem {
  id: string;
  name: string;
  minimum_quantity: number;
  unit: string;
  current_quantity?: number;
  is_low?: boolean;
}

const commonLocations = [
  'Inside fridge', 'Garage fridge', 'Inside freezer', 'Garage freezer',
  'Chest freezer', 'Pantry', 'Counter', 'Bread drawer', 'Overflow',
  'Fridge', 'Freezer'
];

export const StaplesPage = () => {
  const [staples, setStaples] = useState<StapleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newItem, setNewItem] = useState({
    name: '',
    minimum_quantity: 1,
    unit: 'each'
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchStaples();
  }, []);

  const fetchStaples = async () => {
    try {
      // For now, we'll store staples as a special type in pantry_items with negative user_id
      const { data: staplesData, error: staplesError } = await supabase
        .from('pantry_items')
        .select('*')
        .eq('user_id', '11111111-1111-1111-1111-111111111111'); // Special ID for staples

      if (staplesError) throw staplesError;

      // Get current inventory quantities (only from jackson site)
      const staplesWithCurrent = await Promise.all((staplesData || []).map(async (staple) => {
        const { data: currentItems } = await supabase
          .from('pantry_items')
          .select('quantity, location')
          .eq('name', staple.name)
          .neq('user_id', '11111111-1111-1111-1111-111111111111');

        // Filter to only jackson locations (exclude shore-specific locations)
        const jacksonItems = currentItems?.filter(item => 
          !['Fridge', 'Freezer', 'Pantry'].includes(item.location) || 
          ['Inside fridge', 'Garage fridge', 'Inside freezer', 'Garage freezer', 'Chest freezer', 'Counter', 'Bread drawer', 'Overflow'].includes(item.location)
        ) || [];

        const currentQuantity = jacksonItems.reduce((sum, item) => sum + Number(item.quantity), 0);
        const isLow = currentQuantity < Number(staple.quantity);

        return {
          id: staple.id,
          name: staple.name,
          minimum_quantity: Number(staple.quantity),
          unit: staple.unit || 'each',
          current_quantity: currentQuantity,
          is_low: isLow
        };
      }));

      setStaples(staplesWithCurrent);
    } catch (error) {
      console.error('Error fetching staples:', error);
      toast({
        title: "Error",
        description: "Failed to load staples",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addStaple = async () => {
    if (!newItem.name.trim()) {
      toast({
        title: "Error",
        description: "Please enter an item name",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('pantry_items')
        .insert({
          name: newItem.name,
          quantity: newItem.minimum_quantity,
          unit: newItem.unit,
          location: 'Pantry', // Default location for staples
          user_id: '11111111-1111-1111-1111-111111111111', // Special ID for staples
          notes: 'staple_minimum'
        });

      if (error) throw error;

      setNewItem({
        name: '',
        minimum_quantity: 1,
        unit: 'each'
      });

      fetchStaples();
      toast({
        title: "Success",
        description: "Staple item added"
      });
    } catch (error) {
      console.error('Error adding staple:', error);
      toast({
        title: "Error",
        description: "Failed to add staple item",
        variant: "destructive"
      });
    }
  };

  const updateStaple = async (id: string, field: string, value: any) => {
    try {
      const updateData = field === 'minimum_quantity' ? { quantity: value } : { [field]: value };
      
      const { error } = await supabase
        .from('pantry_items')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      fetchStaples();
    } catch (error) {
      console.error('Error updating staple:', error);
      toast({
        title: "Error",
        description: "Failed to update staple",
        variant: "destructive"
      });
    }
  };

  const removeStaple = async (id: string) => {
    if (!confirm('Are you sure you want to remove this staple item?')) return;

    try {
      const { error } = await supabase
        .from('pantry_items')
        .delete()
        .eq('id', id);

      if (error) throw error;

      fetchStaples();
      toast({
        title: "Success",
        description: "Staple item removed"
      });
    } catch (error) {
      console.error('Error removing staple:', error);
      toast({
        title: "Error",
        description: "Failed to remove staple",
        variant: "destructive"
      });
    }
  };

  const deleteAllStaples = async () => {
    if (!confirm('Are you sure you want to delete ALL staples? This cannot be undone.')) return;

    try {
      const { error } = await supabase
        .from('pantry_items')
        .delete()
        .eq('user_id', '11111111-1111-1111-1111-111111111111');

      if (error) throw error;

      fetchStaples();
      toast({
        title: "Success",
        description: "All staples deleted"
      });
    } catch (error) {
      console.error('Error deleting all staples:', error);
      toast({
        title: "Error",
        description: "Failed to delete staples",
        variant: "destructive"
      });
    }
  };

  const addLowStaplesToShoppingList = async () => {
    try {
      const lowStaples = staples.filter(staple => staple.is_low);
      
      if (lowStaples.length === 0) {
        toast({
          title: "All good!",
          description: "No staples are running low"
        });
        return;
      }

      for (const staple of lowStaples) {
        const neededQuantity = staple.minimum_quantity - (staple.current_quantity || 0);
        
        // Check if item already exists in shopping list
        const { data: existingShoppingItem } = await supabase
          .from('shopping_list')
          .select('*')
          .eq('item_name', staple.name)
          .single();

        if (existingShoppingItem) {
          // Update existing item and mark as staple
          await supabase
            .from('shopping_list')
            .update({ 
              quantity: neededQuantity,
              unit: staple.unit,
              is_staple: true 
            })
            .eq('id', existingShoppingItem.id);
        } else {
          // Add new item marked as staple
          await supabase
            .from('shopping_list')
            .insert({
              item_name: staple.name,
              quantity: neededQuantity,
              unit: staple.unit,
              location: 'Pantry',
              user_id: '00000000-0000-0000-0000-000000000000',
              is_staple: true
            });
        }
      }

      toast({
        title: "Success",
        description: `Added ${lowStaples.length} low staples to shopping list`
      });
    } catch (error) {
      console.error('Error adding staples to shopping list:', error);
      toast({
        title: "Error",
        description: "Failed to add staples to shopping list",
        variant: "destructive"
      });
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv'))) {
      setFile(selectedFile);
    } else {
      toast({
        title: "Error",
        description: "Please select a CSV file",
        variant: "destructive"
      });
    }
  };

  const handleUploadStaples = async () => {
    if (!file) {
      toast({
        title: "Error", 
        description: "Please select a file to upload",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Skip header row
        if (i === 0 && (line.toLowerCase().includes('name') || line.toLowerCase().includes('ingredient'))) {
          continue;
        }
        
        const columns = line.split(',').map(col => col.trim().replace(/^["']|["']$/g, ''));
        
        if (columns.length >= 3) {
          const name = columns[0];
          const quantity = parseFloat(columns[1]) || 1;
          const unit = columns[2] || 'each';
          
          if (name) {
            // Check if staple already exists
            const { data: existing } = await supabase
              .from('pantry_items')
              .select('id')
              .eq('name', name)
              .eq('user_id', '11111111-1111-1111-1111-111111111111')
              .single();
            
            if (existing) {
              // Update existing staple
              await supabase
                .from('pantry_items')
                .update({ quantity, unit })
                .eq('id', existing.id);
            } else {
              // Add new staple
              await supabase
                .from('pantry_items')
                .insert({
                  name,
                  quantity,
                  unit,
                  location: 'Pantry',
                  user_id: '11111111-1111-1111-1111-111111111111',
                  notes: 'staple_minimum'
                });
            }
          }
        }
      }

      toast({
        title: "Success",
        description: "Staples uploaded successfully"
      });

      fetchStaples();
      setShowUploadDialog(false);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading staples:', error);
      toast({
        title: "Error",
        description: "Failed to upload staples",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadStaples = () => {
    const csvHeaders = ['Name', 'Minimum Quantity', 'Unit'];
    const csvData = staples.map(staple => [
      staple.name,
      staple.minimum_quantity,
      staple.unit
    ]);
    
    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'staples.csv';
    link.click();
    window.URL.revokeObjectURL(url);
    
    toast({
      title: "Success",
      description: "Staples downloaded successfully"
    });
  };

  if (loading) {
    return <div className="text-center p-8">Loading staples...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-butter-yellow flex items-center justify-center">
              <Star className="h-4 w-4" />
            </div>
            Staples Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Add New Staple */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3">Add New Staple</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Input
                    placeholder="Item name"
                    value={newItem.name}
                    onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                  />
                  <Input
                    type="number"
                    placeholder="Min quantity"
                    value={newItem.minimum_quantity}
                    onChange={(e) => setNewItem(prev => ({ ...prev, minimum_quantity: Number(e.target.value) }))}
                    min="0"
                    step="0.1"
                  />
                  <Input
                    placeholder="Unit"
                    value={newItem.unit}
                    onChange={(e) => setNewItem(prev => ({ ...prev, unit: e.target.value }))}
                  />
                  <Button onClick={addStaple} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setShowUploadDialog(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Staples
              </Button>
              <Button variant="outline" onClick={handleDownloadStaples}>
                <Download className="h-4 w-4 mr-2" />
                Download Staples
              </Button>
              <Button variant="lavender" onClick={addLowStaplesToShoppingList}>
                <AlertTriangle className="h-4 w-4 mr-2" />
                Add Low Staples to Shopping List
              </Button>
              <Button variant="destructive" onClick={deleteAllStaples}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete All Staples
              </Button>
            </div>

            {/* Staples List */}
            <div className="space-y-3">
              {staples.length === 0 ? (
                <Card className="text-center p-8">
                  <CardContent>
                    <p className="text-muted-foreground">
                      No staples defined yet. Add some items you always want to keep in stock!
                    </p>
                  </CardContent>
                </Card>
              ) : (
                staples.map(staple => (
                  <Card key={staple.id} className={`p-4 ${staple.is_low ? 'border-destructive' : ''}`}>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{staple.name}</span>
                          {staple.is_low && (
                            <Badge variant="destructive">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Low
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm">
                          Current: <span className={staple.is_low ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
                            {staple.current_quantity || 0} {staple.unit}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-sm text-muted-foreground">Min:</div>
                        <Input
                          type="number"
                          value={staple.minimum_quantity}
                          onChange={(e) => updateStaple(staple.id, 'minimum_quantity', Number(e.target.value))}
                          className="w-20"
                          min="0"
                          step="0.1"
                        />
                        <span className="text-sm text-muted-foreground min-w-[40px]">
                          {staple.unit}
                        </span>
                      </div>

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => removeStaple(staple.id)}
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

      {/* Upload Staples Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Staples Spreadsheet</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Expected CSV Format:</Label>
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded">
                <div className="font-mono">Name, Minimum Quantity, Unit</div>
                <div className="font-mono">Rice, 5, pound</div>
                <div className="font-mono">Eggs, 12, each</div>
                <div className="mt-2">
                  • Header row is optional<br/>
                  • If staple exists, it will be updated
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="staples-file-upload">CSV File</Label>
              <Input
                id="staples-file-upload"
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                ref={fileInputRef}
              />
            </div>

            {file && (
              <div className="text-sm text-muted-foreground">
                Selected: {file.name}
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleUploadStaples} 
                disabled={!file || uploading}
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? "Uploading..." : "Upload"}
              </Button>
              <Button onClick={() => setShowUploadDialog(false)} variant="outline" className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};