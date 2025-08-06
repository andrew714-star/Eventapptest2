import { useState } from "react";
import { Globe, School, Building2, BookOpen, RefreshCw, CheckCircle, XCircle, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface DataSource {
  id: string;
  name: string;
  type: 'city' | 'school' | 'chamber' | 'community';
  url: string;
  isActive: boolean;
  lastSyncDate?: string;
}

interface DataSourcesResponse {
  sources: DataSource[];
  activeCount: number;
  totalCount: number;
}

interface DataSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DataSourcesModal({ isOpen, onClose }: DataSourcesModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sourcesData, isLoading } = useQuery<DataSourcesResponse>({
    queryKey: ["/api/data-sources"],
    enabled: isOpen,
  });

  const toggleMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const response = await apiRequest("POST", `/api/data-sources/${sourceId}/toggle`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-sources"] });
      toast({
        title: "Source Updated",
        description: "Data source status has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update data source status. Please try again.",
        variant: "destructive",
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/sync-events", {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events/filter"] });
      toast({
        title: "Events Synced",
        description: `Successfully synced ${data.syncedCount} new events from active sources.`,
      });
    },
    onError: () => {
      toast({
        title: "Sync Failed",
        description: "Failed to sync events from data sources. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'city':
        return <Building2 className="text-blue-600" size={20} />;
      case 'school':
        return <School className="text-green-600" size={20} />;
      case 'chamber':
        return <Globe className="text-purple-600" size={20} />;
      case 'community':
        return <BookOpen className="text-orange-600" size={20} />;
      default:
        return <Globe className="text-gray-600" size={20} />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'city':
        return 'City Government';
      case 'school':
        return 'School District';
      case 'chamber':
        return 'Chamber of Commerce';
      case 'community':
        return 'Community Organization';
      default:
        return 'Other';
    }
  };

  const getStatusBadge = (source: DataSource) => {
    if (!source.isActive) {
      return <Badge variant="outline"><XCircle className="mr-1" size={12} />Inactive</Badge>;
    }
    
    if (source.lastSyncDate) {
      return <Badge variant="default"><CheckCircle className="mr-1" size={12} />Active</Badge>;
    }
    
    return <Badge variant="secondary"><Clock className="mr-1" size={12} />Pending</Badge>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="data-sources-description">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Data Sources Management</DialogTitle>
          <p id="data-sources-description" className="text-gray-600 dark:text-gray-400">
            Manage automated event collection from city websites, school districts, and community organizations
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <Globe className="text-primary" size={24} />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Sources</p>
                    <p className="text-2xl font-bold">{sourcesData?.totalCount || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="text-green-600" size={24} />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Active Sources</p>
                    <p className="text-2xl font-bold text-green-600">{sourcesData?.activeCount || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <Button 
                  className="w-full"
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                >
                  <RefreshCw className={`mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} size={16} />
                  {syncMutation.isPending ? 'Syncing...' : 'Sync All Sources'}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Sources List */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Available Data Sources</h3>
            
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="grid gap-4">
                {sourcesData?.sources.map((source) => (
                  <Card key={source.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          {getSourceIcon(source.type)}
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 dark:text-white">{source.name}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{getTypeLabel(source.type)}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{source.url}</p>
                            {source.lastSyncDate && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Last sync: {format(new Date(source.lastSyncDate), "MMM d, yyyy 'at' h:mm a")}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                          {getStatusBadge(source)}
                          <Switch
                            checked={source.isActive}
                            onCheckedChange={() => toggleMutation.mutate(source.id)}
                            disabled={toggleMutation.isPending}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Information Panel */}
          <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="text-blue-900 dark:text-blue-100 text-lg">How It Works</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-blue-800 dark:text-blue-200 text-sm space-y-2">
                <p>• <strong>Automated Collection:</strong> The system automatically checks these sources for new events</p>
                <p>• <strong>Real-time Updates:</strong> Events are synced regularly to keep information current</p>
                <p>• <strong>Multiple Sources:</strong> City websites, school districts, and community organizations</p>
                <p>• <strong>Smart Filtering:</strong> Duplicate events are automatically detected and merged</p>
                <p>• <strong>Source Attribution:</strong> Each event shows which source it came from</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}