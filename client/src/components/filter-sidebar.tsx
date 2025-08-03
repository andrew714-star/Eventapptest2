import { useState, useEffect } from "react";
import { Search, Map } from "lucide-react";
import { EventFilter, categories } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface FilterSidebarProps {
  filters: EventFilter;
  onFiltersChange: (filters: EventFilter) => void;
}

export function FilterSidebar({ filters, onFiltersChange }: FilterSidebarProps) {
  const [localFilters, setLocalFilters] = useState<EventFilter>(filters);
  const [mapOpen, setMapOpen] = useState(false);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const discoverFeedsMutation = useMutation({
    mutationFn: async ({ city, state }: { city: string; state: string }) => {
      const response = await fetch('/api/discover-feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, state })
      });

      if (!response.ok) {
        throw new Error('Failed to discover feeds');
      }

      return response.json();
    },
  });

  const addFeedMutation = useMutation({
    mutationFn: async (source: any) => {
      const response = await fetch('/api/add-discovered-feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: { ...source, isActive: true } })
      });
      
      if (!response.ok) {
        throw new Error('Failed to add feed');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar-sources'] });
      queryClient.invalidateQueries({ queryKey: ['/api/events/filter'] });
    },
  });

  const discoverRegionalFeedsMutation = useMutation({
    mutationFn: async (regions: string[]) => {
      const response = await fetch('/api/discover-regional-feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regions })
      });

      if (!response.ok) {
        throw new Error('Failed to discover regional feeds');
      }

      return response.json();
    },
    onSuccess: async (data) => {
      // Add all discovered feeds automatically
      for (const feed of data.discoveredFeeds) {
        await addFeedMutation.mutateAsync(feed.source);
      }
      toast({
        title: "Regional Discovery Complete",
        description: `Found ${data.count} calendar feeds across ${data.regions.length} regions`,
      });
      setMapOpen(false);
      setSelectedRegions([]);
    },
    onError: () => {
      toast({
        title: "Regional Discovery Failed",
        description: "Could not discover feeds for selected regions. Please try again.",
        variant: "destructive",
      });
    },
  });

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

    // Discover feeds automatically when the location is changed
    if (location) {
      // Split the location into city and state
      const parts = location.split(',').map(p => p.trim());
      if (parts.length === 2) {
        const [city, state] = parts;

        // Call the discover feeds mutation
        discoverFeedsMutation.mutate({ city, state }, {
          onSuccess: async (data) => {
            // Add discovered feeds
            for (const feed of data.discoveredFeeds) {
              await addFeedMutation.mutateAsync(feed.source);
            }
            toast({
              title: "Feed Discovery Complete",
              description: `Found ${data.count} potential calendar feeds for ${data.location.city}, ${data.location.state}`,
            });
          },
          onError: () => {
            toast({
              title: "Discovery Failed",
              description: "Could not discover feeds for this location. Please try another city.",
              variant: "destructive",
            });
          },
        });
      }
    }
  };

  const clearFilters = () => {
    setLocalFilters({});
  };

  const handleRegionClick = (regionName: string) => {
    setSelectedRegions(prev => 
      prev.includes(regionName) 
        ? prev.filter(r => r !== regionName)
        : [...prev, regionName]
    );
  };

  const handleDiscoverRegionalFeeds = () => {
    if (selectedRegions.length === 0) {
      toast({
        title: "No Regions Selected",
        description: "Please select one or more regions on the map to discover feeds.",
        variant: "destructive",
      });
      return;
    }
    discoverRegionalFeedsMutation.mutate(selectedRegions);
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
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  placeholder="Search by city name..."
                  className="pl-10 pr-10 h-10"
                  value={localFilters.location || ""}
                  onChange={(e) => handleLocationChange(e.target.value)}
                />
                <Dialog open={mapOpen} onOpenChange={setMapOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                    >
                      <Map size={16} className="text-gray-400 hover:text-gray-600" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh]">
                    <DialogHeader>
                      <DialogTitle>Select Regions for Event Discovery</DialogTitle>
                      <p className="text-sm text-muted-foreground">
                        Click on regions to select them. Events from cities, school districts, and chambers of commerce in selected areas will be added.
                      </p>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                      {/* Interactive Map */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 h-96 relative overflow-hidden">
                        <svg viewBox="0 0 1000 600" className="w-full h-full">
                          {/* US States/Regions - Simplified for demo */}
                          {[
                            { name: "California", path: "M50 200 L200 200 L200 400 L50 400 Z", cities: ["Los Angeles", "San Francisco", "San Diego"] },
                            { name: "Texas", path: "M300 300 L500 300 L500 450 L300 450 Z", cities: ["Houston", "Dallas", "Austin"] },
                            { name: "Florida", path: "M700 350 L900 350 L900 500 L700 500 Z", cities: ["Miami", "Orlando", "Tampa"] },
                            { name: "New York", path: "M750 100 L950 100 L950 200 L750 200 Z", cities: ["New York City", "Buffalo", "Albany"] },
                            { name: "Illinois", path: "M400 150 L550 150 L550 250 L400 250 Z", cities: ["Chicago", "Springfield", "Rockford"] },
                            { name: "Washington", path: "M50 50 L200 50 L200 150 L50 150 Z", cities: ["Seattle", "Spokane", "Tacoma"] },
                            { name: "Colorado", path: "M250 200 L400 200 L400 300 L250 300 Z", cities: ["Denver", "Boulder", "Colorado Springs"] },
                            { name: "Georgia", path: "M600 250 L750 250 L750 350 L600 350 Z", cities: ["Atlanta", "Savannah", "Augusta"] }
                          ].map((region) => (
                            <g key={region.name}>
                              <path
                                d={region.path}
                                fill={selectedRegions.includes(region.name) ? "#3b82f6" : "#e5e7eb"}
                                stroke="#9ca3af"
                                strokeWidth="2"
                                className="cursor-pointer hover:fill-blue-200 transition-colors"
                                onClick={() => handleRegionClick(region.name)}
                              />
                              <text
                                x={region.path.includes("M50") ? 125 : region.path.includes("M300") ? 400 : region.path.includes("M700") ? 800 : region.path.includes("M750") ? 850 : region.path.includes("M400") ? 475 : region.path.includes("M250") ? 325 : 675}
                                y={region.path.includes("50 L200 50") ? 100 : region.path.includes("300 L500 300") ? 375 : region.path.includes("350 L900 350") ? 425 : region.path.includes("100 L950 100") ? 150 : region.path.includes("150 L550 150") ? 200 : region.path.includes("200 L400 200") ? 250 : 300}
                                textAnchor="middle"
                                className="text-xs font-medium pointer-events-none"
                                fill={selectedRegions.includes(region.name) ? "white" : "#374151"}
                              >
                                {region.name}
                              </text>
                            </g>
                          ))}
                        </svg>
                      </div>

                      {/* Selected Regions Display */}
                      {selectedRegions.length > 0 && (
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-sm font-medium mb-2">Selected Regions ({selectedRegions.length}):</p>
                          <div className="flex flex-wrap gap-2">
                            {selectedRegions.map(region => (
                              <div key={region} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                                {region}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex justify-between">
                        <Button 
                          variant="outline" 
                          onClick={() => setSelectedRegions([])}
                          disabled={selectedRegions.length === 0}
                        >
                          Clear Selection
                        </Button>
                        <Button 
                          onClick={handleDiscoverRegionalFeeds}
                          disabled={selectedRegions.length === 0 || discoverRegionalFeedsMutation.isPending}
                        >
                          {discoverRegionalFeedsMutation.isPending ? 'Discovering...' : `Discover Events (${selectedRegions.length} regions)`}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
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