# Actors

## 1. Student

- **Description**: Primary user of the system. An astrology student who studies horoscopes.
- **Goals**: Add and manage horoscopes, search and filter horoscopes for study, apply metadata/labels for research, share horoscopes
- **Permissions**:
  - Add/edit/delete own horoscopes
  - View public horoscopes
  - Search horoscopes using basic and complex queries
  - Add labels/tags/metadata to own and public horoscopes (toggle public/private)
  - Mark own horoscopes as public or private
  - Generate share links for private horoscopes
  - Download horoscopes as PDF/image
  - Configure visible chart sections
  - Use system in Sinhala or English
  - View all public locations
  - View own private locations
  - Add new locations with name suggestion via API and auto-populated Lat/Lon
  - Add locations by pasting CSV-formatted Lat/Lon values
  - Toggle own locations as public or private
  - Edit/delete own locations
  - Select from saved locations when adding horoscopes
  - Override Lat/Lon values on horoscope after location selection
  - View full dasha timeline showing Mahadasha, Antardasha, Vidasa, Sukshama, and Prana periods
  - Expand/collapse dasha hierarchy with nested accordion UI
  - View automatically expanded current active period at all dasha levels
- **Authentication**: Google SSO (auto-assigned)

## 2. Super Admin

- **Description**: System administrator with full access to manage the platform.
- **Goals**: Manage all horoscopes, manage users, ensure system integrity
- **Permissions**:
  - View all horoscopes (public and private)
  - Update any horoscope
  - Delete public horoscopes
  - Manage users (activate/deactivate, assign roles)
  - Full system access
- **Authentication**: Google SSO (manually assigned)

## 3. System (Background Services)

- **Description**: Automated services that perform calculations and background tasks.
- **Goals**: Calculate horoscope details, generate charts, process search queries
- **Responsibilities**:
  - Calculate Ascendant/Rising Sign, House details, Planet positions, Nakshatra/Pada, Dashas
  - Calculate Planetary Strength, Aspects, Lords, Badhaka, Maraka, Atmakaraka, Yoga, Dosha
  - Generate Birth Chart, House Chart, Navamsa (D9), Drekkana (D3), Dasamsa (D10), Shodasha Vargas, Chandra Lagna, Surya Lagna
  - Process RAG-based search queries
  - Geocode location to Lat/Lon
