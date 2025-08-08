import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";

interface HistoryEntry {
  date: string;
  weekType: 'A' | 'B';
  location: 'Jackson' | 'Shore';
  meals: { [key: string]: { [key: string]: string[] } }; // day -> mealType -> recipe names
}

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const mealTypes = [
  { name: 'Breakfast', slots: 2 },
  { name: 'Lunch', slots: 2 },
  { name: 'Snack', slots: 1 },
  { name: 'Dinner', slots: 4 },
  { name: 'Dessert', slots: 1 }
];

export const HistoryPage = () => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    const savedHistory = localStorage.getItem('mealPlanHistory');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  };

  if (history.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                <History className="h-4 w-4" />
              </div>
              Meal Plan History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center p-8">
              No meal plan history yet. Add some meal plans to see them here!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
              <History className="h-4 w-4" />
            </div>
            Meal Plan History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {history.map((entry, index) => (
              <div key={index} className="space-y-4">
                <div className="flex items-center gap-4 border-b pb-2">
                  <h3 className="text-lg font-semibold">{entry.date}</h3>
                  <Badge variant={entry.weekType === 'A' ? 'default' : 'secondary'}>
                    Week {entry.weekType}
                  </Badge>
                  <Badge variant={entry.location === 'Jackson' ? 'default' : 'secondary'}>
                    {entry.location}
                  </Badge>
                </div>
                
                {/* Meal Grid */}
                <div className="grid grid-cols-8 gap-2 text-sm">
                  {/* Header row */}
                  <div className="font-semibold"></div>
                  {daysOfWeek.map(day => (
                    <div key={day} className="font-semibold text-center p-2 bg-muted rounded">
                      {day.slice(0, 3)}
                    </div>
                  ))}
                  
                  {/* Meal rows */}
                  {mealTypes.map(mealType => (
                    <div key={mealType.name} className="contents">
                      <div className="font-medium p-2 bg-muted/50 rounded flex items-center">
                        {mealType.name}
                      </div>
                      {daysOfWeek.map(day => (
                        <div key={`${day}-${mealType.name}`} className="p-2 border rounded min-h-[60px]">
                          <div className="space-y-1">
                            {(entry.meals[day]?.[mealType.name] || []).map((recipeName, idx) => (
                              <div key={idx} className="text-xs p-1 bg-muted/30 rounded">
                                {recipeName}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};