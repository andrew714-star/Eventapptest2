import { InsertEvent } from "@shared/schema";
import { storage } from "./storage";
import { calendarCollector } from "./calendar-collector";

export interface DataSource {
  id: string;
  name: string;
  type: 'city' | 'school' | 'chamber' | 'community';
  url: string;
  isActive: boolean;
  lastSyncDate?: Date;
  eventSelectors?: {
    title?: string;
    description?: string;
    date?: string;
    location?: string;
  };
}

export class EventDataCollector {
  private sources: DataSource[] = [
    {
      id: 'city-main',
      name: 'City of Springfield Events',
      type: 'city',
      url: 'https://www.springfield.gov/events',
      isActive: true,
      eventSelectors: {
        title: '.event-title',
        description: '.event-description',
        date: '.event-date',
        location: '.event-location'
      }
    },
    {
      id: 'school-district',
      name: 'Springfield School District',
      type: 'school',
      url: 'https://springfieldschools.org/calendar',
      isActive: true
    },
    {
      id: 'chamber-commerce',
      name: 'Springfield Chamber of Commerce',
      type: 'chamber',
      url: 'https://springfieldchamber.org/events',
      isActive: true
    },
    {
      id: 'parks-rec',
      name: 'Parks and Recreation',
      type: 'city',
      url: 'https://www.springfield.gov/parks/events',
      isActive: true
    },
    {
      id: 'library-system',
      name: 'Springfield Library System',
      type: 'community',
      url: 'https://springfieldlibrary.org/events',
      isActive: true
    }
  ];

  async collectFromAllSources(): Promise<InsertEvent[]> {
    console.log('Starting event synchronization from all sources...');
    
    // Collect from real calendar feeds across the US
    const realEvents = await calendarCollector.collectFromAllSources();
    
    // Also collect from local Springfield sources for additional coverage
    const localEvents: InsertEvent[] = [];
    for (const source of this.sources.filter(s => s.isActive)) {
      try {
        console.log(`Collecting events from ${source.name}...`);
        const events = await this.collectFromSource(source);
        localEvents.push(...events);
        
        // Update last sync date
        source.lastSyncDate = new Date();
        console.log(`Successfully collected ${events.length} events from ${source.name}`);
      } catch (error) {
        console.error(`Failed to collect from ${source.name}:`, error);
      }
    }

    const allEvents = [...realEvents, ...localEvents];
    console.log(`Total events collected: ${allEvents.length} (${realEvents.length} from national sources, ${localEvents.length} from local sources)`);
    
    return allEvents;
  }

  private async collectFromSource(source: DataSource): Promise<InsertEvent[]> {
    // In a real implementation, this would make HTTP requests to scrape or use APIs
    // For now, we'll simulate different types of events based on the source type
    
    const events: InsertEvent[] = [];
    const currentDate = new Date();

    switch (source.type) {
      case 'city':
        events.push(...this.generateCityEvents(source, currentDate));
        break;
      case 'school':
        events.push(...this.generateSchoolEvents(source, currentDate));
        break;
      case 'chamber':
        events.push(...this.generateChamberEvents(source, currentDate));
        break;
      case 'community':
        events.push(...this.generateCommunityEvents(source, currentDate));
        break;
    }

    return events;
  }

