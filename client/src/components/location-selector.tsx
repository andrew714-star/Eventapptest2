import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { MapPin, Search, Plus, CheckCircle, Clock, AlertTriangle, Building, GraduationCap, Briefcase } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CalendarSource {
  id: string;
  name: string;
  city: string;
  state: string;
  type: 'city' | 'school' | 'chamber' | 'library' | 'parks';
  feedUrl?: string;
  websiteUrl?: string;
  isActive: boolean;
  feedType: 'ical' | 'rss' | 'webcal' | 'json' | 'html';
}

interface DiscoveredFeed {
  source: CalendarSource;
  confidence: number;
  lastChecked: Date;
}

interface DiscoveryResponse {
  location: { city: string; state: string };
  discoveredFeeds: DiscoveredFeed[];
  count: number;
  timestamp: string;
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'city': return <Building className="h-4 w-4" />;
    case 'school': return <GraduationCap className="h-4 w-4" />;
    case 'chamber': return <Briefcase className="h-4 w-4" />;
    default: return <Building className="h-4 w-4" />;
  }
};

const getConfidenceColor = (confidence: number) => {
  if (confidence >= 0.8) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
  if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
};

const getConfidenceLabel = (confidence: number) => {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.6) return 'Medium';
  return 'Low';
};

export function LocationSelector() {
  const [open, setOpen] = useState(false);
  const [searchLocation, setSearchLocation] = useState('');
  const [discoveredFeeds, setDiscoveredFeeds] = useState<DiscoveredFeed[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [addedFeeds, setAddedFeeds] = useState<Set<string>>(new Set());
  
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
    onSuccess: (data) => {
      setDiscoveredFeeds(data.discoveredFeeds);
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
  const addFeedMutation = useMutation({
    mutationFn: async (source: CalendarSource) => {
      const response = await fetch('/api/add-discovered-feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: { ...source, isActive: true } })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to add feed' }));
        const error = Object.assign(new Error(errorData.message || 'Failed to add feed'), {
          status: response.status,
          errorData: errorData
        });
        throw error;
      }
      
      return response.json();
    },
    onSuccess: (_, source) => {
      setAddedFeeds(prev => new Set(prev).add(source.id));
      queryClient.invalidateQueries({ queryKey: ['/api/calendar-sources'] });
      queryClient.invalidateQueries({ queryKey: ['/api/events/filter'] });
      
      toast({
        title: "Feed Added",
        description: `${source.name} has been added and will start collecting events automatically.`,
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
      
      // If it already exists, mark it as added in the UI
      if (isAlreadyExists && error.errorData?.existingSource) {
        setAddedFeeds(prev => new Set(prev).add(error.errorData.existingSource.id));
      }
    },
  });

  const handleSearch = async () => {
    const location = searchLocation.trim();
    if (!location) return;

    // Parse location (expecting "City, State" or "City, ST")
    const parts = location.split(',').map(p => p.trim());
    if (parts.length !== 2) {
      toast({
        title: "Invalid Format",
        description: "Please enter location as 'City, State' (e.g., 'Portland, Oregon' or 'Austin, TX')",
        variant: "destructive",
      });
      return;
    }

    const [city, state] = parts;
    setIsDiscovering(true);
    setDiscoveredFeeds([]);
    setAddedFeeds(new Set());

    discoverFeedsMutation.mutate({ city, state }, {
      onSuccess: async (data) => {
        // Automatically add the discovered feeds
        const addResults = [];
        
        // Process feeds one by one to handle errors gracefully
        for (const feed of data.discoveredFeeds) {
          try {
            // Create a direct fetch call instead of using the mutation to avoid unhandled promise rejections
            const response = await fetch('/api/add-discovered-feed', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ source: { ...feed.source, isActive: true } })
            });
            
            if (response.ok) {
              addResults.push({ feed: feed.source, success: true });
              setAddedFeeds(prev => new Set(prev).add(feed.source.id));
              // Invalidate queries for successful additions
              queryClient.invalidateQueries({ queryKey: ['/api/calendar-sources'] });
              queryClient.invalidateQueries({ queryKey: ['/api/events/filter'] });
            } else if (response.status === 409) {
              // Feed already exists
              const errorData = await response.json().catch(() => ({}));
              addResults.push({ 
                feed: feed.source, 
                success: false, 
                alreadyExists: true 
              });
              
              // Mark as added in UI since it already exists
              if (errorData.existingSource?.id) {
                setAddedFeeds(prev => new Set(prev).add(errorData.existingSource.id));
              } else {
                setAddedFeeds(prev => new Set(prev).add(feed.source.id));
              }
            } else {
              // Other error
              addResults.push({ 
                feed: feed.source, 
                success: false, 
                alreadyExists: false 
              });
            }
          } catch (error) {
            console.warn('Error adding feed:', error);
            addResults.push({ 
              feed: feed.source, 
              success: false, 
              alreadyExists: false 
            });
          }
        }
        
        setDiscoveredFeeds(data.discoveredFeeds);
        
        const newFeeds = addResults.filter(r => r.success).length;
        const existingFeeds = addResults.filter(r => r.alreadyExists).length;
        const failedFeeds = addResults.filter(r => !r.success && !r.alreadyExists).length;
        
        let description = `Found ${data.count} potential calendar feeds`;
        if (newFeeds > 0) description += `, added ${newFeeds} new feeds`;
        if (existingFeeds > 0) description += `, ${existingFeeds} already existed`;
        if (failedFeeds > 0) description += `, ${failedFeeds} failed to add`;
        
        toast({
          title: "Feed Discovery Complete",
          description: description,
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
  };

  const handleAddFeed = async (feed: DiscoveredFeed) => {
    try {
      const response = await fetch('/api/add-discovered-feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: { ...feed.source, isActive: true } })
      });
      
      if (response.ok) {
        setAddedFeeds(prev => new Set(prev).add(feed.source.id));
        queryClient.invalidateQueries({ queryKey: ['/api/calendar-sources'] });
        queryClient.invalidateQueries({ queryKey: ['/api/events/filter'] });
        
        toast({
          title: "Feed Added",
          description: `${feed.source.name} has been added and will start collecting events automatically.`,
        });
      } else if (response.status === 409) {
        const errorData = await response.json().catch(() => ({}));
        
        // Mark as added in UI since it already exists
        if (errorData.existingSource?.id) {
          setAddedFeeds(prev => new Set(prev).add(errorData.existingSource.id));
        } else {
          setAddedFeeds(prev => new Set(prev).add(feed.source.id));
        }
        
        toast({
          title: "Feed Already Exists",
          description: errorData.message || "This calendar feed has already been added.",
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast({
          title: "Failed to Add Feed",
          description: errorData.message || "Could not add this calendar feed. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error adding feed:', error);
      toast({
        title: "Failed to Add Feed",
        description: "Could not add this calendar feed. Please check your connection and try again.",
        variant: "destructive",
      });
    }
  };

  const popularLocations = [
    { city: 'Portland', state: 'Oregon' },
    { city: 'Austin', state: 'Texas' },
    { city: 'Denver', state: 'Colorado' },
    { city: 'Nashville', state: 'Tennessee' },
    { city: 'Raleigh', state: 'North Carolina' },
    { city: 'Madison', state: 'Wisconsin' },
    { city: 'Boulder', state: 'Colorado' },
    { city: 'Ann Arbor', state: 'Michigan' }
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MapPin className="h-4 w-4 mr-2" />
          Add Location
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto overflow-hidden">
        <DialogHeader>
          <DialogTitle>Discover Local Government Feeds</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Enter any US city to automatically discover and add their official calendar feeds from city government, schools, and chamber of commerce.
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Search Section */}
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter city and state (e.g., Portland, Oregon or Austin, TX)"
                value={searchLocation}
                onChange={(e) => setSearchLocation(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button 
                onClick={handleSearch}
                disabled={discoverFeedsMutation.isPending || !searchLocation.trim()}
              >
                <Search className="h-4 w-4 mr-2" />
                {discoverFeedsMutation.isPending ? 'Discovering...' : 'Discover'}
              </Button>
            </div>

            {/* Popular Locations */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">Popular locations:</p>
              <div className="flex flex-wrap gap-2">
                {popularLocations.map((location) => (
                  <Button
                    key={`${location.city}-${location.state}`}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchLocation(`${location.city}, ${location.state}`);
                      setIsDiscovering(true);
                      setDiscoveredFeeds([]);
                      setAddedFeeds(new Set());
                      discoverFeedsMutation.mutate(location);
                    }}
                    disabled={discoverFeedsMutation.isPending}
                  >
                    {location.city}, {location.state}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <Separator />

          {/* Results Section */}
          {discoverFeedsMutation.isPending && (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 animate-spin" />
                <div className="text-sm">Discovering government calendar feeds...</div>
              </div>
            </div>
          )}

          {discoveredFeeds.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Discovered Calendar Feeds</h3>
                <Badge variant="secondary">{discoveredFeeds.length} found</Badge>
              </div>

              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {discoveredFeeds.map((feed) => {
                    const isAdded = addedFeeds.has(feed.source.id);
                    
                    return (
                      <Card key={feed.source.id} className="relative">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className="mt-1">
                                {getTypeIcon(feed.source.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-base truncate">
                                  {feed.source.name}
                                </CardTitle>
                                <CardDescription className="flex items-center gap-1 mt-1">
                                  <MapPin className="h-3 w-3" />
                                  {feed.source.city}, {feed.source.state}
                                </CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={getConfidenceColor(feed.confidence)} variant="secondary">
                                {getConfidenceLabel(feed.confidence)}
                              </Badge>
                              {isAdded ? (
                                <Badge variant="default" className="bg-green-600">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Added
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => handleAddFeed(feed)}
                                  disabled={addFeedMutation.isPending}
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Add
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-2">
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <div>Feed Type: {feed.source.feedType.toUpperCase()}</div>
                              <div>Confidence: {Math.round(feed.confidence * 100)}%</div>
                              <div>Type: {feed.source.type}</div>
                            </div>
                            {feed.source.feedUrl && (
                              <div className="text-xs text-muted-foreground truncate">
                                URL: {feed.source.feedUrl}
                              </div>
                            )}
                            {feed.confidence < 0.6 && (
                              <div className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                                <AlertTriangle className="h-3 w-3" />
                                This feed may not be reliable or may not contain events
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          {discoveredFeeds.length === 0 && !discoverFeedsMutation.isPending && discoverFeedsMutation.isError && (
            <div className="text-center py-8">
              <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No calendar feeds found for this location. Try another city or check the spelling.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}