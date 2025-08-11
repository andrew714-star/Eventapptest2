import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, ExternalLink, MapPin } from "lucide-react";
import { type City, type CitySearch } from "@shared/schema";

export default function CitySearchPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedState, setSelectedState] = useState<string>("");
  const [websiteRequired, setWebsiteRequired] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const searchQuery = useQuery({
    queryKey: ['/api/cities/search', searchTerm, selectedState, websiteRequired],
    queryFn: async (): Promise<City[]> => {
      if (!searchTerm.trim()) return [];
      
      const searchParams: CitySearch = {
        query: searchTerm.trim(),
        state: selectedState || undefined,
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

  const handleSearch = () => {
    if (searchTerm.trim()) {
      setHasSearched(true);
      searchQuery.refetch();
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
                  <SelectItem value="">All States</SelectItem>
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
            <p className="text-muted-foreground" data-testid="results-count">
              {searchQuery.data?.length || 0} cities found
            </p>
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

                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={city.websiteAvailable ? "default" : "secondary"}
                          data-testid={`website-status-${city.geoid}`}
                        >
                          {city.websiteAvailable ? "Website Available" : "No Website"}
                        </Badge>
                      </div>

                      {city.websiteUrl && (
                        <div>
                          <p className="text-sm font-medium mb-2">Official Website:</p>
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