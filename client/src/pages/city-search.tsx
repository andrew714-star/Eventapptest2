import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ExternalLink, MapPin, CheckCircle, XCircle, AlertCircle, Clock } from "lucide-react";
import { type City } from "@shared/schema";

interface WebsiteValidation {
  isValid: boolean;
  status: 'valid' | 'parked' | 'expired' | 'redirect' | 'error' | 'timeout';
  actualUrl?: string;
  title?: string;
  error?: string;
}

interface CityWebsiteCheck {
  city: City | null;
  websiteValidation?: WebsiteValidation;
  found: boolean;
}

export default function CitySearchPage() {
  const [cityName, setCityName] = useState("");
  const [selectedState, setSelectedState] = useState<string>("");
  const [checkResult, setCheckResult] = useState<CityWebsiteCheck | null>(null);
  const [hasChecked, setHasChecked] = useState(false);

  const checkCityMutation = useMutation({
    mutationFn: async (): Promise<CityWebsiteCheck> => {
      if (!cityName.trim()) {
        throw new Error('City name is required');
      }
      
      const response = await fetch('/api/cities/check-website', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          cityName: cityName.trim(),
          state: selectedState && selectedState !== "all" ? selectedState : undefined
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to check city website');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setCheckResult(data);
      setHasChecked(true);
    }
  });

  const validateWebsiteMutation = useMutation({
    mutationFn: async (url: string): Promise<WebsiteValidation> => {
      const response = await fetch('/api/cities/validate-websites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ urls: [url] }),
      });

      if (!response.ok) {
        throw new Error('Failed to validate website');
      }

      const result = await response.json();
      return result.validations[url];
    },
    onSuccess: (validation) => {
      if (checkResult) {
        setCheckResult({
          ...checkResult,
          websiteValidation: validation
        });
      }
    }
  });

  const handleCheck = () => {
    if (cityName.trim()) {
      setHasChecked(false);
      setCheckResult(null);
      checkCityMutation.mutate();
    }
  };

  const handleValidateWebsite = () => {
    if (checkResult?.city?.websiteUrl) {
      validateWebsiteMutation.mutate(checkResult.city.websiteUrl);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCheck();
    }
  };

  const getValidationIcon = (validation?: WebsiteValidation) => {
    if (!validation) return null;
    
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

  const getValidationStatus = (validation?: WebsiteValidation): string => {
    if (!validation) return 'Not Checked';
    
    switch (validation.status) {
      case 'valid':
        return 'Valid Website';
      case 'parked':
        return 'Domain Parked';
      case 'expired':
        return 'Domain Expired';
      case 'redirect':
        return 'Redirects';
      case 'timeout':
        return 'Timeout';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
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
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" data-testid="page-title">Check City Website Database</h1>
        <p className="text-muted-foreground">
          Enter a city name to check if its website exists in our database of 19,000+ US cities. We automatically verify if the website actually works.
        </p>
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-700">
            <strong>Note:</strong> Our database may contain outdated website information. We automatically check if websites are actually accessible when you search for a city.
          </p>
        </div>
      </div>

      {/* Add City Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Check City Website
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                data-testid="input-city-name"
                placeholder="Enter city name (e.g., 'San Francisco', 'Austin', 'New York')"
                value={cityName}
                onChange={(e) => setCityName(e.target.value)}
                onKeyPress={handleKeyPress}
                className="text-base"
              />
            </div>
            <Button 
              data-testid="button-check"
              onClick={handleCheck} 
              disabled={!cityName.trim() || checkCityMutation.isPending}
            >
              {checkCityMutation.isPending ? "Checking..." : "Check"}
            </Button>
          </div>
          
          <div className="flex gap-4 items-center">
            <div className="min-w-[200px]">
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger data-testid="select-state">
                  <SelectValue placeholder="Filter by state (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  {states.map((state) => (
                    <SelectItem key={state} value={state}>{state}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {checkCityMutation.error && (
        <Card className="mb-6 border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              <span data-testid="error-message">
                {checkCityMutation.error.message}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {hasChecked && !checkCityMutation.isPending && !checkCityMutation.error && checkResult && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold" data-testid="results-title">
              Check Results
            </h2>
          </div>

          {!checkResult.found ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground" data-testid="no-results">
                  City "{cityName}" not found in our database. Try checking the spelling or use a different search term.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg" data-testid={`city-name-${checkResult.city?.geoid}`}>
                      {checkResult.city?.municipality}
                    </h3>
                    <p className="text-muted-foreground" data-testid={`city-state-${checkResult.city?.geoid}`}>
                      {checkResult.city?.state}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge 
                      variant={checkResult.city?.websiteAvailable ? "default" : "secondary"}
                      data-testid={`website-status-${checkResult.city?.geoid}`}
                    >
                      {checkResult.city?.websiteAvailable ? "Listed in Database" : "No Website Listed"}
                    </Badge>
                    
                    {checkResult.websiteValidation && (
                      <Badge 
                        variant={checkResult.websiteValidation.isValid ? "default" : "destructive"}
                        className="flex items-center gap-1"
                        data-testid={`validation-status-${checkResult.city?.geoid}`}
                      >
                        {getValidationIcon(checkResult.websiteValidation)}
                        <strong>ACTUAL STATUS: {getValidationStatus(checkResult.websiteValidation)}</strong>
                      </Badge>
                    )}
                  </div>

                  {checkResult.city?.websiteUrl && (
                    <div className="space-y-2">
                      {/* Warning for invalid websites */}
                      {checkResult.websiteValidation && !checkResult.websiteValidation.isValid && (
                        <div className="p-3 border border-red-200 bg-red-50 rounded-md">
                          <div className="flex items-center gap-2 text-red-700">
                            <AlertCircle className="h-4 w-4" />
                            <span className="font-medium">Website Issue Detected</span>
                          </div>
                          <p className="text-sm text-red-600 mt-1">
                            The database lists a website for this city, but it appears to be{' '}
                            {checkResult.websiteValidation.status === 'parked' ? 'parked or for sale' :
                             checkResult.websiteValidation.status === 'expired' ? 'expired' :
                             checkResult.websiteValidation.status === 'redirect' ? 'redirecting to another domain' :
                             checkResult.websiteValidation.status === 'error' ? 'not accessible' :
                             'not working properly'}
                            . The website data may be outdated.
                          </p>
                          {checkResult.websiteValidation.error && (
                            <p className="text-xs text-red-500 mt-1">
                              Details: {checkResult.websiteValidation.error}
                            </p>
                          )}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2">
                        <a
                          href={checkResult.city.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center gap-1 ${
                            checkResult.websiteValidation && !checkResult.websiteValidation.isValid 
                              ? 'text-red-600 hover:text-red-800' 
                              : 'text-blue-600 hover:text-blue-800'
                          }`}
                          data-testid={`website-link-${checkResult.city.geoid}`}
                        >
                          {checkResult.city.websiteUrl}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      
                      {!checkResult.websiteValidation && (
                        <Button
                          onClick={handleValidateWebsite}
                          disabled={validateWebsiteMutation.isPending}
                          size="sm"
                          variant="outline"
                          data-testid="button-validate-website"
                        >
                          <Clock className="mr-2 h-4 w-4" />
                          {validateWebsiteMutation.isPending ? "Validating..." : "Check Website Status"}
                        </Button>
                      )}
                      
                      {checkResult.websiteValidation && checkResult.websiteValidation.actualUrl && 
                       checkResult.websiteValidation.actualUrl !== checkResult.city.websiteUrl && (
                        <p className="text-sm text-muted-foreground">
                          Redirects to: {checkResult.websiteValidation.actualUrl}
                        </p>
                      )}
                      
                      {checkResult.websiteValidation?.title && (
                        <p className="text-sm text-muted-foreground">
                          Page title: {checkResult.websiteValidation.title}
                        </p>
                      )}
                    </div>
                  )}

                  {checkResult.city?.geoid && (
                    <div className="text-sm text-muted-foreground">
                      City ID: {checkResult.city.geoid}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}