  private generateCityEvents(source: DataSource, baseDate: Date): InsertEvent[] {
    const cities = ["Springfield", "Riverside", "Madison", "Oakland", "Portland"];
    const cityEvents = [
      {
        title: "City Council Meeting",
        description: "Monthly city council meeting open to the public. Topics include budget review, infrastructure updates, and community development initiatives.",
        category: "Community & Social",
        location: "Springfield City Hall Council Chambers",
        organizer: "City of Springfield",
        startDate: new Date(baseDate.getTime() + 5 * 24 * 60 * 60 * 1000),
        endDate: new Date(baseDate.getTime() + 5 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        startTime: "7:00 PM",
        endTime: "9:00 PM",
        attendees: 45,
        imageUrl: "https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?ixlib=rb-4.0.3",
        isFree: "true",
        source: source.id
      },
      {
        title: "Community Safety Workshop",
        description: "Learn about emergency preparedness, home security, and neighborhood watch programs. Presented by local police department.",
        category: "Education & Learning",
        location: "Riverside Community Center Main Hall",
        organizer: "Riverside Police Department",
        startDate: new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000),
        startTime: "10:00 AM",
        endTime: "11:30 AM",
        attendees: 67,
        imageUrl: "https://images.unsplash.com/photo-1560472355-a9a0593b6e80?ixlib=rb-4.0.3",
        isFree: "true",
        source: source.id
      },
      {
        title: "Madison Farmers Market",
        description: "Weekly farmers market featuring local produce, artisan goods, live music, and food trucks. Support local businesses and enjoy fresh, seasonal products.",
        category: "Food & Dining",
        location: "Downtown Madison Square",
        organizer: "Madison Parks Department",
        startDate: new Date(baseDate.getTime() + 3 * 24 * 60 * 60 * 1000),
        endDate: new Date(baseDate.getTime() + 3 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000),
        startTime: "8:00 AM",
        endTime: "12:00 PM",
        attendees: 156,
        imageUrl: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?ixlib=rb-4.0.3",
        isFree: "true",
        source: source.id
      },
      {
        title: "Oakland Art Festival",
        description: "Annual outdoor art festival featuring local artists, live performances, food vendors, and interactive art installations for all ages.",
        category: "Arts & Culture",
        location: "Oakland Central Park",
        organizer: "Oakland Arts Council",
        startDate: new Date(baseDate.getTime() + 9 * 24 * 60 * 60 * 1000),
        endDate: new Date(baseDate.getTime() + 9 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000),
        startTime: "10:00 AM",
        endTime: "4:00 PM",
        attendees: 289,
        imageUrl: "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?ixlib=rb-4.0.3",
        isFree: "true",
        source: source.id
      }
    ];

    return cityEvents;
  }

