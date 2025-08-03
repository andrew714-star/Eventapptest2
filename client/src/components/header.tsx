import { Calendar, Bell, Settings, Menu, Database, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { DataSourcesModal } from "@/components/data-sources-modal";
import { CalendarSourcesModal } from "@/components/calendar-sources-modal";
import { LocationSelector } from "@/components/location-selector";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function Header() {
  const [isDataSourcesOpen, setIsDataSourcesOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/sync-events", {});
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Events Synced",
        description: `Successfully synced ${data.syncedCount} new events from data sources.`,
      });
      // Invalidate events cache to refresh the display
      queryClient.invalidateQueries({ queryKey: ["/api/events/filter"] });
    },
    onError: () => {
      toast({
        title: "Sync Failed",
        description: "Failed to sync events from data sources. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSyncEvents = () => {
    syncMutation.mutate();
  };

  return (
    <>
      <header className="bg-white dark:bg-gray-900 shadow-md border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <Calendar className="text-white" size={20} />
                </div>
                <div>
                  <h1 className="text-xl font-medium text-gray-900 dark:text-white">CityWide Events</h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Real-time events from cities, schools & chambers nationwide</p>
                </div>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleSyncEvents}
                disabled={syncMutation.isPending}
              >
                <RefreshCw className={`mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} size={16} />
                {syncMutation.isPending ? 'Reloding...' : 'Reload Events'}
              </Button>
              <LocationSelector />
              <CalendarSourcesModal />
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setIsDataSourcesOpen(true)}
              >
                <Database className="mr-2" size={16} />
                Local Sources
              </Button>
              <Button variant="ghost" size="sm">
                <Bell size={18} />
              </Button>
              <Button variant="ghost" size="sm">
                <Settings size={18} />
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="md:hidden">
              <Menu size={18} />
            </Button>
          </div>
        </div>
      </header>

      <DataSourcesModal 
        isOpen={isDataSourcesOpen}
        onClose={() => setIsDataSourcesOpen(false)}
      />
    </>
  );
}
