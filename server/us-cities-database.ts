
import { CalendarSource } from './calendar-collector';

interface CityData {
  name: string;
  state: string;
  stateCode: string;
  county: string;
  population: number;
  type: 'major' | 'medium' | 'small' | 'town';
  lat: number;
  lng: number;
  potentialSources: string[];
}

// Comprehensive US Cities Database (subset shown - full implementation would include 20,000+ cities)
export const US_CITIES_DATABASE: CityData[] = [
  // Major Cities (Population > 300,000)
  { name: "New York", state: "New York", stateCode: "NY", county: "New York", population: 8336817, type: "major", lat: 40.7128, lng: -74.0060, potentialSources: ["city", "school", "chamber", "parks"] },
  { name: "Los Angeles", state: "California", stateCode: "CA", county: "Los Angeles", population: 3979576, type: "major", lat: 34.0522, lng: -118.2437, potentialSources: ["city", "school", "chamber", "parks"] },
  { name: "Chicago", state: "Illinois", stateCode: "IL", county: "Cook", population: 2693976, type: "major", lat: 41.8781, lng: -87.6298, potentialSources: ["city", "school", "chamber", "parks"] },
  { name: "Houston", state: "Texas", stateCode: "TX", county: "Harris", population: 2320268, type: "major", lat: 29.7604, lng: -95.3698, potentialSources: ["city", "school", "chamber", "parks"] },
  { name: "Phoenix", state: "Arizona", stateCode: "AZ", county: "Maricopa", population: 1680992, type: "major", lat: 33.4484, lng: -112.0740, potentialSources: ["city", "school", "chamber", "parks"] },
  { name: "Philadelphia", state: "Pennsylvania", stateCode: "PA", county: "Philadelphia", population: 1584064, type: "major", lat: 39.9526, lng: -75.1652, potentialSources: ["city", "school", "chamber", "parks"] },
  { name: "San Antonio", state: "Texas", stateCode: "TX", county: "Bexar", population: 1547253, type: "major", lat: 29.4241, lng: -98.4936, potentialSources: ["city", "school", "chamber", "parks"] },
  { name: "San Diego", state: "California", stateCode: "CA", county: "San Diego", population: 1423851, type: "major", lat: 32.7157, lng: -117.1611, potentialSources: ["city", "school", "chamber", "parks"] },
  { name: "Dallas", state: "Texas", stateCode: "TX", county: "Dallas", population: 1343573, type: "major", lat: 32.7767, lng: -96.7970, potentialSources: ["city", "school", "chamber", "parks"] },
  { name: "San Jose", state: "California", stateCode: "CA", county: "Santa Clara", population: 1021795, type: "major", lat: 37.3382, lng: -121.8863, potentialSources: ["city", "school", "chamber", "parks"] },

  // Medium Cities (Population 50,000 - 300,000)
  { name: "Boulder", state: "Colorado", stateCode: "CO", county: "Boulder", population: 108250, type: "medium", lat: 40.0150, lng: -105.2705, potentialSources: ["city", "school", "chamber"] },
  { name: "Ann Arbor", state: "Michigan", stateCode: "MI", county: "Washtenaw", population: 123851, type: "medium", lat: 42.2808, lng: -83.7430, potentialSources: ["city", "school", "chamber"] },
  { name: "Madison", state: "Wisconsin", stateCode: "WI", county: "Dane", population: 269840, type: "medium", lat: 43.0731, lng: -89.4012, potentialSources: ["city", "school", "chamber"] },
  { name: "Burlington", state: "Vermont", stateCode: "VT", county: "Chittenden", population: 44743, type: "medium", lat: 44.4759, lng: -73.2121, potentialSources: ["city", "school", "chamber"] },
  { name: "Santa Fe", state: "New Mexico", stateCode: "NM", county: "Santa Fe", population: 87505, type: "medium", lat: 35.6870, lng: -105.9378, potentialSources: ["city", "school", "chamber"] },
  { name: "Asheville", state: "North Carolina", stateCode: "NC", county: "Buncombe", population: 94589, type: "medium", lat: 35.5951, lng: -82.5515, potentialSources: ["city", "school", "chamber"] },
  { name: "Fort Collins", state: "Colorado", stateCode: "CO", county: "Larimer", population: 169810, type: "medium", lat: 40.5853, lng: -105.0844, potentialSources: ["city", "school", "chamber"] },
  { name: "Eugene", state: "Oregon", stateCode: "OR", county: "Lane", population: 176654, type: "medium", lat: 44.0521, lng: -123.0868, potentialSources: ["city", "school", "chamber"] },
  { name: "Bend", state: "Oregon", stateCode: "OR", county: "Deschutes", population: 99178, type: "medium", lat: 44.0582, lng: -121.3153, potentialSources: ["city", "school", "chamber"] },
  { name: "Missoula", state: "Montana", stateCode: "MT", county: "Missoula", population: 75516, type: "medium", lat: 46.8721, lng: -113.9940, potentialSources: ["city", "school", "chamber"] },

  // Small Cities and Towns (Population < 50,000)
  { name: "Telluride", state: "Colorado", stateCode: "CO", county: "San Miguel", population: 2607, type: "small", lat: 37.9375, lng: -107.8123, potentialSources: ["city", "school"] },
  { name: "Bar Harbor", state: "Maine", stateCode: "ME", county: "Hancock", population: 5089, type: "small", lat: 44.3876, lng: -68.2039, potentialSources: ["city", "school"] },
  { name: "Jackson", state: "Wyoming", stateCode: "WY", county: "Teton", population: 10760, type: "small", lat: 43.4799, lng: -110.7624, potentialSources: ["city", "school"] },
  { name: "Park City", state: "Utah", stateCode: "UT", county: "Summit", population: 8396, type: "small", lat: 40.6461, lng: -111.4980, potentialSources: ["city", "school"] },
  { name: "Sedona", state: "Arizona", stateCode: "AZ", county: "Coconino", population: 9684, type: "small", lat: 34.8697, lng: -111.7610, potentialSources: ["city", "school"] },
  { name: "Key West", state: "Florida", stateCode: "FL", county: "Monroe", population: 24649, type: "small", lat: 24.5551, lng: -81.7800, potentialSources: ["city", "school"] },
  { name: "Martha's Vineyard", state: "Massachusetts", stateCode: "MA", county: "Dukes", population: 15439, type: "small", lat: 41.3888, lng: -70.6161, potentialSources: ["city", "school"] },
  { name: "Carmel-by-the-Sea", state: "California", stateCode: "CA", county: "Monterey", population: 3220, type: "small", lat: 36.5552, lng: -121.9233, potentialSources: ["city", "school"] },
  { name: "Taos", state: "New Mexico", stateCode: "NM", county: "Taos", population: 6567, type: "small", lat: 36.4073, lng: -105.5731, potentialSources: ["city", "school"] },
  { name: "Woodstock", state: "Vermont", stateCode: "VT", county: "Windsor", population: 2951, type: "small", lat: 43.6242, lng: -72.5184, potentialSources: ["city", "school"] },

  // Additional representative cities across all states...
  // Alabama
  { name: "Birmingham", state: "Alabama", stateCode: "AL", county: "Jefferson", population: 200733, type: "medium", lat: 33.5186, lng: -86.8104, potentialSources: ["city", "school", "chamber"] },
  { name: "Mobile", state: "Alabama", stateCode: "AL", county: "Mobile", population: 187041, type: "medium", lat: 30.6954, lng: -88.0399, potentialSources: ["city", "school", "chamber"] },
  { name: "Huntsville", state: "Alabama", stateCode: "AL", county: "Madison", population: 215006, type: "medium", lat: 34.7304, lng: -86.5861, potentialSources: ["city", "school", "chamber"] },

  // Alaska
  { name: "Anchorage", state: "Alaska", stateCode: "AK", county: "Anchorage", population: 288000, type: "medium", lat: 61.2181, lng: -149.9003, potentialSources: ["city", "school", "chamber"] },
  { name: "Fairbanks", state: "Alaska", stateCode: "AK", county: "Fairbanks North Star", population: 32515, type: "small", lat: 64.8378, lng: -147.7164, potentialSources: ["city", "school"] },
  { name: "Juneau", state: "Alaska", stateCode: "AK", county: "Juneau", population: 32255, type: "small", lat: 58.3019, lng: -134.4197, potentialSources: ["city", "school"] },

  // Continue for all 50 states with representative cities...
  // This is a sample - full implementation would include thousands more cities
];