  private generateSchoolEvents(source: DataSource, baseDate: Date): InsertEvent[] {
    const schoolEvents = [
      {
        title: "Spring Science Fair",
        description: "Students from grades K-12 showcase their science projects. Judging begins at 6 PM. Awards ceremony follows. Open to families and community members.",
        category: "Education & Learning",
        location: "Portland High School Gymnasium",
        organizer: "Portland School District",
        startDate: new Date(baseDate.getTime() + 12 * 24 * 60 * 60 * 1000),
        endDate: new Date(baseDate.getTime() + 12 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
        startTime: "5:00 PM",
        endTime: "8:00 PM",
        attendees: 234,
        imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3",
        isFree: "true",
        source: source.id
      },
      {
        title: "Parent-Teacher Conference Night",
        description: "Scheduled conferences between parents and teachers to discuss student progress. Please sign up for time slots in advance through the school portal.",
        category: "Education & Learning",
        location: "Various Springfield Schools",
        organizer: "Springfield School District",
        startDate: new Date(baseDate.getTime() + 8 * 24 * 60 * 60 * 1000),
        endDate: new Date(baseDate.getTime() + 8 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000),
        startTime: "4:00 PM",
        endTime: "8:00 PM",
        attendees: 89,
        imageUrl: "https://images.unsplash.com/photo-1509062522246-3755977927d7?ixlib=rb-4.0.3",
        isFree: "true",
        source: source.id
      },
      {
        title: "Madison Middle School Drama Performance",
        description: "Students present 'A Midsummer Night's Dream' with costumes and set design by the art department. Family-friendly Shakespeare adaptation.",
        category: "Arts & Culture",
        location: "Madison Middle School Auditorium",
        organizer: "Madison School District",
        startDate: new Date(baseDate.getTime() + 6 * 24 * 60 * 60 * 1000),
        endDate: new Date(baseDate.getTime() + 6 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        startTime: "7:00 PM",
        endTime: "9:00 PM",
        attendees: 156,
        imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3",
        isFree: "false",
        source: source.id
      }
    ];

    return schoolEvents;
  }

  private generateChamberEvents(source: DataSource, baseDate: Date): InsertEvent[] {
    const chamberEvents = [
      {
        title: "Business Networking Breakfast",
        description: "Monthly networking event for local business owners and entrepreneurs. Guest speaker on digital marketing trends. Breakfast provided.",
        category: "Business & Networking",
        location: "Oakland Chamber Office",
        organizer: "Oakland Chamber of Commerce",
        startDate: new Date(baseDate.getTime() + 4 * 24 * 60 * 60 * 1000),
        endDate: new Date(baseDate.getTime() + 4 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000),
        startTime: "7:30 AM",
        endTime: "9:00 AM",
        attendees: 34,
        imageUrl: "https://images.unsplash.com/photo-1515169067868-5387ec356754?ixlib=rb-4.0.3",
        isFree: "false",
        source: source.id
      },
      {
        title: "Small Business Workshop: Financial Planning",
        description: "Learn essential financial planning strategies for small businesses. Topics include budgeting, cash flow management, and tax preparation. Led by certified accountants.",
        category: "Business & Networking",
        location: "Riverside Business Center",
        organizer: "Riverside Chamber of Commerce",
        startDate: new Date(baseDate.getTime() + 9 * 24 * 60 * 60 * 1000),
        endDate: new Date(baseDate.getTime() + 9 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
        startTime: "1:00 PM",
        endTime: "4:00 PM",
        attendees: 28,
        imageUrl: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?ixlib=rb-4.0.3",
        isFree: "false",
        source: source.id
      },
      {
        title: "Portland Tech Startup Showcase",
        description: "Local tech startups present their innovations to investors and community members. Networking reception follows. Great opportunity to see emerging technology.",
        category: "Business & Networking",
        location: "Portland Innovation Hub",
        organizer: "Portland Chamber of Commerce",
        startDate: new Date(baseDate.getTime() + 15 * 24 * 60 * 60 * 1000),
        endDate: new Date(baseDate.getTime() + 15 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000),
        startTime: "6:00 PM",
        endTime: "10:00 PM",
        attendees: 125,
        imageUrl: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?ixlib=rb-4.0.3",
        isFree: "false",
        source: source.id
      }
    ];

    return chamberEvents;
  }

  private generateCommunityEvents(source: DataSource, baseDate: Date): InsertEvent[] {
    const communityEvents = [
      {
        title: "Author Reading: Local History",
        description: "Join us for a reading and book signing with local historian Dr. Sarah Miller discussing her new book 'Springfield Through the Decades'.",
        category: "Arts & Culture",
        location: "Springfield Main Library",
        organizer: "Springfield Library System",
        startDate: new Date(baseDate.getTime() + 10 * 24 * 60 * 60 * 1000),
        endDate: new Date(baseDate.getTime() + 10 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000),
        startTime: "2:00 PM",
        endTime: "3:30 PM",
        attendees: 42,
        imageUrl: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?ixlib=rb-4.0.3",
        isFree: "true",
        source: source.id
      },
      {
        title: "Children's Story Time",
        description: "Weekly story time for children ages 3-7. This week featuring spring-themed stories and a craft activity. Parents welcome to stay.",
        category: "Family & Kids",
        location: "Springfield Main Library Children's Section",
        organizer: "Springfield Library System",
        startDate: new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000),
        endDate: new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000),
        startTime: "10:00 AM",
        endTime: "10:45 AM",
        attendees: 18,
        imageUrl: "https://images.unsplash.com/photo-1544717301-9cdcb1f5940f?ixlib=rb-4.0.3",
        isFree: "true",
        source: source.id
      },
      {
        title: "Digital Literacy Workshop for Seniors",
        description: "Learn basic computer skills, internet safety, and how to use smartphones and tablets. No experience necessary. Devices provided during class.",
        category: "Education & Learning",
        location: "Springfield Library Computer Lab",
        organizer: "Springfield Library System",
        startDate: new Date(baseDate.getTime() + 11 * 24 * 60 * 60 * 1000),
        endDate: new Date(baseDate.getTime() + 11 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        startTime: "1:00 PM",
        endTime: "3:00 PM",
        attendees: 15,
        imageUrl: "https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?ixlib=rb-4.0.3",
        isFree: "true",
        source: source.id
      }
    ];

    return communityEvents;
  }

  async syncEventsToStorage(): Promise<number> {
    const collectedEvents = await this.collectFromAllSources();
    let savedCount = 0;

    for (const event of collectedEvents) {
      try {
        await storage.createEvent(event);
        savedCount++;
      } catch (error) {
        console.error('Failed to save event:', event.title, error);
      }
    }

    console.log(`Successfully synced ${savedCount} out of ${collectedEvents.length} events`);
    return savedCount;
  }

  getSources(): DataSource[] {
    return this.sources;
  }

  getActiveSourcesCount(): number {
    return this.sources.filter(s => s.isActive).length;
  }

  toggleSource(sourceId: string): boolean {
    const source = this.sources.find(s => s.id === sourceId);
    if (source) {
      source.isActive = !source.isActive;
      return source.isActive;
    }
    return false;
  }
}

export const dataCollector = new EventDataCollector();