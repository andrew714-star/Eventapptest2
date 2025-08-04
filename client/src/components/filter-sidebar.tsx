
import { useState, useEffect, useRef } from "react";
import { Search, Map, Pencil, Square, ZoomIn, ZoomOut, Move } from "lucide-react";
import { EventFilter, categories } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

// US States with accurate geographic paths (simplified)
const US_STATES = [
  { name: "Alabama", path: "M580 380 L620 390 L630 420 L610 450 L580 440 L570 410 Z" },
  { name: "Alaska", path: "M80 450 L150 450 L170 480 L160 520 L90 510 L70 480 Z" },
  { name: "Arizona", path: "M200 350 L280 360 L290 420 L210 410 Z" },
  { name: "Arkansas", path: "M480 320 L540 330 L550 370 L490 360 Z" },
  { name: "California", path: "M50 200 L120 210 L140 350 L100 400 L60 380 L40 250 Z" },
  { name: "Colorado", path: "M320 250 L400 260 L410 320 L330 310 Z" },
  { name: "Connecticut", path: "M740 180 L780 185 L785 205 L745 200 Z" },
  { name: "Delaware", path: "M720 220 L735 225 L730 245 L715 240 Z" },
  { name: "Florida", path: "M620 420 L680 430 L720 460 L710 520 L650 500 L610 460 Z" },
  { name: "Georgia", path: "M600 350 L650 360 L660 420 L610 410 Z" },
  { name: "Hawaii", path: "M200 480 L250 485 L255 505 L205 500 Z" },
  { name: "Idaho", path: "M240 120 L300 130 L310 200 L250 190 Z" },
  { name: "Illinois", path: "M500 200 L550 210 L560 280 L510 270 Z" },
  { name: "Indiana", path: "M550 200 L590 210 L600 270 L560 260 Z" },
  { name: "Iowa", path: "M450 200 L500 210 L510 260 L460 250 Z" },
  { name: "Kansas", path: "M380 260 L450 270 L460 320 L390 310 Z" },
  { name: "Kentucky", path: "M550 270 L620 280 L630 320 L560 310 Z" },
  { name: "Louisiana", path: "M480 370 L540 380 L550 420 L490 410 Z" },
  { name: "Maine", path: "M760 100 L800 105 L810 160 L770 155 Z" },
  { name: "Maryland", path: "M680 220 L720 225 L725 250 L685 245 Z" },
  { name: "Massachusetts", path: "M720 170 L770 175 L775 195 L725 190 Z" },
  { name: "Michigan", path: "M550 160 L600 170 L610 220 L560 210 Z" },
  { name: "Minnesota", path: "M450 140 L500 150 L510 200 L460 190 Z" },
  { name: "Mississippi", path: "M520 350 L570 360 L580 410 L530 400 Z" },
  { name: "Missouri", path: "M450 250 L500 260 L510 320 L460 310 Z" },
  { name: "Montana", path: "M300 100 L400 110 L410 170 L310 160 Z" },
  { name: "Nebraska", path: "M380 200 L450 210 L460 260 L390 250 Z" },
  { name: "Nevada", path: "M150 200 L220 210 L230 320 L160 310 Z" },
  { name: "New Hampshire", path: "M740 140 L770 145 L775 180 L745 175 Z" },
  { name: "New Jersey", path: "M700 200 L730 205 L735 240 L705 235 Z" },
  { name: "New Mexico", path: "M280 300 L350 310 L360 380 L290 370 Z" },
  { name: "New York", path: "M680 140 L740 150 L750 200 L690 190 Z" },
  { name: "North Carolina", path: "M620 280 L690 290 L700 330 L630 320 Z" },
  { name: "North Dakota", path: "M380 100 L450 110 L460 160 L390 150 Z" },
  { name: "Ohio", path: "M590 200 L640 210 L650 270 L600 260 Z" },
  { name: "Oklahoma", path: "M380 300 L480 310 L490 360 L390 350 Z" },
  { name: "Oregon", path: "M80 150 L150 160 L160 220 L90 210 Z" },
  { name: "Pennsylvania", path: "M640 180 L700 190 L710 240 L650 230 Z" },
  { name: "Rhode Island", path: "M760 180 L775 185 L780 200 L765 195 Z" },
  { name: "South Carolina", path: "M640 320 L680 330 L690 370 L650 360 Z" },
  { name: "South Dakota", path: "M380 150 L450 160 L460 210 L390 200 Z" },
  { name: "Tennessee", path: "M520 280 L620 290 L630 330 L530 320 Z" },
  { name: "Texas", path: "M320 350 L480 360 L490 460 L330 450 Z" },
  { name: "Utah", path: "M240 220 L320 230 L330 320 L250 310 Z" },
  { name: "Vermont", path: "M720 140 L745 145 L750 180 L725 175 Z" },
  { name: "Virginia", path: "M630 240 L690 250 L700 290 L640 280 Z" },
  { name: "Washington", path: "M80 80 L150 90 L160 150 L90 140 Z" },
  { name: "West Virginia", path: "M610 220 L660 230 L670 280 L620 270 Z" },
  { name: "Wisconsin", path: "M500 140 L550 150 L560 210 L510 200 Z" },
  { name: "Wyoming", path: "M300 170 L380 180 L390 240 L310 230 Z" }
];

