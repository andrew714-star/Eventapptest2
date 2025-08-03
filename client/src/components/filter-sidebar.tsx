import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { EventFilter, categories } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  const handleCategoryChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedCategory = event.target.value;
    setLocalFilters(prev => ({ ...prev, categories: selectedCategory ? [selectedCategory] : [] }));
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
          <div className="flex space-x-4 items-center">
            <div className="relative flex-1">
              <Label>Search Events</Label>
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/4 text-gray-400 h-10" size={16} />
              <Input
                placeholder="Search by title, location, or keywords..."
                className="pl-10 h-10" // Ensure same height for input
                value={localFilters.search || ""}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>

            <div className="flex-1">
              <Label>Categories</Label>
              <select
                value={localFilters.categories?.[0] || ""}
                onChange={handleCategoryChange}
                className="w-full border rounded-md h-10 p-2" // Ensure same height for dropdown
              >
                <option value="">Select a category...</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative flex-1">
              <Label>City</Label>
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/4 text-gray-400 h-10" size={16} />
              <Input
                placeholder="Search by city name..."
                className="pl-10 h-10" // Ensure same height for input
                value={localFilters.location || ""}
                onChange={(e) => handleLocationChange(e.target.value)}
              />
            </div>

            <div className="flex-1">
              <Label>Jurisdiction</Label>
              <select
                value={localFilters.jurisdiction || ""}
                onChange={(e) => setLocalFilters(prev => ({ ...prev, jurisdiction: e.target.value || undefined }))}
                className="w-full border rounded-md h-10 p-2" // Ensure same height for dropdown
              >
                <option value="">All Jurisdictions</option>
                <option value="city">City Government</option>
                <option value="county">County Government</option>
                <option value="congressional">US Congressional District</option>
                <option value="senate">US Senate District</option>
                <option value="state">State Government</option>
              </select>
            </div>
          </div>
        </div>

        <Button variant="outline" className="w-full" onClick={clearFilters}>
          Clear All Filters
        </Button>
      </CardContent>
    </Card>
  );
}