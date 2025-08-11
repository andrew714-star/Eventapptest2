import { readFileSync } from 'fs';
import { join } from 'path';
import { type City } from '@shared/schema';

export class CityDataLoader {
  private static cities: Map<string, City> | null = null;

  static async loadCities(): Promise<Map<string, City>> {
    if (this.cities) {
      return this.cities;
    }

    try {
      const csvPath = join(process.cwd(), 'data', 'UScityURL.csv');
      const csvContent = readFileSync(csvPath, 'utf-8');
      const lines = csvContent.split('\n');
      
      // Skip header row
      const dataLines = lines.slice(1).filter(line => line.trim() !== '');
      
      this.cities = new Map<string, City>();
      
      for (const line of dataLines) {
        const [geoid, municipality, state, websiteAvailable, websiteUrl] = this.parseCSVLine(line);
        
        if (geoid && municipality && state) {
          const city: City = {
            geoid: geoid,
            municipality: municipality,
            state: state,
            websiteAvailable: parseInt(websiteAvailable) || 0,
            websiteUrl: websiteUrl || null,
          };
          
          this.cities.set(geoid, city);
        }
      }
      
      console.log(`City database loaded: ${this.cities.size} cities`);
      return this.cities;
    } catch (error) {
      console.error('Failed to load city database:', error);
      this.cities = new Map<string, City>();
      return this.cities;
    }
  }

  private static parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  static getCities(): Map<string, City> {
    if (!this.cities) {
      throw new Error('Cities not loaded. Call loadCities() first.');
    }
    return this.cities;
  }
}