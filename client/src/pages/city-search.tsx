import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, ExternalLink, MapPin, CheckCircle, XCircle, AlertCircle, Clock } from "lucide-react";
import { type City, type CitySearch } from "@shared/schema";

interface WebsiteValidation {
  isValid: boolean;
  status: 'valid' | 'parked' | 'expired' | 'redirect' | 'error' | 'timeout';
  actualUrl?: string;
  title?: string;
  error?: string;
}

export default function CitySearchPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedState, setSelectedState] = useState<string>("");
  const [websiteRequired, setWebsiteRequired] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [websiteValidations, setWebsiteValidations] = useState<Record<string, WebsiteValidation>>({});

  const searchQuery = useQuery({
    queryKey: ['/api/cities/search', searchTerm, selectedState, websiteRequired],
    queryFn: async (): Promise<City[]> => {
      if (!searchTerm.trim()) return [];
      
      const searchParams: CitySearch = {
        query: searchTerm.trim(),
        state: selectedState && selectedState !== "all" ? selectedState : undefined,
        websiteRequired: websiteRequired || undefined
      };

      const response = await fetch('/api/cities/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchParams),
      });

      if (!response.ok) {
        throw new Error('Failed to search cities');
      }

      return response.json();
    },
    enabled: false, // Only run when manually triggered
  });

  const validateWebsitesMutation = useMutation({
    mutationFn: async (urls: string[]): Promise<{ validations: Record<string, WebsiteValidation> }> => {
      const response = await fetch('/api/cities/validate-websites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ urls }),
      });

      if (!response.ok) {
        throw new Error('Failed to validate websites');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setWebsiteValidations(prev => ({ ...prev, ...data.validations }));
    }
  });

  const handleSearch = () => {
    if (searchTerm.trim()) {
      setHasSearched(true);
      searchQuery.refetch();
    }
  };

  const handleValidateWebsites = () => {
    const cities = searchQuery.data || [];
    const urlsToValidate = cities
      .filter(city => city.websiteUrl && !websiteValidations[city.websiteUrl])
      .map(city => city.websiteUrl!)
      .slice(0, 10); // Limit to 10 to avoid overwhelming
      
    if (urlsToValidate.length > 0) {
      validateWebsitesMutation.mutate(urlsToValidate);
    }
  };

  const getValidationIcon = (url: string | null) => {
    if (!url || !websiteValidations[url]) return null;
    
    const validation = websiteValidations[url];
    switch (validation.status) {
      case 'valid':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'parked':
      case 'expired':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'redirect':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'timeout':
      case 'error':
        return <XCircle className="h-4 w-4 text-gray-600" />;
      default:
        return null;
    }
  };

  const getValidationStatus = (url: string | null): string => {
    if (!url || !websiteValidations[url]) return 'Not Checked';
    
    const validation = websiteValidations[url];
    switch (validation.status) {
      case 'valid':
        return 'Valid Website';
      case 'parked':
        return 'Parked Domain';
      case 'expired':
        return 'Expired Domain';
      case 'redirect':
        return `Redirects to ${new URL(validation.actualUrl || '').hostname}`;
      case 'timeout':
        return 'Connection Timeout';
      case 'error':
        return 'Connection Error';
      default:
        return 'Unknown Status';
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const states = [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", 
    "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", 
    "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", 
    "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", 
    "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", 
    "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", 
    "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"
  ];

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" data-testid="page-title">US City Website Database</h1>
        <p className="text-muted-foreground">
          Search through 19,000+ US cities to find their official websites and contact information.
        </p>
      </div>

      {/* Search Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Cities
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                data-testid="input-search-city"
                placeholder="Enter city name (e.g., 'San Francisco', 'Austin', 'New York')"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={handleKeyPress}
                className="text-base"
              />
            </div>
            <Button 
              data-testid="button-search"
              onClick={handleSearch} 
              disabled={!searchTerm.trim() || searchQuery.isLoading}
            >
              {searchQuery.isLoading ? "Searching..." : "Search"}
            </Button>
          </div>
          
          <div className="flex gap-4 items-center flex-wrap">
            <div className="min-w-[200px]">
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger data-testid="select-state">
                  <SelectValue placeholder="Filter by state (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  {states.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="website-required"
                data-testid="checkbox-website-required"
                checked={websiteRequired}
                onCheckedChange={(checked) => setWebsiteRequired(checked as boolean)}
              />
              <label htmlFor="website-required" className="text-sm font-medium">
                Only cities with websites
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {searchQuery.isLoading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-2 text-muted-foreground">Searching cities...</p>
        </div>
      )}

      {searchQuery.error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive" data-testid="error-message">
              Failed to search cities. Please try again.
            </p>
          </CardContent>
        </Card>
      )}

      {hasSearched && !searchQuery.isLoading && !searchQuery.error && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold" data-testid="results-title">
              Search Results
            </h2>
            <div className="flex items-center gap-4">
              <Button
                onClick={handleValidateWebsites}
                disabled={validateWebsitesMutation.isPending || !searchQuery.data?.some(city => city.websiteUrl && !websiteValidations[city.websiteUrl])}
                size="sm"
                variant="outline"
                data-testid="button-validate-websites"
              >
                <Clock className="mr-2 h-4 w-4" />
                {validateWebsitesMutation.isPending ? "Validating..." : "Check Website Status"}
              </Button>
              <p className="text-muted-foreground" data-testid="results-count">
                {searchQuery.data?.length || 0} cities found
              </p>
            </div>
          </div>

          {searchQuery.data?.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground" data-testid="no-results">
                  No cities found matching your search criteria. Try adjusting your search terms.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {searchQuery.data?.map((city) => (
                <Card key={city.geoid} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div>
                        <h3 className="font-semibold text-lg" data-testid={`city-name-${city.geoid}`}>
                          {city.municipality}
                        </h3>
                        <p className="text-muted-foreground" data-testid={`city-state-${city.geoid}`}>
                          {city.state}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge 
                          variant={city.websiteAvailable ? "default" : "secondary"}
                          data-testid={`website-status-${city.geoid}`}
                        >
                          {city.websiteAvailable ? "Website Available" : "No Website"}
                        </Badge>
                        
                        {city.websiteUrl && getValidationIcon(city.websiteUrl) && (
                          <div className="flex items-center gap-1">
                            {getValidationIcon(city.websiteUrl)}
                            <span className="text-xs text-muted-foreground">
                              {getValidationStatus(city.websiteUrl)}
                            </span>
                          </div>
                        )}
                      </div>

                      {city.websiteUrl && (
                        <div>
                          <p className="text-sm font-medium mb-2">Official Website:</p>
                          <div className="space-y-1">
                            <a
                              href={city.websiteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                              data-testid={`website-link-${city.geoid}`}
                            >
                              <ExternalLink className="h-3 w-3" />
                              {city.websiteUrl}
                            </a>
                            
                            {websiteValidations[city.websiteUrl] && (
                              <div className="flex items-center gap-2 text-xs">
                                {getValidationIcon(city.websiteUrl)}
                                <span 
                                  className={`${
                                    websiteValidations[city.websiteUrl].status === 'valid' 
                                      ? 'text-green-600' 
                                      : websiteValidations[city.websiteUrl].status === 'parked' 
                                      ? 'text-red-600' 
                                      : 'text-yellow-600'
                                  }`}
                                >
                                  {websiteValidations[city.websiteUrl].status === 'parked' 
                                    ? '⚠️ This appears to be a parked domain or for sale page'
                                    : websiteValidations[city.websiteUrl].status === 'redirect'
                                    ? `🔄 Redirects to: ${new URL(websiteValidations[city.websiteUrl].actualUrl || '').hostname}`
                                    : websiteValidations[city.websiteUrl].status === 'valid'
                                    ? '✅ Website is accessible and appears to be legitimate'
                                    : websiteValidations[city.websiteUrl].error || 'Status unknown'
                                  }
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground">
                        <p data-testid={`city-geoid-${city.geoid}`}>GEOID: {city.geoid}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {!hasSearched && (
        <Card>
          <CardContent className="pt-6 text-center">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground" data-testid="search-prompt">
              Enter a city name above to search the US city website database.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}