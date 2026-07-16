# Kendara

- This app for astrology students for analyzing their horoscope database for studying the Astrology concepts.
- The system should support to Sinhala and English language
- Students are main role of the system.
- There should be super admin for handling students and horoscope with full access.

## Main flows

### Authentication

- User need to use Google SSO for login to the system.
- The system automatically assign the student role.

### Add horoscope

- Student should possible to add horoscopes by giving following details
  - Name of the person
  - Birth date and time
  - Location - the system should find Lan/Lon values based on the location
  - Or Latitude/Lognatiute
  - Gendar
  - Ayanamsha - Default is Lahiri

- The system should calculate following horoscope details using above inputs
  - Ascendant / Rising Sign (with degree)
  - House (Bhava) details (start, middle, end)
  - Planet (Graha) positions
  - Lunar Mansion / Nakshatra and Pada / Quarter
  - Mahadasha, Antardasha / Bhukti, etc...

- Using those calculated values the system should calculate following values also
  - Planetary Strength (උච්ච. නීච, සතුරු, etc...)
  - Planetary Aspect with degree.
  - Lord of the 22nd Drekkana
  - Lord of the 64th Navamsa
  - Badhaka Planet / Badhakesh
  - Maraka Planets
  - Atmakaraka / Atmakaraka Planet
  - Yoga
  - Dosha
  
- Using those calculated values the system should draw following carts
  - Birth Chart
  - House chart
  - Navamsa (D9 Chart)
  - Drekkana (D3 Chart)
  - Dasamsa (D10 Chart)
  - Shodasha Vargas / Divisional Charts
  - Divisional Chart (Varga)
  - Chandra Lagna (Moon Ascendant) chart
  - Surya Lagna (Solar Ascendant) chart
- Student need to mark the horoscope as private or public. He can determine the name needs to show or hide.

### Search horoscope

- This is main objective of this project
- Student should possible to see his added horoscopes and public horoscopes.
- He can filter horoscopes result by giving search items like these sentences
  - මේෂ ලග්නය (Then system should filter all horoscope with Aries Ascendant)
  - ශනි උච්ච (- all horoscope with Saturn is Exaltation)
  - ගුරු 3 (- all horoscope with Jupiter in the 3rd house)

- Also he can give complext search sentences
  - මේෂ ලග්නයේ ශනි උච්චව ගුරු 3 භාවයේ ඇති ගුරුට සුබ දෘෂ්ඨි නොවැටෙන
  - පරිවර්තන යෝග තිබෙන
  - රැකියාව ගුරු වෘත්තිය විය හැකි

- The system should show the all calculated results for search phrases. But user should possible to hide and show what he needed. As example some user need only show the birth chart. not other charts. Then the system should show a configure panel for hidden other charts and calculations

### Update metadata

- The student should possible to add labels, tags and metadata to horoscope for making easy of his studies.
  - As example he should possible to add
    - the job of the horoscope owner, children count, skills, etc..
    - remove the calculated yoga if it is not correct
- He should possible to do this for public horoscope as well. he should possible to toggle those metadata are public or private

### Share horoscope

- Student should possible to mark his horoscope as private or public
- He can generate link for sharing  his private horoscope temporally.
- He should possible to download horoscopes as pdf or image

### Super Admin

- Should possible to see all horoscopes
- He can update horoscopes and delete public horoscopes
- He can manage users

## Architecture

- Need to use free libraries and Ai agents
- Need to use offline libraries for all calculations
- Need to use a good vector db for keeping embedding horoscopes.
- Need to implement a RAG pipeline for horoscope search
