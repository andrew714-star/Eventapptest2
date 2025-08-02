import { useState } from "react";
import { Header } from "@/components/header";
import { FilterSidebar } from "@/components/filter-sidebar";
import { Calendar } from "@/components/calendar";
import { EventModal } from "@/components/event-modal";
import { useQuery } from "@tanstack/react-query";
import { Event, EventFilter } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  const [filters, setFilters] = useState<EventFilter>({});
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [currentView, setCurrentView] = useState<"calendar" | "list">("calendar");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events/filter"],
    queryFn: async () => {
      const response = await apiRequest("POST", "/api/events/filter", filters);
      return response.json();
    },
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
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-600">
                      Showing {events.length} events
                    </span>
                    <div className="flex items-center space-x-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      <span className="text-xs text-gray-500">Live updates</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
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

            {isLoading ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                  </div>
                </CardContent>
              </Card>
            ) : currentView === "calendar" ? (
              <Calendar events={events} onEventClick={handleEventClick} />
            ) : (
              <div className="space-y-4">
                {events.map((event) => (
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
                ))}
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
