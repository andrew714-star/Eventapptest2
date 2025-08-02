import { Event } from "@shared/schema";

export const mockEvents: Event[] = [
  {
    id: "1",
    title: "Holiday Market Opening",
    description: "Join us for the grand opening of our annual holiday market featuring local vendors, festive food, and holiday entertainment for the whole family.",
    category: "Community & Social",
    location: "Downtown Plaza",
    organizer: "City Parks Department",
    startDate: new Date("2024-12-10T09:00:00"),
    endDate: new Date("2024-12-10T18:00:00"),
    startTime: "9:00 AM",
    endTime: "6:00 PM",
    attendees: 234,
    imageUrl: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?ixlib=rb-4.0.3",
    isFree: "true",
    source: "city-website"
  },
  {
    id: "2",
    title: "Winter Jazz Concert",
    description: "Enjoy an evening of smooth jazz featuring the City Jazz Ensemble. Warm beverages and light refreshments available for purchase.",
    category: "Music & Concerts",
    location: "Community Center Auditorium",
    organizer: "Community Arts Center",
    startDate: new Date("2024-12-05T18:30:00"),
    endDate: new Date("2024-12-05T21:00:00"),
    startTime: "6:30 PM",
    endTime: "9:00 PM",
    attendees: 89,
    imageUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?ixlib=rb-4.0.3",
    isFree: "false",
    source: "community-center"
  }
];
