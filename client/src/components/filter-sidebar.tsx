import { useState, useEffect } from "react";
import { Search, Map, MapPin } from "lucide-react";
import { EventFilter, categories } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { MapSelector } from "@/components/map-selector";

// Mock apiRequest function for demonstration purposes
// In a real application, this would be imported from your API utility
const apiRequest = async (url: string, options?: RequestInit) => {
  // Simulate API call
  console.log(`API Call: ${url}`, options);
  // Mock response
  if (url === "/api/events/filter") {
    return new Response(JSON.stringify([]), { status: 200 });
  }
  if (url === "/api/discover-feeds") {
    return new Response(JSON.stringify({ discoveredFeeds: [] }), { status: 200 });
  }
  if (url === "/api/scrape-location-feeds") {
    return new Response(JSON.stringify({ eventCount: 0, sources: [] }), { status: 200 });
  }
  return new Response(JSON.stringify({}), { status: 200 });
};

interface FilterSidebarProps {
  filters: EventFilter;
  onFiltersChange: (filters: EventFilter) => void;
}

export function FilterSidebar({ filters, onFiltersChange }: FilterSidebarProps) {
  const [localFilters, setLocalFilters] = useState<EventFilter>(filters);
  const [mapOpen, setMapOpen] = useState(false);
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State for managing loading and selected locations for the "Reload Events" and "Force Scrape Feeds" buttons
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]); // Assuming this state is managed elsewhere or derived

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
        const errorData = await response.json().catch(() => ({ message: 'Failed to add feed' }));
        const error = new Error(errorData.message || 'Failed to add feed') as Error & {
          status: number;
          errorData: any;
        };
        error.status = response.status;
        error.errorData = errorData;
        throw error;
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar-sources'] });
      queryClient.invalidateQueries({ queryKey: ['/api/events/filter'] });

      toast({
        title: "Feed Added",
        description: "Calendar feed has been added successfully.",
      });
    },
    onError: (error: any) => {
      const isAlreadyExists = error.status === 409;

      toast({
        title: isAlreadyExists ? "Feed Already Exists" : "Failed to Add Feed",
        description: isAlreadyExists
          ? error.errorData?.message || "This calendar feed has already been added."
          : "Could not add this calendar feed. Please try again.",
        variant: isAlreadyExists ? "default" : "destructive",
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
    // Add to multiple locations if not already present  
    const existingLocations = localFilters.locations || [];
    let updatedLocations = existingLocations;

    // If this is a valid city,state format, add it to the locations array
    if (location) {
      const parts = location.split(',').map(p => p.trim());
      if (parts.length === 2 && !existingLocations.includes(location)) {
        updatedLocations = [...existingLocations, location];
      }
    }

    setLocalFilters(prev => ({
      ...prev,
      location: location || undefined,
      locations: updatedLocations
    }));

    // Update selectedLocations state for the buttons
    if (location && parts.length === 2) {
      setSelectedLocations(prev => {
        if (!prev.includes(location)) {
          return [...prev, location];
        }
        return prev;
      });
    }


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
      const parts = location.split(',').map(p => p.trim());
      if (parts.length === 2) {
        const [city, state] = parts;
        discoverFeedsMutation.mutate({ city, state }, {
          onSuccess: async (data) => {
            // Add all discovered feeds automatically
            for (const feed of data.discoveredFeeds) {
              await addFeedMutation.mutateAsync(feed.source);
            }
            if (data.count > 0) {
              toast({
                title: "New Calendar Sources Found",
                description: `Found ${data.count} calendar feeds for ${city}, ${state}`,
              });
            }
          },
          onError: () => {
            toast({
              title: "Discovery Failed",
              description: "Could not discover feeds for this location.",
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
      const addResults = [];
      for (const feed of data.discoveredFeeds) {
        try {
          const response = await fetch('/api/add-discovered-feed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: { ...feed.source, isActive: true } })
          });

          if (response.ok) {
            addResults.push({ success: true });
            queryClient.invalidateQueries({ queryKey: ['/api/calendar-sources'] });
            queryClient.invalidateQueries({ queryKey: ['/api/events/filter'] });
          } else if (response.status === 409) {
            addResults.push({ success: false, alreadyExists: true });
          } else {
            addResults.push({ success: false, alreadyExists: false });
          }
        } catch (error) {
          console.warn('Error adding feed:', error);
          addResults.push({ success: false, alreadyExists: false });
        }
      }

      const newFeeds = addResults.filter(r => r.success).length;
      const existingFeeds = addResults.filter(r => r.alreadyExists).length;

      let description = `Found ${data.totalCount} calendar feeds across ${data.cities.length} major cities`;
      if (newFeeds > 0) description += `, added ${newFeeds} new feeds`;
      if (existingFeeds > 0) description += `, ${existingFeeds} already existed`;

      toast({
        title: "Top Cities Discovery Complete",
        description: description,
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
      const addResults = [];
      for (const feed of data.discoveredFeeds) {
        try {
          const response = await fetch('/api/add-discovered-feed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: { ...feed.source, isActive: true } })
          });

          if (response.ok) {
            addResults.push({ success: true });
            queryClient.invalidateQueries({ queryKey: ['/api/calendar-sources'] });
            queryClient.invalidateQueries({ queryKey: ['/api/events/filter'] });
          } else if (response.status === 409) {
            addResults.push({ success: false, alreadyExists: true });
          } else {
            addResults.push({ success: false, alreadyExists: false });
          }
        } catch (error) {
          console.warn('Error adding feed:', error);
          addResults.push({ success: false, alreadyExists: false });
        }
      }

      const newFeeds = addResults.filter(r => r.success).length;
      const existingFeeds = addResults.filter(r => r.alreadyExists).length;

      let description = `Found ${data.count} calendar feeds across ${data.cities.length} cities in ${data.state}`;
      if (newFeeds > 0) description += `, added ${newFeeds} new feeds`;
      if (existingFeeds > 0) description += `, ${existingFeeds} already existed`;

      toast({
        title: "State Discovery Complete",
        description: description,
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
    setSelectedLocations([]); // Clear selected locations as well
  };

  const handleReloadEvents = async () => {
    if (!selectedLocations.length) return;

    setIsLoading(true);
    try {
      // Filter events for selected locations
      const response = await apiRequest("/api/events/filter", {
        method: "POST",
        body: JSON.stringify({
          locations: selectedLocations
        }),
      });

      const events = await response.json();
      queryClient.setQueryData(['events'], events);

      if (events.length === 0) {
        // Try to discover and add feeds for locations that have no events
        for (const location of selectedLocations) {
          const [city, state] = location.split(', ');
          if (city && state) {
            console.log(`No events found for ${location}, attempting to discover feeds...`);
            try {
              await apiRequest("/api/discover-feeds", {
                method: "POST",
                body: JSON.stringify({ city: city.trim(), state: state.trim() }),
              });
            } catch (discoverError) {
              console.warn(`Failed to discover feeds for ${location}:`, discoverError);
            }
          }
        }
      }

    } catch (error) {
      console.error("Failed to reload events:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScrapeFeeds = async () => {
    if (!selectedLocations.length) return;

    setIsLoading(true);
    try {
      for (const location of selectedLocations) {
        const [city, state] = location.split(', ');
        if (city && state) {
          console.log(`Force scraping feeds for ${location}...`);
          try {
            const response = await apiRequest("/api/scrape-location-feeds", {
              method: "POST",
              body: JSON.stringify({ city: city.trim(), state: state.trim() }),
            });

            const result = await response.json();
            console.log(`Scraped ${result.eventCount} events from ${result.sources?.length || 0} sources for ${location}`);
          } catch (scrapeError) {
            console.warn(`Failed to scrape feeds for ${location}:`, scrapeError);
          }
        }
      }

      // After scraping, reload the events
      await handleReloadEvents();

    } catch (error) {
      console.error("Failed to scrape feeds:", error);
    } finally {
      setIsLoading(false);
    }
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
              <Label className="text-sm font-medium text-gray-900">
                City <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  placeholder="Type city name (e.g., Austin, TX)..."
                  className="pl-10 pr-10 h-10 border-2 border-primary/20 focus:border-primary"
                  value={localFilters.location || ""}
                  onChange={(e) => handleLocationChange(e.target.value)}
                  onFocus={() => {
                    if (citySuggestions.length > 0) {
                      setShowSuggestions(true);
                    }
                  }}
                  onBlur={() => {
                    // Delay hiding suggestions to allow clicking on them
                    setTimeout(() => setShowSuggestions(false), 150);
                  }}
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
                  <DialogContent className="max-w-5xl max-h-[90vh]" aria-describedby="map-description">
                    <DialogHeader>
                      <DialogTitle>Select Location on Map</DialogTitle>
                      <p id="map-description" className="text-sm text-muted-foreground">
                        Click anywhere on the map or click on city markers to select a location. You can zoom and pan to explore different areas.
                      </p>
                    </DialogHeader>

                    <div className="space-y-4">
                      {/* Interactive Map */}
                      <div className="h-[500px] relative overflow-hidden">
                        <MapSelector
                          onLocationSelect={(city, state, coordinates) => {
                            const locationString = `${city}, ${state}`;
                            setLocalFilters(prev => ({ ...prev, location: locationString }));
                            setMapOpen(false);

                            // Trigger discovery for selected location
                            handleLocationChange(locationString);
                          }}
                          selectedLocation={localFilters.location}
                        />
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                {showSuggestions && citySuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {citySuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                        onClick={() => handleSuggestionClick(suggestion)}
                      >
                        <div className="flex items-center space-x-2">
                          <MapPin size={14} className="text-gray-400" />
                          <span>{suggestion}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500 leading-relaxed">
            <span className="text-red-500">*</span> Location is required to view events.
            Start typing a city name or click the map icon to select on an interactive map.
          </p>
        </div>

        {/* Quick Discovery Actions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Quick Discovery</Label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => discoverTopCitiesMutation.mutate(20)}
              disabled={discoverTopCitiesMutation.isPending}
              className="text-xs"
            >
              {discoverTopCitiesMutation.isPending ? 'Finding...' : 'Top 20 Cities'}
            </Button>

            {['CA', 'TX', 'NY', 'FL', 'IL'].map(state => (
              <Button
                key={state}
                variant="outline"
                size="sm"
                onClick={() => discoverStateFeedsMutation.mutate(state)}
                disabled={discoverStateFeedsMutation.isPending}
                className="text-xs"
              >
                {discoverStateFeedsMutation.isPending ? 'Finding...' : state}
              </Button>
            ))}
          </div>
        </div>

        {/* Action Buttons: Reload Events and Force Scrape Feeds */}
        <div className="pt-4 border-t">
          <Button
            onClick={handleReloadEvents}
            disabled={isLoading || !selectedLocations.length}
            className="w-full mb-2"
          >
            {isLoading ? "Loading..." : "Reload Events"}
          </Button>

          {selectedLocations.length > 0 && (
            <Button
              onClick={handleScrapeFeeds}
              disabled={isLoading}
              variant="outline"
              className="w-full"
            >
              {isLoading ? "Scraping..." : "Force Scrape Feeds"}
            </Button>
          )}
        </div>

        {/* Clear Filters */}
        <div className="pt-4 border-t">
          <Button variant="outline" onClick={clearFilters} className="w-full">
            Clear All Filters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}