interface USMapWithDrawingProps {
  selectedRegions: string[];
  onRegionChange: (regions: string[]) => void;
}

function USMapWithDrawing({ selectedRegions, onRegionChange }: USMapWithDrawingProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [drawMode, setDrawMode] = useState<'select' | 'draw' | 'pan'>('select');
  const [currentPath, setCurrentPath] = useState<string>("");
  const [drawnPaths, setDrawnPaths] = useState<string[]>([]);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [lastPanPoint, setLastPanPoint] = useState<{ x: number; y: number } | null>(null);

  const handleStateClick = (stateName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (drawMode === 'select') {
      if (selectedRegions.includes(stateName)) {
        onRegionChange(selectedRegions.filter(r => r !== stateName));
      } else {
        onRegionChange([...selectedRegions, stateName]);
      }
    }
  };

  const getMousePosition = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    
    const x = ((e.clientX - rect.left) / rect.width) * 1000 / zoom - panX;
    const y = ((e.clientY - rect.top) / rect.height) * 600 / zoom - panY;
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    const pos = getMousePosition(e);
    
    if (drawMode === 'draw') {
      setIsDrawing(true);
      setCurrentPath(`M${pos.x},${pos.y}`);
    } else if (drawMode === 'pan') {
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDrawing && drawMode === 'draw') {
      const pos = getMousePosition(e);
      setCurrentPath(prev => `${prev} L${pos.x},${pos.y}`);
    } else if (isPanning && drawMode === 'pan' && lastPanPoint) {
      const deltaX = e.clientX - lastPanPoint.x;
      const deltaY = e.clientY - lastPanPoint.y;
      
      setPanX(prev => prev + deltaX / zoom);
      setPanY(prev => prev + deltaY / zoom);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    if (isDrawing && drawMode === 'draw') {
      setIsDrawing(false);
      if (currentPath) {
        const closedPath = currentPath + " Z";
        setDrawnPaths(prev => [...prev, closedPath]);
        
        // Find states that intersect with drawn path
        const intersectingStates = US_STATES.filter(state => {
          return isStateIntersectingPath(state, closedPath);
        });
        
        const newSelectedRegions = [...new Set([...selectedRegions, ...intersectingStates.map(s => s.name)])];
        onRegionChange(newSelectedRegions);
        setCurrentPath("");
      }
    } else if (isPanning) {
      setIsPanning(false);
      setLastPanPoint(null);
    }
  };

  const isStateIntersectingPath = (state: any, drawnPath: string): boolean => {
    // Simple bounding box intersection for demo
    // In production, you'd use proper polygon intersection algorithms
    const pathData = state.path.match(/M(\d+)\s(\d+).*?(\d+)\s(\d+)/);
    const drawnData = drawnPath.match(/M(\d+\.?\d*),(\d+\.?\d*).*?(\d+\.?\d*),(\d+\.?\d*)/);
    
    if (!pathData || !drawnData) return false;
    
    const stateX = parseInt(pathData[1]);
    const stateY = parseInt(pathData[2]);
    const drawnX = parseFloat(drawnData[1]);
    const drawnY = parseFloat(drawnData[2]);
    
    // Simple distance-based intersection
    const distance = Math.sqrt(Math.pow(stateX - drawnX, 2) + Math.pow(stateY - drawnY, 2));
    return distance < 100; // Threshold for intersection
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.5, 5));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.5, 0.5));
  };

  const resetView = () => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  };

  const clearDrawing = () => {
    setDrawnPaths([]);
    onRegionChange([]);
  };

  const getCursor = () => {
    switch (drawMode) {
      case 'draw': return 'crosshair';
      case 'pan': return isPanning ? 'grabbing' : 'grab';
      default: return 'default';
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Map Controls */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-2">
        {/* Drawing Controls */}
        <div className="flex gap-2 bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-md">
          <Button
            size="sm"
            variant={drawMode === 'select' ? 'default' : 'outline'}
            onClick={() => setDrawMode('select')}
          >
            <Square className="h-4 w-4 mr-1" />
            Select
          </Button>
          <Button
            size="sm"
            variant={drawMode === 'draw' ? 'default' : 'outline'}
            onClick={() => setDrawMode('draw')}
          >
            <Pencil className="h-4 w-4 mr-1" />
            Draw
          </Button>
          <Button
            size="sm"
            variant={drawMode === 'pan' ? 'default' : 'outline'}
            onClick={() => setDrawMode('pan')}
          >
            <Move className="h-4 w-4 mr-1" />
            Pan
          </Button>
        </div>

        {/* Zoom Controls */}
        <div className="flex flex-col gap-1 bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-md">
          <Button
            size="sm"
            variant="outline"
            onClick={handleZoomIn}
            disabled={zoom >= 5}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <div className="text-xs text-center px-2 py-1 text-gray-600">
            {Math.round(zoom * 100)}%
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
        </div>

        {/* Reset and Clear */}
        <div className="flex flex-col gap-1 bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-md">
          <Button
            size="sm"
            variant="outline"
            onClick={resetView}
          >
            Reset View
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={clearDrawing}
            disabled={drawnPaths.length === 0 && selectedRegions.length === 0}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Map */}
      <div className="overflow-hidden rounded-lg border">
        <svg
          ref={svgRef}
          viewBox="0 0 1000 600"
          className="w-full h-full"
          style={{ 
            cursor: getCursor(),
            transform: `scale(${zoom}) translate(${panX}px, ${panY}px)`,
            transformOrigin: 'center'
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            setIsDrawing(false);
            setIsPanning(false);
            setLastPanPoint(null);
          }}
        >
          {/* Background */}
          <rect width="1000" height="600" fill="#f0f9ff" />

          {/* US States */}
          {US_STATES.map((state) => (
            <path
              key={state.name}
              d={state.path}
              fill={selectedRegions.includes(state.name) ? "#3b82f6" : "#e5e7eb"}
              stroke="#9ca3af"
              strokeWidth="1"
              className={`transition-colors ${
                drawMode === 'select' 
                  ? 'cursor-pointer hover:fill-blue-200' 
                  : 'pointer-events-none'
              }`}
              onClick={(e) => handleStateClick(state.name, e)}
            />
          ))}

          {/* State Labels */}
          {zoom > 0.8 && US_STATES.map((state) => {
            const pathData = state.path.match(/M(\d+)\s(\d+)/);
            if (pathData) {
              const x = parseInt(pathData[1]) + 30;
              const y = parseInt(pathData[2]) + 20;
              return (
                <text
                  key={`${state.name}-label`}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  className="text-xs font-medium pointer-events-none select-none"
                  fill={selectedRegions.includes(state.name) ? "white" : "#374151"}
                  style={{ fontSize: Math.max(10, 12 / zoom) }}
                >
                  {zoom > 1.5 ? state.name : state.name.substring(0, 2)}
                </text>
              );
            }
            return null;
          })}

          {/* Drawn Paths */}
          {drawnPaths.map((path, index) => (
            <path
              key={`drawn-${index}`}
              d={path}
              fill="rgba(59, 130, 246, 0.3)"
              stroke="#3b82f6"
              strokeWidth={2 / zoom}
              strokeDasharray={`${5 / zoom},${5 / zoom}`}
              className="pointer-events-none"
            />
          ))}

          {/* Current Drawing Path */}
          {currentPath && (
            <path
              d={currentPath}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={2 / zoom}
              strokeDasharray={`${5 / zoom},${5 / zoom}`}
              className="pointer-events-none"
            />
          )}
        </svg>
      </div>

      {/* Drawing Instructions */}
      <div className="absolute bottom-2 left-2 z-10 bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-md text-xs text-gray-600 max-w-xs">
        {drawMode === 'select' && 'Click states to select them'}
        {drawMode === 'draw' && 'Click and drag to draw a selection area'}
        {drawMode === 'pan' && 'Click and drag to pan around the map'}
      </div>

      {/* Zoom Level Display */}
      <div className="absolute bottom-2 right-2 z-10 bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-md text-xs text-gray-600">
        Zoom: {Math.round(zoom * 100)}%
      </div>
    </div>
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
                  <DialogContent className="max-w-5xl max-h-[90vh]">
                    <DialogHeader>
                      <DialogTitle>Interactive Regional Map</DialogTitle>
                      <p className="text-sm text-muted-foreground">
                        Use zoom, pan, and drawing tools to select specific areas. Events from cities, school districts, and chambers of commerce in selected areas will be added.
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

        <Button variant="outline" className="w-full" onClick={clearFilters}>
          Clear All Filters
        </Button>
      </CardContent>
    </Card>
  );
}
