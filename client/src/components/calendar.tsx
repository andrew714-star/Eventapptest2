import { useMemo, useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, MapPin, Plus, Search } from "lucide-react";
import { Event } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface CalendarProps {
  events: Event[];
  onEventClick: (event: Event) => void;
  selectedLocations?: string[];
  onAddLocation?: (location: string) => void;
}

export function Calendar({ events = [], onEventClick, selectedLocations = [], onAddLocation }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCitySelector, setShowCitySelector] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate]);
  const monthEnd = useMemo(() => endOfMonth(monthStart), [monthStart]);
  const startDate = useMemo(() => startOfWeek(monthStart), [monthStart]);
  const endDate = useMemo(() => endOfWeek(monthEnd), [monthEnd]);

  const days = useMemo(() => {
    const allDays = [];
    let day = startDate;
    while (day <= endDate) {
      allDays.push(day);
      day = addDays(day, 1);
    }
    return allDays;
  }, [startDate, endDate]);

  const getEventsForDay = (day: Date) => {
    return events.filter((event) => isSameDay(new Date(event.startDate), day));
  };

  const getCategoryColor = (category: string) => {
    const colorMap: Record<string, string> = {
      "Music & Concerts": "event-red",
      "Sports & Recreation": "event-green",
      "Community & Social": "event-blue",
      "Education & Learning": "event-indigo",
      "Arts & Culture": "event-orange",
      "Food & Dining": "event-yellow",
    };
    return colorMap[category] || "event-default";
  };

  const selectedDateEvents = getEventsForDay(selectedDate);

  // Handle city search
  const handleCitySearch = (value: string) => {
    setCitySearch(value);
    
    if (value && value.length >= 2) {
      fetch(`/api/city-suggestions?q=${encodeURIComponent(value)}&limit=10`)
        .then(res => res.json())
        .then(data => {
          setCitySuggestions(data.suggestions || []);
        })
        .catch(err => console.error('Failed to fetch city suggestions:', err));
    } else {
      setCitySuggestions([]);
    }
  };

  // Handle adding a city
  const handleAddCity = async (cityName: string) => {
    if (onAddLocation) {
      onAddLocation(cityName);
      
      // Discover feeds for this city
      const parts = cityName.split(',').map(p => p.trim());
      if (parts.length === 2) {
        const [city, state] = parts;
        try {
          const response = await fetch('/api/discover-feeds', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ city, state })
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.count > 0) {
              toast({
                title: "Calendar Sources Found",
                description: `Found ${data.count} feeds for ${cityName}. Events will load automatically.`,
              });
            }
          }
        } catch (error) {
          console.error('Feed discovery failed:', error);
        }
      }
    }
    
    setCitySearch("");
    setCitySuggestions([]);
    setShowCitySelector(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-xl font-medium text-gray-900">
                {format(currentDate, "MMMM yyyy")}
              </h2>
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                >
                  <ChevronLeft size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
            
            {/* City Selector */}
            <div className="relative">
              {showCitySelector ? (
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <Input
                      placeholder="Add city (e.g., Austin, TX)"
                      value={citySearch}
                      onChange={(e) => handleCitySearch(e.target.value)}
                      className="w-64"
                      autoFocus
                    />
                    {citySuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                        {citySuggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                            onClick={() => handleAddCity(suggestion)}
                          >
                            <MapPin className="inline h-3 w-3 mr-2" />
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowCitySelector(false);
                      setCitySearch("");
                      setCitySuggestions([]);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCitySelector(true)}
                  className="flex items-center space-x-1"
                >
                  <Plus size={14} />
                  <span>Add City</span>
                </Button>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCurrentDate(new Date());
                setSelectedDate(new Date());
              }}
            >
              Today
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-px mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-px">
            {days.map((day, index) => {
              const dayEvents = getEventsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isSelected = isSameDay(day, selectedDate);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={index}
                  className={`min-h-[120px] p-1 border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${
                    !isCurrentMonth ? "bg-gray-50" : "bg-white"
                  } ${isSelected ? "bg-primary/20 border-primary" : ""} ${
                    isToday && !isSelected ? "bg-blue-50" : ""
                  }`}
                  onClick={() => setSelectedDate(day)}
                >
                  <span
                    className={`text-sm ${
                      !isCurrentMonth
                        ? "text-gray-400"
                        : isSelected
                        ? "text-primary font-medium"
                        : isToday
                        ? "text-primary font-medium"
                        : "text-gray-900"
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                  <div className="mt-1 space-y-1">
                    {dayEvents.slice(0, 2).map((event, eventIndex) => (
                      <div
                        key={event.id}
                        className={`text-xs px-1 py-0.5 rounded truncate cursor-pointer ${getCategoryColor(event.category)}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(event);
                        }}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-xs text-gray-500">
                        +{dayEvents.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected Date Events */}
      {selectedDateEvents.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-medium text-gray-900">
              Events for {format(selectedDate, "MMMM d, yyyy")}
            </h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {selectedDateEvents.map((event) => (
                <div
                  key={event.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => onEventClick(event)}
                >
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-16 text-center">
                      <div className="text-sm font-medium text-primary">
                        {event.startTime.split(" ")[0]}
                      </div>
                      <div className="text-xs text-gray-500">
                        {event.startTime.split(" ")[1]}
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
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
