
import { useEffect, useRef, useState } from 'react';
import maplibregl, { Map as MapLibreMap, NavigationControl, LngLatLike } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface MapSelectorProps {
  onLocationSelect: (city: string, state: string, coordinates: [number, number]) => void;
  selectedLocation?: string;
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

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      // Initialize the map with a more stable OpenStreetMap style
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            'osm-tiles': {
              type: 'raster',
              tiles: [
                'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
                'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
                'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
              ],
              tileSize: 256,
              maxzoom: 18,
              attribution: '© OpenStreetMap contributors'
            }
          },
          layers: [
            {
              id: 'osm-layer',
              type: 'raster',
              source: 'osm-tiles',
              minzoom: 0,
              maxzoom: 18
            }
          ]
        },
        center: [-98.5795, 39.8283] as LngLatLike, // Center of US
        zoom: 4,
        maxZoom: 18,
        minZoom: 2,
        attributionControl: true,
        cooperativeGestures: false
      });

      // Add navigation control
      map.current.addControl(new NavigationControl(), 'top-right');

      // Add comprehensive error handling for map events
      map.current.on('error', (e) => {
        console.warn('Map error (non-critical):', e.error?.message || 'Unknown map error');
        // Don't throw or break execution for map errors
      });

      map.current.on('load', () => {
        try {
          setIsLoaded(true);
          // Add a small delay to ensure map is fully ready
          setTimeout(() => {
            addCityMarkers();
          }, 100);
        } catch (error) {
          console.error('Error loading city markers:', error);
          setIsLoaded(true); // Still set loaded to remove spinner
        }
      });

      map.current.on('idle', () => {
        // Map has finished loading and is idle
        console.log('Map is ready and idle');
      });

      // Handle source and tile errors gracefully
      map.current.on('sourcedataloading', () => {
        // Loading source data
      });

      map.current.on('sourcedata', () => {
        // Source data loaded
      });

      // Handle map clicks with better error handling
    map.current.on('click', async (e) => {
      if (!e?.lngLat) return;
      
      const { lng, lat } = e.lngLat;

      try {
        // Add a controller for request cancellation
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
          {
            headers: {
              'User-Agent': 'EventCalendarApp/1.0'
            },
            signal: controller.signal
          }
        );
        
        clearTimeout(timeoutId);
        
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
        if (error.name === 'AbortError') {
          console.log('Request was cancelled');
        } else {
          console.error('Error getting location info:', error);
        }
      }
    });

      return () => {
        try {
          if (map.current) {
            map.current.off(); // Remove all event listeners
            map.current.remove();
            map.current = null;
          }
        } catch (error) {
          console.warn('Error during map cleanup:', error);
        }
      };
    } catch (error) {
      console.error('Error initializing map:', error);
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

      // Add city labels layer (simplified without custom fonts)
      if (!map.current.getLayer('city-labels')) {
        map.current.addLayer({
          id: 'city-labels',
          type: 'symbol',
          source: 'cities',
          layout: {
            'text-field': ['get', 'label'],
            'text-offset': [0, 1.5],
            'text-anchor': 'top',
            'text-size': 12
          },
          paint: {
            'text-color': '#374151',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1
          }
        });
      }

    // Handle city marker clicks with error handling
      map.current.on('click', 'city-markers', (e) => {
        try {
          if (e.features && e.features[0]) {
            const feature = e.features[0];
            const properties = feature.properties;
            const coordinates = (feature.geometry as any).coordinates;

            if (properties) {
              onLocationSelect(properties.name, properties.state, coordinates);
            }
          }
        } catch (error) {
          console.error('Error handling city marker click:', error);
        }
      });

      // Change cursor on hover with error handling
      map.current.on('mouseenter', 'city-markers', () => {
        try {
          if (map.current) {
            map.current.getCanvas().style.cursor = 'pointer';
          }
        } catch (error) {
          console.error('Error setting cursor on hover:', error);
        }
      });

      map.current.on('mouseleave', 'city-markers', () => {
        try {
          if (map.current) {
            map.current.getCanvas().style.cursor = '';
          }
        } catch (error) {
          console.error('Error resetting cursor:', error);
        }
      });

    } catch (error) {
      console.error('Error adding city markers:', error);
      setIsLoaded(true); // Still set loaded to remove spinner
    }
  };

  return (
    <div className="w-full h-96 rounded-lg overflow-hidden border border-gray-200 relative">
      <div ref={mapContainer} className="w-full h-full" />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}
    </div>
  );
}