export class ComprehensiveCityDiscoverer {
  
  getCitiesByState(stateCode: string): CityData[] {
    return US_CITIES_DATABASE.filter(city => city.stateCode === stateCode);
  }

  getCitiesByPopulation(minPop: number, maxPop: number): CityData[] {
    return US_CITIES_DATABASE.filter(city => 
      city.population >= minPop && city.population <= maxPop
    );
  }

  getCitiesByType(type: 'major' | 'medium' | 'small' | 'town'): CityData[] {
    return US_CITIES_DATABASE.filter(city => city.type === type);
  }

  searchCities(query: string): CityData[] {
    const lowercaseQuery = query.toLowerCase();
    return US_CITIES_DATABASE.filter(city => 
      city.name.toLowerCase().includes(lowercaseQuery) ||
      city.state.toLowerCase().includes(lowercaseQuery) ||
      city.county.toLowerCase().includes(lowercaseQuery)
    );
  }

  getAllCities(): CityData[] {
    return US_CITIES_DATABASE;
  }

  getCityByName(name: string, state?: string): CityData | undefined {
    if (state) {
      return US_CITIES_DATABASE.find(city => 
        city.name.toLowerCase() === name.toLowerCase() && 
        (city.state.toLowerCase() === state.toLowerCase() || city.stateCode.toLowerCase() === state.toLowerCase())
      );
    }
    return US_CITIES_DATABASE.find(city => 
      city.name.toLowerCase() === name.toLowerCase()
    );
  }

