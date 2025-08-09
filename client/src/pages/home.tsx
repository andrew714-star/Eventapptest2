import { useState } from "react";
import { Header } from "@/components/header";
import { FilterSidebar } from "@/components/filter-sidebar";
import { Calendar } from "@/components/calendar";
import { EventModal } from "@/components/event-modal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Event, EventFilter } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, School, Globe, BookOpen, MapPin, X, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [filters, setFilters] = useState<EventFilter>({});
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [currentView, setCurrentView] = useState<"calendar" | "list">("calendar");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events/filter", filters.location, filters.locations],
    queryFn: async () => {
      // Only fetch events if location(s) are provided
      const hasLocation = filters.location && filters.location.trim() !== '';
      const hasLocations = filters.locations && filters.locations.length > 0;
      if (!hasLocation && !hasLocations) {
        return [];
      }
      const response = await apiRequest("POST", "/api/events/filter", filters);
      return response.json();
    },
    enabled: !!(filters.location && filters.location.trim() !== '') || !!(filters.locations && filters.locations.length > 0), // Only run query if location exists
  });

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedEvent(null);
  };

  const handleFilterChange = (newFilters: EventFilter) => {
    setFilters(newFilters);
  };

  const handleRemoveLocation = (locationToRemove: string) => {
    const updatedLocations = filters.locations?.filter(loc => loc !== locationToRemove) || [];
    
    if (updatedLocations.length === 0) {
      // If no locations left, clear both location and locations
      setFilters({ ...filters, location: '', locations: [] });
    } else if (filters.location === locationToRemove) {
      // If removing the current primary location, set the first remaining as primary
      setFilters({ ...filters, location: updatedLocations[0], locations: updatedLocations });
    } else {
      setFilters({ ...filters, locations: updatedLocations });
    }
  };

  // Reload events for selected locations
  const reloadEventsMutation = useMutation({
    mutationFn: async () => {
      const locations = [];
      if (filters.location && filters.location.trim() !== '') {
        locations.push(filters.location);
      }
      if (filters.locations && filters.locations.length > 0) {
        locations.push(...filters.locations);
      }
      
      if (locations.length === 0) {
        throw new Error('No locations selected');
      }

      // Sync events for these specific locations
      const response = await fetch('/api/sync-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locations })
      });

      if (!response.ok) {
        throw new Error('Failed to reload events');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch events
      queryClient.invalidateQueries({ queryKey: ["/api/events/filter"] });
      
      toast({
        title: "Events Reloaded",
        description: "Events have been refreshed for your selected locations.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Reload Failed",
        description: error.message || "Could not reload events. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getSourceIcon = (source: string) => {
    if (source.includes('city') || source.includes('parks')) {
      return <Building2 className="text-blue-600" size={14} />;
    }
    if (source.includes('school')) {
      return <School className="text-green-600" size={14} />;
    }
    if (source.includes('chamber')) {
      return <Globe className="text-purple-600" size={14} />;
    }
    if (source.includes('library') || source.includes('community')) {
      return <BookOpen className="text-orange-600" size={14} />;
    }
    return <Globe className="text-gray-600" size={14} />;
  };

  const getSourceLabel = (source: string) => {
    if (source.includes('city')) return 'City';
    if (source.includes('school')) return 'School';
    if (source.includes('chamber')) return 'Chamber';
    if (source.includes('library')) return 'Library';
    if (source.includes('community')) return 'Community';
    return 'Other';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="lg:grid lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-3 mb-6 lg:mb-0">
            <FilterSidebar filters={filters} onFiltersChange={handleFilterChange} />
          </div>

          <div className="lg:col-span-9">
            {/* View Toggle & Stats */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-600">
                        {(filters.location && filters.location.trim() !== '') || (filters.locations && filters.locations.length > 0) ? `Showing ${events.length} events` : 'Select a location to view events'}
                      </span>
                      {((filters.location && filters.location.trim() !== '') || (filters.locations && filters.locations.length > 0)) && (
                        <div className="flex items-center space-x-1">
                          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                          <span className="text-xs text-gray-500">Auto-synced from city, school & community sources</span>
                        </div>
                      )}
                    </div>
                    {/* Display selected locations */}
                    {filters.locations && filters.locations.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {filters.locations.map((location, index) => (
                          <Badge 
                            key={location} 
                            variant={location === filters.location ? "default" : "secondary"}
                            className="flex items-center gap-1"
                          >
                            <MapPin className="h-3 w-3" />
                            {location}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto p-0 ml-1 hover:bg-transparent"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveLocation(location);
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {/* Reload Events Button */}
                    {((filters.location && filters.location.trim() !== '') || (filters.locations && filters.locations.length > 0)) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => reloadEventsMutation.mutate()}
                        disabled={reloadEventsMutation.isPending}
                        className="flex items-center space-x-1"
                      >
                        <RefreshCw className={`h-4 w-4 ${reloadEventsMutation.isPending ? 'animate-spin' : ''}`} />
                        <span>{reloadEventsMutation.isPending ? 'Reloading...' : 'Reload Events'}</span>
                      </Button>
                    )}
                    
                    <div className="bg-gray-100 p-1 rounded-lg">
                      <Button
                        variant={currentView === "calendar" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setCurrentView("calendar")}
                      >
                        Calendar
                      </Button>
                      <Button
                        variant={currentView === "list" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setCurrentView("list")}
                      >
                        List
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {currentView === "calendar" ? (
              <div>
                {isLoading ? (
                  <Card className="mb-6">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-center h-32">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
                <Calendar 
                  events={events} 
                  onEventClick={handleEventClick}
                  selectedLocations={filters.locations}
                  onAddLocation={(location) => {
                    const existingLocations = filters.locations || [];
                    if (!existingLocations.includes(location)) {
                      setFilters({
                        ...filters,
                        location: location,
                        locations: [...existingLocations, location]
                      });
                    }
                  }}
                />
              </div>
            ) : (
              <div className="space-y-4">
                {(!filters.location || filters.location.trim() === '') && (!filters.locations || filters.locations.length === 0) ? (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex flex-col items-center justify-center h-64 text-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                          <MapPin className="text-gray-400" size={32} />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Location</h3>
                        <p className="text-gray-600 max-w-md">
                          Please choose a city from the sidebar to discover local events and activities.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : isLoading ? (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                      </div>
                    </CardContent>
                  </Card>
                ) : events.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex flex-col items-center justify-center h-64 text-center">
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Events Found</h3>
                        <p className="text-gray-600 max-w-md">
                          No events were found for this location. Try selecting a different city or check back later.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  events.map((event) => (
                    <Card key={event.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleEventClick(event)}>
                      <CardContent className="pt-6">
                        <div className="flex items-start space-x-4">
                          <div className="flex-shrink-0 w-16 text-center">
                            <div className="text-sm font-medium text-primary">
                              {event.startTime}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-2">
                              <h4 className="text-lg font-medium text-gray-900 truncate">
                                {event.title}
                              </h4>
                              <Badge variant="secondary">{event.category}</Badge>
                              <div className="flex items-center space-x-1 text-xs text-gray-500">
                                {getSourceIcon(event.source)}
                                <span>{getSourceLabel(event.source)}</span>
                              </div>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              {event.description}
                            </p>
                            <div className="flex items-center space-x-4 text-sm text-gray-500">
                              <span>{event.location}</span>
                              <span>{event.attendees} attending</span>
                              <span>{event.organizer}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <EventModal
        event={selectedEvent}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
}
