import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload } from "lucide-react";

interface SpreadsheetUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete: () => void;
}

const jacksonLocations = [
  'Inside fridge', 'Garage fridge', 'Inside freezer', 'Garage freezer', 
  'Chest freezer', 'Pantry', 'Counter', 'Bread drawer', 'Overflow'
];

const shoreLocations = ['Fridge', 'Freezer', 'Pantry'];

const units = ['teaspoon', 'tablespoon', 'cup', 'fluid ounce', 'pint', 'quart', 'gallon', 'ounce', 'pound', 'stick', 'can', 'jar', 'bunch', 'head', 'clove', 'each', 'bottle', 'bag'];

export const SpreadsheetUploadDialog = ({ open, onOpenChange, onUploadComplete }: SpreadsheetUploadDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [site, setSite] = useState<'jackson' | 'shore'>('jackson');
  const [defaultLocation, setDefaultLocation] = useState('Pantry');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const currentLocations = site === 'jackson' ? jacksonLocations : shoreLocations;

  const parseCSV = (text: string): Array<{name: string, quantity: number, unit: string, location?: string, site?: 'jackson' | 'shore'}> => {
    const lines = text.split('\n').filter(line => line.trim());
    const items: Array<{name: string, quantity: number, unit: string, location?: string, site?: 'jackson' | 'shore'}> = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Skip header row if it contains common header terms
      if (i === 0 && (line.toLowerCase().includes('name') || line.toLowerCase().includes('item') || line.toLowerCase().includes('ingredient'))) {
        continue;
      }
      
      const columns = line.split(',').map(col => col.trim().replace(/^["']|["']$/g, ''));
      
      if (columns.length >= 2) {
        const name = columns[0];
        const quantityStr = columns[1];
        const unitStr = columns[2] || 'each';
        const locationStr = columns[3] || defaultLocation;
        const siteStr = columns[4]; // Site column
        
        const quantity = parseFloat(quantityStr) || 1;
        
        // Validate unit
        const unit = units.includes(unitStr.toLowerCase()) ? unitStr.toLowerCase() : 'each';
        
        // Determine site - check if site column exists, otherwise infer from location
        let itemSite: 'jackson' | 'shore';
        if (siteStr && (siteStr.toLowerCase() === 'shore' || siteStr.toLowerCase() === 'jackson')) {
          itemSite = siteStr.toLowerCase() as 'jackson' | 'shore';
        } else {
          // Infer from location
          itemSite = (['Fridge', 'Freezer', 'Pantry'].includes(locationStr) && 
                     !['Inside fridge', 'Garage fridge', 'Inside freezer', 'Garage freezer', 'Chest freezer', 'Counter', 'Bread drawer', 'Overflow'].includes(locationStr)) 
                     ? 'shore' : 'jackson';
        }
        
        // Get appropriate locations for the determined site
        const appropriateLocations = itemSite === 'jackson' ? jacksonLocations : shoreLocations;
        
        // Validate location based on site - preserve original location if valid for site
        const location = appropriateLocations.includes(locationStr) ? locationStr : 
                        (itemSite === 'jackson' ? 'Pantry' : 'Pantry');
        
        if (name) {
          items.push({ name, quantity, unit, location, site: itemSite });
        }
      }
    }
    
    return items;
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

  const checkExistingItem = async (name: string, location: string) => {
    const { data, error } = await supabase
      .from('pantry_items')
      .select('id, quantity')
      .eq('name', name)
      .eq('location', location)
      .neq('user_id', '11111111-1111-1111-1111-111111111111')
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  };

const handleUpload = async () => {
    if (!file) {
      toast({
        title: "Error",
        description: "Please select a file to upload",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const text = await file.text();
      const items = parseCSV(text);
      
      if (items.length === 0) {
        toast({
          title: "Error",
          description: "No valid items found in the file",
          variant: "destructive"
        });
        return;
      }

      let addedCount = 0;
      let updatedCount = 0;

      for (const item of items) {
        try {
          // Determine the correct user_id based on site
          const userId = item.site === 'shore' ? '11111111-1111-1111-1111-111111111111' : '00000000-0000-0000-0000-000000000000';
          
          // Check if item already exists at this location and site
          const { data: existing, error: checkError } = await supabase
            .from('pantry_items')
            .select('*')
            .eq('name', item.name)
            .eq('location', item.location || defaultLocation)
            .eq('user_id', userId)
            .single();

          if (checkError && checkError.code !== 'PGRST116') throw checkError;
          
          if (existing) {
            // Replace existing item quantity (not add to it)
            const { error } = await supabase
              .from('pantry_items')
              .update({ quantity: item.quantity })
              .eq('id', existing.id);
              
            if (error) throw error;
            updatedCount++;
          } else {
            // Add new item with correct user_id based on site
            const { error } = await supabase
              .from('pantry_items')
              .insert({
                name: item.name,
                quantity: item.quantity,
                unit: item.unit,
                location: item.location || defaultLocation,
                user_id: userId
              });
              
            if (error) throw error;
            addedCount++;
          }
        } catch (itemError) {
          console.error(`Error processing item ${item.name}:`, itemError);
        }
      }

      toast({
        title: "Success",
        description: `Upload complete! Added ${addedCount} new items, updated ${updatedCount} existing items.`
      });

      onUploadComplete();
      onOpenChange(false);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Error",
        description: "Failed to upload file",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="upload-spreadsheet-description">
        <DialogHeader>
          <DialogTitle>Upload Inventory Spreadsheet</DialogTitle>
        </DialogHeader>
        <div id="upload-spreadsheet-description" className="sr-only">
          Upload a CSV file to import inventory items
        </div>
        
        <div className="space-y-4">
            <div className="space-y-2">
            <Label>Expected CSV Format:</Label>
            <div className="text-sm text-muted-foreground bg-muted p-3 rounded">
              <div className="font-mono">Name, Quantity, Unit, Location, Site</div>
              <div className="font-mono">Apples, 5, each, Pantry, jackson</div>
              <div className="font-mono">Milk, 1, gallon, Fridge, shore</div>
              <div className="mt-2">
                • Header row is optional<br/>
                • Unit, Location, and Site columns are optional<br/>
                • Site should be "jackson" or "shore"<br/>
                • If item exists, quantity will be replaced (not added)
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Site</Label>
            <div className="flex gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="jackson-upload"
                  checked={site === 'jackson'}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSite('jackson');
                      setDefaultLocation(jacksonLocations[0]);
                    }
                  }}
                />
                <Label htmlFor="jackson-upload">Jackson</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="shore-upload"
                  checked={site === 'shore'}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSite('shore');
                      setDefaultLocation(shoreLocations[0]);
                    }
                  }}
                />
                <Label htmlFor="shore-upload">Shore</Label>
              </div>
            </div>
          </div>

          <div>
            <Label>Default Location (for items without location specified)</Label>
            <Select value={defaultLocation} onValueChange={setDefaultLocation}>
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

          <div>
            <Label htmlFor="file-upload">CSV File</Label>
            <Input
              id="file-upload"
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
              onClick={handleUpload} 
              disabled={!file || loading}
              className="flex-1"
            >
              <Upload className="h-4 w-4 mr-2" />
              {loading ? "Uploading..." : "Upload"}
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