  generateCalendarSourcesForCity(city: CityData): CalendarSource[] {
    const sources: CalendarSource[] = [];
    const citySlug = city.name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
    const stateSlug = city.stateCode.toLowerCase();

    // Generate potential calendar sources based on city data
    if (city.potentialSources.includes('city')) {
      sources.push({
        id: `${citySlug}-${stateSlug}-city`,
        name: `${city.name} City Government`,
        city: city.name,
        state: city.stateCode,
        type: 'city',
        feedUrl: `https://www.${citySlug}.gov/calendar`,
        websiteUrl: `https://www.${citySlug}.gov`,
        isActive: false,
        feedType: 'ical'
      });
    }

    if (city.potentialSources.includes('school')) {
      sources.push({
        id: `${citySlug}-${stateSlug}-school`,
        name: `${city.name} School District`,
        city: city.name,
        state: city.stateCode,
        type: 'school',
        feedUrl: `https://www.${citySlug}schools.org/calendar`,
        websiteUrl: `https://www.${citySlug}schools.org`,
        isActive: false,
        feedType: 'ical'
      });
    }

    if (city.potentialSources.includes('chamber')) {
      sources.push({
        id: `${citySlug}-${stateSlug}-chamber`,
        name: `${city.name} Chamber of Commerce`,
        city: city.name,
        state: city.stateCode,
        type: 'chamber',
        feedUrl: `https://www.${citySlug}chamber.org/events`,
        websiteUrl: `https://www.${citySlug}chamber.org`,
        isActive: false,
        feedType: 'rss'
      });
    }

    if (city.potentialSources.includes('parks') && city.population > 50000) {
      sources.push({
        id: `${citySlug}-${stateSlug}-parks`,
        name: `${city.name} Parks & Recreation`,
        city: city.name,
        state: city.stateCode,
        type: 'parks',
        feedUrl: `https://www.${citySlug}.gov/parks/events`,
        websiteUrl: `https://www.${citySlug}.gov/parks`,
        isActive: false,
        feedType: 'html'
      });
    }

    return sources;
  }
}

export const cityDiscoverer = new ComprehensiveCityDiscoverer();
