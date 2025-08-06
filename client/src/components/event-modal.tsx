import { X, Calendar, Clock, MapPin, Building, Share, Heart, CalendarPlus, Building2, School, Globe, BookOpen, Database } from "lucide-react";
import { Event } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface EventModalProps {
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EventModal({ event, isOpen, onClose }: EventModalProps) {
  if (!event) return null;

  const eventDate = new Date(event.startDate);

  const getSourceIcon = (source: string) => {
    if (source.includes('city') || source.includes('parks')) {
      return <Building2 className="text-blue-600" size={16} />;
    }
    if (source.includes('school')) {
      return <School className="text-green-600" size={16} />;
    }
    if (source.includes('chamber')) {
      return <Globe className="text-purple-600" size={16} />;
    }
    if (source.includes('library') || source.includes('community')) {
      return <BookOpen className="text-orange-600" size={16} />;
    }
    return <Database className="text-gray-600" size={16} />;
  };

  const getSourceLabel = (source: string) => {
    if (source.includes('city')) return 'City Government';
    if (source.includes('parks')) return 'Parks & Recreation';
    if (source.includes('school')) return 'School District';
    if (source.includes('chamber')) return 'Chamber of Commerce';
    if (source.includes('library')) return 'Library System';
    if (source.includes('community')) return 'Community Organization';
    return 'Data Source';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="event-description">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">
            {event.title}
          </DialogTitle>

        </DialogHeader>

        <div id="event-description" className="space-y-4">
          {/* Event Image */}
          {event.imageUrl && (
            <img
              src={event.imageUrl}
              alt={event.title}
              className="w-full h-48 object-cover rounded-lg"
            />
          )}

          {/* Event Tags */}
          <div className="flex items-center space-x-2 flex-wrap gap-2">
            <Badge variant="secondary">{event.category}</Badge>
            <Badge variant={event.isFree === "true" ? "default" : "outline"}>
              {event.isFree === "true" ? "Free" : "Paid"}
            </Badge>
            <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md">
              {getSourceIcon(event.source)}
              <span className="text-xs text-gray-600 dark:text-gray-300">{getSourceLabel(event.source)}</span>
            </div>
          </div>

          {/* Event Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-3">
              <Calendar className="text-primary" size={20} />
              <span className="text-gray-700">
                {format(eventDate, "MMMM d, yyyy")}
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <Clock className="text-primary" size={20} />
              <span className="text-gray-700">
                {event.startTime} - {event.endTime}
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <MapPin className="text-primary" size={20} />
              <span className="text-gray-700">{event.location}</span>
            </div>
            <div className="flex items-center space-x-3">
              <Building className="text-primary" size={20} />
              <span className="text-gray-700">{event.organizer}</span>
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Description</h3>
            <p className="text-gray-700 leading-relaxed">{event.description}</p>
          </div>

          {/* Attendees */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Attendees</h3>
            <div className="flex items-center space-x-2">
              <span className="text-gray-700">{event.attendees} people attending</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3 pt-4 border-t border-gray-200">
            <Button className="flex-1">
              <CalendarPlus className="mr-2" size={16} />
              Add to Calendar
            </Button>
            <Button variant="outline" size="icon">
              <Share size={16} />
            </Button>
            <Button variant="outline" size="icon">
              <Heart size={16} />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}