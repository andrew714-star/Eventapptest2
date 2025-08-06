
import { useEffect, useRef, useState } from 'react';
import maplibregl, { Map as MapLibreMap, NavigationControl, LngLatLike } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface MapSelectorProps {
  onLocationSelect: (city: string, state: string, coordinates: [number, number]) => void;
  selectedLocation?: string;
}

interface CongressionalDistrict {
  properties: {
    CD119FP: string; // District number
    STATEFP: string; // State FIPS code
    NAMELSAD: string; // Full name
  };
  geometry: any;
}

// Major US Cities with coordinates for initial markers
const US_CITIES = [
  { name: "Los Angeles", state: "CA", coordinates: [-118.2437, 34.0522] as [number, number] },
  { name: "San Francisco", state: "CA", coordinates: [-122.4194, 37.7749] as [number, number] },
  { name: "San Diego", state: "CA", coordinates: [-117.1611, 32.7157] as [number, number] },
  { name: "Sacramento", state: "CA", coordinates: [-121.4688, 38.5556] as [number, number] },
  { name: "Houston", state: "TX", coordinates: [-95.3698, 29.7604] as [number, number] },
  { name: "Dallas", state: "TX", coordinates: [-96.7970, 32.7767] as [number, number] },
  { name: "Austin", state: "TX", coordinates: [-97.7431, 30.2672] as [number, number] },
  { name: "San Antonio", state: "TX", coordinates: [-98.4936, 29.4241] as [number, number] },
  { name: "Miami", state: "FL", coordinates: [-80.1918, 25.7617] as [number, number] },
  { name: "Tampa", state: "FL", coordinates: [-82.4572, 27.9506] as [number, number] },
  { name: "Orlando", state: "FL", coordinates: [-81.3792, 28.5383] as [number, number] },
  { name: "Jacksonville", state: "FL", coordinates: [-81.6556, 30.3322] as [number, number] },
  { name: "New York", state: "NY", coordinates: [-74.0059, 40.7128] as [number, number] },
  { name: "Buffalo", state: "NY", coordinates: [-78.8784, 42.8864] as [number, number] },
  { name: "Rochester", state: "NY", coordinates: [-77.6109, 43.1566] as [number, number] },
  { name: "Syracuse", state: "NY", coordinates: [-76.1474, 43.0481] as [number, number] },
  { name: "Chicago", state: "IL", coordinates: [-87.6298, 41.8781] as [number, number] },
  { name: "Springfield", state: "IL", coordinates: [-89.6501, 39.7817] as [number, number] },
  { name: "Rockford", state: "IL", coordinates: [-89.0940, 42.2711] as [number, number] },
  { name: "Philadelphia", state: "PA", coordinates: [-75.1652, 39.9526] as [number, number] },
  { name: "Pittsburgh", state: "PA", coordinates: [-79.9959, 40.4406] as [number, number] },
  { name: "Harrisburg", state: "PA", coordinates: [-76.8839, 40.2732] as [number, number] },
  { name: "Columbus", state: "OH", coordinates: [-82.9988, 39.9612] as [number, number] },
  { name: "Cleveland", state: "OH", coordinates: [-81.6944, 41.4993] as [number, number] },
  { name: "Cincinnati", state: "OH", coordinates: [-84.5120, 39.1031] as [number, number] },
  { name: "Atlanta", state: "GA", coordinates: [-84.3880, 33.7490] as [number, number] },
  { name: "Augusta", state: "GA", coordinates: [-81.9748, 33.4735] as [number, number] },
  { name: "Savannah", state: "GA", coordinates: [-81.0912, 32.0835] as [number, number] },
  { name: "Charlotte", state: "NC", coordinates: [-80.8431, 35.2271] as [number, number] },
  { name: "Raleigh", state: "NC", coordinates: [-78.6382, 35.7796] as [number, number] },
  { name: "Greensboro", state: "NC", coordinates: [-79.7920, 36.0726] as [number, number] },
  { name: "Phoenix", state: "AZ", coordinates: [-112.0740, 33.4484] as [number, number] },
  { name: "Tucson", state: "AZ", coordinates: [-110.9265, 32.2226] as [number, number] },
  { name: "Las Vegas", state: "NV", coordinates: [-115.1398, 36.1699] as [number, number] },
  { name: "Reno", state: "NV", coordinates: [-119.7674, 39.5296] as [number, number] },
  { name: "Denver", state: "CO", coordinates: [-104.9903, 39.7392] as [number, number] },
  { name: "Colorado Springs", state: "CO", coordinates: [-104.8214, 38.8339] as [number, number] },
  { name: "Seattle", state: "WA", coordinates: [-122.3321, 47.6062] as [number, number] },
  { name: "Spokane", state: "WA", coordinates: [-117.4260, 47.6588] as [number, number] },
  { name: "Portland", state: "OR", coordinates: [-122.6765, 45.5152] as [number, number] },
  { name: "Salem", state: "OR", coordinates: [-123.0351, 44.9429] as [number, number] },
];

