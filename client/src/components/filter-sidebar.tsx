
import { useState, useEffect, useRef } from "react";
import { Search, Map, Pencil, Square, ZoomIn, ZoomOut, Move, MapPin } from "lucide-react";
import { EventFilter, categories } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import React, { useState, useCallback } from 'react';
import { GoogleMap, LoadScript, DrawingManager, Polygon } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: '400px'
};

const center = {
  lat: 37.0902, // Center of the USA
  lng: -95.7129
};

export function LocationMap() {
  const [polygons, setPolygons] = useState<any[]>([]);
  const [selectedPolygon, setSelectedPolygon] = useState<any>(null);

  const handlePolygonComplete = (polygon: any) => {
    const path = polygon.getPath().getArray().map(latLng => ({
      lat: latLng.lat(),
      lng: latLng.lng(),
    }));

    setPolygons(prev => [...prev, path]);

    // Send the area data to the server
    fetch('/api/discover-feeds-by-area', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ area: path }),
    })
      .then(response => response.json())
      .then(data => {
        console.log("Discovered feeds based on area:", data);
        // Handle discovered feeds data here
      })
      .catch(error => console.error('Error discovering feeds:', error));
  };

  return (
    <LoadScript googleMapsApiKey="YOUR_GOOGLE_MAPS_API_KEY">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={4}
      >
        {polygons.map((polygon, index) => (
          <Polygon
            key={index}
            paths={polygon}
            options={{
              fillColor: "#000",
              fillOpacity: 0.35,
              strokeColor: "#000",
              strokeOpacity: 0.8,
              strokeWeight: 2,
              editable: false,
            }}
          />
        ))}

        <DrawingManager
          onPolygonComplete={handlePolygonComplete}
          options={{
            drawingMode: 'polygon',
            drawingControl: true,
            drawingControlOptions: {
              position: window.google.maps.ControlPosition.TOP_CENTER,
              drawingModes: ['polygon']
            },
          }}
        />
      </GoogleMap>
    </LoadScript>
  );
}

interface FilterSidebarProps {
  filters: EventFilter;
  onFiltersChange: (filters: EventFilter) => void;
}

export function FilterSidebar({ filters, onFiltersChange }: FilterSidebarProps) {
  const [localFilters, setLocalFilters] = useState<EventFilter>(filters);
  const [mapOpen, setMapOpen] = useState(false);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
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

    // Fetch city suggestions as user types
    if (location && location.length >= 2) {
      fetch(`/api/city-suggestions?q=${encodeURIComponent(location)}&limit=10`)
        .then(res => res.json())
        .then(data => {
          setCitySuggestions(data.suggestions || []);
          setShowSuggestions(data.suggestions?.length > 0);
        })
        .catch(err => console.error('Failed to fetch city suggestions:', err));
    } else {
      setCitySuggestions([]);
      setShowSuggestions(false);
    }

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

  const handleSuggestionClick = (suggestion: string) => {
    setLocalFilters(prev => ({ ...prev, location: suggestion }));
    setShowSuggestions(false);
    setCitySuggestions([]);
    
    // Trigger discovery for selected suggestion
    const parts = suggestion.split(',').map(p => p.trim());
    if (parts.length === 2) {
      handleLocationChange(suggestion);
    }
  };

  const discoverTopCitiesMutation = useMutation({
    mutationFn: async (count: number) => {
      const response = await fetch('/api/discover-top-cities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count })
      });

      if (!response.ok) {
        throw new Error('Failed to discover top cities');
      }

      return response.json();
    },
    onSuccess: async (data) => {
      // Add all discovered feeds automatically
      for (const feed of data.discoveredFeeds) {
        await addFeedMutation.mutateAsync(feed.source);
      }
      toast({
        title: "Top Cities Discovery Complete",
        description: `Found ${data.totalCount} calendar feeds across ${data.cities.length} major cities`,
      });
    },
    onError: () => {
      toast({
        title: "Discovery Failed",
        description: "Could not discover feeds for top cities. Please try again.",
        variant: "destructive",
      });
    },
  });

  const discoverStateFeedsMutation = useMutation({
    mutationFn: async (stateCode: string) => {
      const response = await fetch(`/api/discover-state-feeds/${stateCode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 25 }) // Limit to 25 cities per state
      });

      if (!response.ok) {
        throw new Error('Failed to discover state feeds');
      }

      return response.json();
    },
    onSuccess: async (data) => {
      // Add all discovered feeds automatically
      for (const feed of data.discoveredFeeds) {
        await addFeedMutation.mutateAsync(feed.source);
      }
      toast({
        title: "State Discovery Complete",
        description: `Found ${data.count} calendar feeds across ${data.cities.length} cities in ${data.state}`,
      });
    },
    onError: () => {
      toast({
        title: "State Discovery Failed",
        description: "Could not discover feeds for the selected state. Please try again.",
        variant: "destructive",
      });
    },
  });

  const clearFilters = () => {
    setLocalFilters({});
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
                className="pl-10 h-10"
                value={localFilters.search || ""}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>

            <div className="flex-1">
              <Label>Categories</Label>
              <select
                value={localFilters.categories?.[0] || ""}
                onChange={handleCategoryChange}
                className="w-full border rounded-md h-10 p-2"
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
                  placeholder="Type city name (e.g., Austin, TX)..."
                  className="pl-10 pr-10 h-10"
                  value={localFilters.location || ""}
                  onChange={(e) => handleLocationChange(e.target.value)}
                  onFocus={() => {
                    if (citySuggestions.length > 0) {
                      setShowSuggestions(true);
                    }
                  }}
                  onBlur={() => {
                    // Delay hiding suggestions to allow clicking
                    setTimeout(() => setShowSuggestions(false), 150);
                  }}
                />
                
                {/* City Suggestions Dropdown */}
                {showSuggestions && citySuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto mt-1">
                    {citySuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2"
                        onClick={() => handleSuggestionClick(suggestion)}
                      >
                        <MapPin size={14} className="text-gray-400" />
                        <span className="text-sm">{suggestion}</span>
                      </button>
                    ))}
                  </div>
                )}

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
                  <DialogContent className="max-w-5xl max-h-[90vh]">
                    <DialogHeader>
                      <DialogTitle>Interactive Regional Map</DialogTitle>
                      <p className="text-sm text-muted-foreground">
                        Select cities by clicking the blue pins or draw areas to select multiple cities at once. Events from selected cities will be automatically added to your calendar.
                      </p>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                      {/* Interactive US Map */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg h-[500px] relative overflow-hidden">
                        <USMapWithDrawing
                          selectedRegions={selectedRegions}
                          onRegionChange={setSelectedRegions}
                        />
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

        {/* Bulk Discovery Options */}
        <div className="space-y-2">
          <Label>Bulk Discovery</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => discoverTopCitiesMutation.mutate(50)}
              disabled={discoverTopCitiesMutation.isPending}
            >
              {discoverTopCitiesMutation.isPending ? 'Discovering...' : 'Top 50 Cities'}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => discoverTopCitiesMutation.mutate(100)}
              disabled={discoverTopCitiesMutation.isPending}
            >
              {discoverTopCitiesMutation.isPending ? 'Discovering...' : 'Top 100 Cities'}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Discover calendar feeds from major US cities automatically
          </div>
        </div>

        <Button variant="outline" className="w-full" onClick={clearFilters}>
          Clear All Filters
        </Button>
      </CardContent>
    </Card>
  );
}
