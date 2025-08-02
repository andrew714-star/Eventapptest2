import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { EventFilter, categories } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface FilterSidebarProps {
  filters: EventFilter;
  onFiltersChange: (filters: EventFilter) => void;
}

export function FilterSidebar({ filters, onFiltersChange }: FilterSidebarProps) {
  const [localFilters, setLocalFilters] = useState<EventFilter>(filters);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      onFiltersChange(localFilters);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [localFilters, onFiltersChange]);

  const handleSearchChange = (value: string) => {
    setLocalFilters(prev => ({ ...prev, search: value || undefined }));
  };

  const handleCategoryChange = (category: string, checked: boolean) => {
    setLocalFilters(prev => {
      const currentCategories = prev.categories || [];
      if (checked) {
        return { ...prev, categories: [...currentCategories, category] };
      } else {
        return { ...prev, categories: currentCategories.filter(c => c !== category) };
      }
    });
  };

  const handleLocationChange = (location: string) => {
    setLocalFilters(prev => ({ ...prev, location: location || undefined }));
  };



  const clearFilters = () => {
    setLocalFilters({});
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search */}
        <div className="space-y-2">
          <Label>Search Events</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <Input
              placeholder="Search by title, location, or keywords..."
              className="pl-10"
              value={localFilters.search || ""}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
        </div>



        {/* Categories */}
        <div className="space-y-3">
          <Label>Categories</Label>
          <div className="space-y-2">
            {categories.map((category) => (
              <div key={category} className="flex items-center space-x-3 hover:bg-gray-50 rounded p-1">
                <Checkbox
                  id={category}
                  checked={localFilters.categories?.includes(category) || false}
                  onCheckedChange={(checked) => handleCategoryChange(category, !!checked)}
                />
                <Label htmlFor={category} className="text-sm cursor-pointer flex-1">
                  {category}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* City Search */}
        <div className="space-y-2">
          <Label>City</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <Input
              placeholder="Search by city name..."
              className="pl-10"
              value={localFilters.location || ""}
              onChange={(e) => handleLocationChange(e.target.value)}
            />
          </div>
        </div>

        <Button variant="outline" className="w-full" onClick={clearFilters}>
          Clear All Filters
        </Button>
      </CardContent>
    </Card>
  );
}