export function MapSelector({ onLocationSelect, selectedLocation }: MapSelectorProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [showDistricts, setShowDistricts] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [districtFeeds, setDistrictFeeds] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!mapContainer.current || map.current || isInitializing) return;
    
    setIsInitializing(true);

    try {
      // Initialize the map with a simplified style
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            'osm-tiles': {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              maxzoom: 18,
              attribution: '© OpenStreetMap contributors'
            }
          },
          layers: [
            {
              id: 'osm-layer',
              type: 'raster',
              source: 'osm-tiles'
            }
          ]
          // Removed glyphs to avoid font loading issues
        },
        center: [-98.5795, 39.8283] as LngLatLike,
        zoom: 4,
        maxZoom: 14, // Reduce max zoom to limit tile requests
        minZoom: 3,
        attributionControl: false,
        cooperativeGestures: false,
        preserveDrawingBuffer: false,
        failIfMajorPerformanceCaveat: false,
        refreshExpiredTiles: false, // Don't refresh expired tiles
        maxTileCacheSize: 50 // Limit tile cache size
      });

      // Add navigation control
      map.current.addControl(new NavigationControl(), 'top-right');

      // Remove error handling that interferes with map operations

      map.current.on('load', () => {
        if (map.current) {
          setIsLoaded(true);
          setIsInitializing(false);
          addCityMarkers();
        }
      });

      // Handle map clicks with simplified error handling
      map.current.on('click', async (e) => {
        if (!e?.lngLat || !map.current) return;
        
        const { lng, lat } = e.lngLat;

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
            {
              headers: {
                'User-Agent': 'EventCalendarApp/1.0'
              }
            }
          );
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          
          const data = await response.json();

          if (data?.address) {
            const address = data.address;
            const city = address.city || address.town || address.village || '';
            const state = address.state || '';

            if (city && state) {
              onLocationSelect(city, state, [lng, lat]);
            }
          }
        } catch (error) {
          console.error('Error getting location info:', error);
        }
      });

      return () => {
        try {
          if (map.current) {
            map.current.remove();
            map.current = null;
          }
        } catch (error) {
          // Silently handle cleanup errors
        } finally {
          setIsLoaded(false);
          setIsInitializing(false);
        }
      };
    } catch (error) {
      console.error('Error initializing map:', error);
      setIsInitializing(false);
    }
  }, [onLocationSelect]);

  const addCityMarkers = () => {
    if (!map.current || !map.current.isStyleLoaded()) {
      console.log('Map not ready for markers yet');
      return;
    }

    try {
      // Check if source already exists
      if (map.current.getSource('cities')) {
        console.log('Cities source already exists');
        return;
      }

      // Add source for city markers
      map.current.addSource('cities', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: US_CITIES.map(city => ({
            type: 'Feature',
            properties: {
              name: city.name,
              state: city.state,
              label: `${city.name}, ${city.state}`
            },
            geometry: {
              type: 'Point',
              coordinates: city.coordinates
            }
          }))
        }
      });

    // Add city markers layer
      if (!map.current.getLayer('city-markers')) {
        map.current.addLayer({
          id: 'city-markers',
          type: 'circle',
          source: 'cities',
          paint: {
            'circle-radius': 6,
            'circle-color': '#3b82f6',
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2,
            'circle-opacity': 0.8
          }
        });
      }

      // Skip text labels to avoid glyph loading issues
      // City names will be shown in tooltips instead

    // Handle city marker clicks
      map.current.on('click', 'city-markers', (e) => {
        if (e.features && e.features[0]) {
          const feature = e.features[0];
          const properties = feature.properties;
          const coordinates = (feature.geometry as any).coordinates;

          if (properties) {
            onLocationSelect(properties.name, properties.state, coordinates);
          }
        }
      });

      // Add popup on hover
      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false
      });

      map.current.on('mouseenter', 'city-markers', (e) => {
        if (map.current && e.features && e.features[0]) {
          map.current.getCanvas().style.cursor = 'pointer';
          
          const feature = e.features[0];
          const coordinates = (feature.geometry as any).coordinates.slice();
          const properties = feature.properties;

          popup.setLngLat(coordinates)
            .setHTML(`<div class="text-sm font-medium">${properties.label}</div>`)
            .addTo(map.current);
        }
      });

      map.current.on('mouseleave', 'city-markers', () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = '';
          popup.remove();
        }
      });

    } catch (error) {
      console.error('Error adding city markers:', error);
      setIsLoaded(true); // Still set loaded to remove spinner
    }
  };

  // Function to load congressional districts
  const loadCongressionalDistricts = async () => {
    if (!map.current) return;
    
    try {
      const response = await fetch('/api/congressional-districts');
      if (!response.ok) {
        throw new Error('Failed to fetch congressional districts');
      }
      
      const districtsData = await response.json();
      
      // Add district boundaries to the map
      if (map.current.getSource('districts')) {
        map.current.removeLayer('district-boundaries');
        map.current.removeLayer('district-fill');
        map.current.removeSource('districts');
      }
      
      map.current.addSource('districts', {
        type: 'geojson',
        data: districtsData
      });
      
      // Add district fill layer
      map.current.addLayer({
        id: 'district-fill',
        type: 'fill',
        source: 'districts',
        paint: {
          'fill-color': '#3b82f6',
          'fill-opacity': 0.1
        }
      });
      
      // Add district boundaries
      map.current.addLayer({
        id: 'district-boundaries',
        type: 'line',
        source: 'districts',
        paint: {
          'line-color': '#3b82f6',
          'line-width': 2,
          'line-opacity': 0.7
        }
      });
      
      // Handle district clicks
      map.current.on('click', 'district-fill', async (e) => {
        if (e.features && e.features[0]) {
          const feature = e.features[0];
          const district = feature.properties?.CD118FP;
          const stateFips = feature.properties?.STATEFP;
          
          if (district && stateFips) {
            await handleDistrictSelect(stateFips, district);
          }
        }
      });
      
      // Add hover effects
      map.current.on('mouseenter', 'district-fill', () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = 'pointer';
        }
      });
      
      map.current.on('mouseleave', 'district-fill', () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = '';
        }
      });
      
      setShowDistricts(true);
      
    } catch (error) {
      console.error('Error loading congressional districts:', error);
      toast({
        title: "Error",
        description: "Failed to load congressional districts",
        variant: "destructive",
      });
    }
  };
  
  // Function to handle district selection
  const handleDistrictSelect = async (stateFips: string, district: string) => {
    // Map FIPS codes to state abbreviations (comprehensive mapping)
    const fipsToState: { [key: string]: string } = {
      '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT',
      '10': 'DE', '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL',
      '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD',
      '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE',
      '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
      '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD',
      '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV',
      '55': 'WI', '56': 'WY'
    };
    
    const state = fipsToState[stateFips];
    if (!state) {
      toast({
        title: "Error",
        description: "State not supported yet",
        variant: "destructive",
      });
      return;
    }
    
    const districtId = `${state}-${district}`;
    setSelectedDistrict(districtId);
    
    try {
      // Discover feeds for the entire congressional district
      const response = await fetch('/api/congressional-district/discover-feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ district, state })
      });
      
      if (!response.ok) {
        throw new Error('Failed to discover feeds for district');
      }
      
      const data = await response.json();
      setDistrictFeeds(data.results || []);
      
      toast({
        title: "District Selected",
        description: `Found feeds for ${data.citiesProcessed} cities in ${districtId}. Added ${data.totalAdded} new feeds.`,
      });
      
      console.log('District feed discovery results:', data);
      
    } catch (error) {
      console.error('Error discovering district feeds:', error);
      toast({
        title: "Error",
        description: "Failed to discover feeds for this district",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="w-full h-96 rounded-lg overflow-hidden border border-gray-200 relative">
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* District Controls */}
      <div className="absolute top-4 left-4 space-y-2">
        <Button
          onClick={showDistricts ? () => {
            if (map.current) {
              if (map.current.getSource('districts')) {
                map.current.removeLayer('district-boundaries');
                map.current.removeLayer('district-fill');
                map.current.removeSource('districts');
              }
              setShowDistricts(false);
              setSelectedDistrict(null);
              setDistrictFeeds([]);
            }
          } : loadCongressionalDistricts}
          variant={showDistricts ? "secondary" : "default"}
          size="sm"
        >
          {showDistricts ? "Hide Districts" : "Show Districts"}
        </Button>
        
        {selectedDistrict && (
          <Badge variant="outline" className="bg-white/90">
            District: {selectedDistrict}
          </Badge>
        )}
        
        {districtFeeds.length > 0 && (
          <Badge variant="outline" className="bg-white/90">
            {districtFeeds.reduce((sum, result) => sum + result.discovered, 0)} feeds found
          </Badge>
        )}
      </div>
      
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}
    </div>
  );
}
