import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Info, MapPin, Building, GraduationCap, Briefcase, Library, TreePine } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface CalendarSource {
  id: string;
  name: string;
  city: string;
  state: string;
  type: 'city' | 'school' | 'chamber' | 'library' | 'parks';
  feedUrl?: string;
  websiteUrl?: string;
  isActive: boolean;
  lastSync?: Date;
  feedType: 'ical' | 'rss' | 'webcal' | 'json' | 'html';
}

interface CalendarSourcesResponse {
  sources: CalendarSource[];
  activeCount: number;
  totalCount: number;
  states: string[];
  cities: string[];
  types: string[];
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'city': return <Building className="h-4 w-4" />;
    case 'school': return <GraduationCap className="h-4 w-4" />;
    case 'chamber': return <Briefcase className="h-4 w-4" />;
    case 'library': return <Library className="h-4 w-4" />;
    case 'parks': return <TreePine className="h-4 w-4" />;
    default: return <Building className="h-4 w-4" />;
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'city': return 'City Government';
    case 'school': return 'School District';
    case 'chamber': return 'Chamber of Commerce';
    case 'library': return 'Library System';
    case 'parks': return 'Parks & Recreation';
    default: return type;
  }
};

const getFeedTypeColor = (feedType: string) => {
  switch (feedType) {
    case 'ical': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'rss': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
    case 'json': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case 'webcal': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
    case 'html': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  }
};

export function CalendarSourcesModal() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: sourcesData, isLoading } = useQuery<CalendarSourcesResponse>({
    queryKey: ['/api/calendar-sources'],
    enabled: open,
  });

  const toggleSourceMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const response = await fetch(`/api/calendar-sources/${sourceId}/toggle`, {
        method: 'POST',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar-sources'] });
    },
  });

  const groupedSources = sourcesData?.sources.reduce((acc, source) => {
    if (!acc[source.state]) {
      acc[source.state] = [];
    }
    acc[source.state].push(source);
    return acc;
  }, {} as Record<string, CalendarSource[]>) || {};

  const sourcesByType = sourcesData?.sources.reduce((acc, source) => {
    if (!acc[source.type]) {
      acc[source.type] = [];
    }
    acc[source.type].push(source);
    return acc;
  }, {} as Record<string, CalendarSource[]>) || {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Info className="h-4 w-4 mr-2" />
          Data Sources
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Real Calendar Feed Sources</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Events are automatically collected from {sourcesData?.totalCount || 0} real calendar feeds across the US. 
            {sourcesData && (
              <span> {sourcesData.activeCount} sources are currently active.</span>
            )}
          </p>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-muted-foreground">Loading calendar sources...</div>
          </div>
        ) : (
          <Tabs defaultValue="by-state" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="by-state">By State</TabsTrigger>
              <TabsTrigger value="by-type">By Type</TabsTrigger>
              <TabsTrigger value="overview">Overview</TabsTrigger>
            </TabsList>

            <TabsContent value="by-state" className="mt-4">
              <ScrollArea className="h-[500px] pr-4">
                {Object.entries(groupedSources)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([state, sources]) => (
                    <div key={state} className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className="font-medium text-base">{state}</h3>
                        <Badge variant="secondary">{sources.length} sources</Badge>
                      </div>
                      <div className="grid gap-3">
                        {sources.map((source) => (
                          <div key={source.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-start gap-3 flex-1">
                              <div className="mt-1">
                                {getTypeIcon(source.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium text-sm truncate">{source.name}</h4>
                                  <Badge className={getFeedTypeColor(source.feedType)} variant="secondary">
                                    {source.feedType.toUpperCase()}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                  <MapPin className="h-3 w-3" />
                                  {source.city}, {source.state}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {getTypeLabel(source.type)}
                                </div>
                              </div>
                            </div>
                            <Switch
                              checked={source.isActive}
                              onCheckedChange={() => toggleSourceMutation.mutate(source.id)}
                              disabled={toggleSourceMutation.isPending}
                            />
                          </div>
                        ))}
                      </div>
                      <Separator className="mt-4" />
                    </div>
                  ))}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="by-type" className="mt-4">
              <ScrollArea className="h-[500px] pr-4">
                {Object.entries(sourcesByType)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([type, sources]) => (
                    <div key={type} className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        {getTypeIcon(type)}
                        <h3 className="font-medium text-base">{getTypeLabel(type)}</h3>
                        <Badge variant="secondary">{sources.length} sources</Badge>
                      </div>
                      <div className="grid gap-3">
                        {sources.map((source) => (
                          <div key={source.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-start gap-3 flex-1">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium text-sm truncate">{source.name}</h4>
                                  <Badge className={getFeedTypeColor(source.feedType)} variant="secondary">
                                    {source.feedType.toUpperCase()}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <MapPin className="h-3 w-3" />
                                  {source.city}, {source.state}
                                </div>
                              </div>
                            </div>
                            <Switch
                              checked={source.isActive}
                              onCheckedChange={() => toggleSourceMutation.mutate(source.id)}
                              disabled={toggleSourceMutation.isPending}
                            />
                          </div>
                        ))}
                      </div>
                      <Separator className="mt-4" />
                    </div>
                  ))}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="overview" className="mt-4">
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-primary">{sourcesData?.totalCount}</div>
                    <div className="text-sm text-muted-foreground">Total Sources</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{sourcesData?.activeCount}</div>
                    <div className="text-sm text-muted-foreground">Active Sources</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{sourcesData?.states.length}</div>
                    <div className="text-sm text-muted-foreground">States Covered</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{sourcesData?.cities.length}</div>
                    <div className="text-sm text-muted-foreground">Cities Covered</div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-3">Coverage by State</h3>
                  <div className="flex flex-wrap gap-2">
                    {sourcesData?.states.map((state) => (
                      <Badge key={state} variant="outline">
                        {state} ({groupedSources[state]?.length || 0})
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-3">Source Types</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {sourcesData?.types.map((type) => (
                      <div key={type} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(type)}
                          <span className="font-medium">{getTypeLabel(type)}</span>
                        </div>
                        <Badge variant="secondary">{sourcesByType[type]?.length || 0} sources</Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-sm text-muted-foreground space-y-2">
                  <p>
                    <strong>Automatic Sync:</strong> Events are automatically collected every 6 hours from all active sources.
                  </p>
                  <p>
                    <strong>Feed Types:</strong> We support iCal (.ics), RSS feeds, JSON APIs, WebCal, and HTML parsing.
                  </p>
                  <p>
                    <strong>Data Sources:</strong> City governments, school districts, chambers of commerce, libraries, and parks departments.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}