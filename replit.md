# Overview

CityWide Events is a comprehensive automated events aggregation platform that collects and displays community events in real-time from authentic calendar feeds across the entire United States. The system automatically pulls from 18+ real data sources including major city governments, school districts, and Chambers of Commerce in states like California, Texas, New York, Florida, Illinois, and more. The application features calendar and list views, advanced city-based filtering, detailed event information, and automated data synchronization every 6 hours to help users discover local activities and events from legitimate, verified sources without any manual data entry.

# User Preferences

Preferred communication style: Simple, everyday language.
Event loading behavior: Events should not load or be searched until after a user enters a location. No automatic event preloading on server startup - events should only be collected when users actively select locations or discover feeds.

# Recent Changes

**2025-01-11**: Enhanced Feed Discovery & City Website Database
- Enhanced RSS/iCal feed button detection to be more dynamic and comprehensive:
  - Added advanced JavaScript parsing to detect AJAX endpoints and dynamic feed URLs
  - Improved detection of onClick handlers, data attributes, and form actions
  - Added support for base64 encoded and obfuscated feed URLs
  - Enhanced parameter extraction for government CMS systems (ModID, CID, categoryId patterns)
  - Added detection of template variables and dynamic URL construction
  - Improved parsing of subscription pages with multiple feed format options
- Fixed SelectItem error in city search interface by properly handling "All States" option
- Added comprehensive US city website database with 19,000+ cities from CSV data
- Built city search functionality with filters for city name, state, and website availability 
- Created website validation system to identify parked domains, expired sites, and redirects
- Added visual indicators showing website status (valid, parked, expired, redirects)
- Integrated website checker that validates URLs and detects common issues like domain parking and "for sale" pages
- Enhanced navigation with dedicated City Search page accessible from header
- Provided detailed status messages to help users identify legitimate city websites vs parked domains

**2025-01-10**: Enhanced Interactive Feed Discovery System
- Implemented sophisticated calendar-first discovery approach that follows the complete user workflow:
  1. Finds calendar pages first (e.g., `/calendar.aspx`, `/events`)
  2. Looks for subscription buttons (`/rss.aspx`, `/iCalendar.aspx`) on those pages
  3. Follows those links to find "All" or "All Events" buttons with actual feed URLs
- Added support for ModID/CID parameter patterns (e.g., `/RSSFeed.aspx?ModID=58&CID=All-calendar.xml`) found in government CMS systems
- Enhanced feed validation to distinguish actual feed content from HTML subscription pages 
- Created flexible regex patterns to extract feed URLs from various subscription page formats
- Successfully validated working feeds from Hemet City Government showing real calendar events
- System now handles feeds that traditionally required clicking download buttons or navigating category selection interfaces
- Multi-step discovery process matches actual user behavior on government websites

**2025-01-09**: Complete District-to-Calendar Integration
- Implemented full congressional district click functionality - clicking a district automatically discovers feeds for all cities within that district
- Enhanced backend to auto-sync events from all discovered district feeds immediately upon selection
- District selection now automatically adds all cities to user's location filter and loads their events
- Added multiple city selection directly from calendar interface with "Add City" button and auto-suggestions
- Created "Reload Events" button that syncs events only for user's selected locations, not all sources
- Fixed event synchronization to work properly with location-specific filtering

**2025-01-08**: Disabled Event Preloading 
- Removed automatic event collection on server startup per user preference
- Events now only load when users actively select locations or discover feeds
- Updated scheduled sync to only run for already discovered sources
- Server startup is now faster and respects user preference for on-demand loading

**2025-01-08**: Enhanced Congressional District Feed Discovery Feature
- Implemented congressional district overlays on the interactive map with fallback data when Census API is unavailable
- Added comprehensive district-to-city mapping for major metropolitan areas across multiple states (CA, TX, NY, FL, IL, PA, OH, GA, NC, MI)
- Created robust backend endpoints with proper error handling and authentic district boundaries
- Enhanced map selector with "Show Districts" button, district selection feedback, and comprehensive FIPS code mapping
- Integrated with existing feed discovery system to automatically find calendar sources across entire congressional districts
- Added graceful degradation when external APIs are temporarily unavailable while maintaining full functionality

**2025-01-08**: Fixed TypeScript compilation errors in error handling code
- Resolved "Failed to add feed" TypeScript errors in filter-sidebar.tsx and location-selector.tsx
- Updated error object creation to use proper TypeScript intersection types instead of unsafe type casting
- All feed management functionality now works without TypeScript compilation issues

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
- **Feature Components**: Calendar view, event modals, filter sidebar, and header with interactive map selection
- **Layout System**: Responsive grid layout with mobile-first design
- **Accessibility**: Built-in accessibility features through Radix UI primitives
- **Interactive Map**: OpenStreetMap-based location selector with city markers and reverse geocoding

The calendar component provides both calendar and list views with event filtering and search capabilities. The MapSelector component allows users to choose locations by clicking on an interactive map with city markers or anywhere on the map for reverse geocoding.

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
- **MapLibre GL**: Interactive map rendering with OpenStreetMap tiles
- **OpenStreetMap**: Free map tiles and Nominatim geocoding service

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