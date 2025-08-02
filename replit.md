# Overview

CityWide Events is a local events aggregation platform that collects and displays community events from various sources like city websites, schools, and community centers. The application features a calendar view, filtering capabilities, and detailed event information to help users discover local activities and events in their area.

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

## Data Storage

The application uses a flexible storage architecture:

- **Current Implementation**: In-memory storage with mock data for development
- **Database Schema**: Designed for PostgreSQL with Drizzle ORM
- **Migration Strategy**: Drizzle Kit for database migrations and schema management
- **Future Integration**: Ready to connect to Neon Database or other PostgreSQL providers

The schema defines events with comprehensive fields including categorization, location, timing, and metadata for source tracking.

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