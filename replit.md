# Overview

CityWide Events is a comprehensive automated events aggregation platform that collects and displays community events in real-time from authentic calendar feeds across the entire United States. The system automatically pulls from 18+ real data sources including major city governments, school districts, and Chambers of Commerce in states like California, Texas, New York, Florida, Illinois, and more. The application features calendar and list views, advanced city-based filtering, detailed event information, and automated data synchronization every 6 hours to help users discover local activities and events from legitimate, verified sources without any manual data entry.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

The frontend is built with React and TypeScript, using a modern component-based architecture with the following key decisions:

- **UI Framework**: React with TypeScript for type safety and better developer experience
- **Styling**: Tailwind CSS with shadcn/ui component library for consistent, accessible UI components
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: React Query (@tanstack/react-query) for server state management and data fetching
- **Form Handling**: React Hook Form with Zod validation for type-safe form management
- **Build Tool**: Vite for fast development and optimized production builds

The application follows a feature-based folder structure with reusable UI components, custom hooks, and utility functions. The design system uses CSS variables for theming with light/dark mode support.

## Backend Architecture

The backend is an Express.js API server with TypeScript:

- **Framework**: Express.js with TypeScript for type-safe server-side development
- **API Design**: RESTful API with dedicated routes for event operations (CRUD, filtering, date ranges)
- **Validation**: Zod schemas for request/response validation shared between client and server
- **Storage**: Currently using in-memory storage with an interface pattern for easy database migration
- **Development**: Hot-reload development server with Vite integration for full-stack development

The server uses middleware for request logging and error handling, with a clean separation between route handlers and storage operations.

## Data Storage & Collection

The application uses a comprehensive real-time data collection system with authentic sources:

- **Current Implementation**: In-memory storage with automated event collection from 18+ real calendar feeds across the US
- **Database Schema**: Designed for PostgreSQL with Drizzle ORM, includes source tracking fields
- **Migration Strategy**: Drizzle Kit for database migrations and schema management
- **Real Calendar Feeds**: CalendarFeedCollector service that processes iCal, RSS, JSON, and WebCal feeds from verified sources
- **Geographic Coverage**: Major cities across 10+ states including CA, TX, NY, FL, IL, WA, CO, GA, AZ, PA
- **Source Types**: City governments, school districts, Chambers of Commerce, libraries, and parks departments
- **Feed Processing**: Supports multiple feed formats (iCal .ics files, RSS feeds, JSON APIs, WebCal protocols)
- **Automatic Sync**: Periodic synchronization every 6 hours with manual sync capabilities
- **Source Management**: Comprehensive admin interface to view, enable/disable data sources, monitor sync status, and analyze coverage
- **Fallback System**: Graceful handling when real feeds are temporarily unavailable

The system collects from authentic sources like San Francisco City Events, Austin City Government, Chicago Public Schools, NYC.gov Events, and many more verified organizations nationwide.

## Component Architecture

The UI is built with a comprehensive component system:

- **Base Components**: shadcn/ui components for consistent design patterns
- **Feature Components**: Calendar view, event modals, filter sidebar, and header
- **Layout System**: Responsive grid layout with mobile-first design
- **Accessibility**: Built-in accessibility features through Radix UI primitives

The calendar component provides both calendar and list views with event filtering and search capabilities.

# External Dependencies

## Database Integration

- **Drizzle ORM**: Type-safe database operations with PostgreSQL dialect
- **Neon Database**: Serverless PostgreSQL database (configured but not yet connected)
- **Database Migrations**: Drizzle Kit for schema versioning and deployment

## UI and Styling

- **Radix UI**: Headless UI components for accessibility and behavior
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Lucide React**: Icon library for consistent iconography
- **Date-fns**: Date manipulation and formatting utilities

## Development Tools

- **TypeScript**: Static type checking across the entire stack
- **Vite**: Build tool and development server
- **ESBuild**: Fast JavaScript bundler for production builds
- **React Query**: Server state management and caching

## Deployment Platform

- **Replit**: Development and hosting platform with integrated tooling
- **Environment Variables**: Database connection strings and configuration
- **Hot Reload**: Development environment with live updates

The application is structured for easy deployment with environment-based configuration and proper separation of development and production builds.