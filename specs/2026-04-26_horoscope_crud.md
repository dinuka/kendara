# Spec — 2026-04-26 Horoscope crud

## Context

I need to create crud functionality for the horoscope.

## Goal

Auth user should possible to add/edit/delete/list and see single horoscope with good UX.

## Backend changes

- Should have endpoints for CRUD function.
- Horoscope model should like this. In future this will include more data.

```
interface Horoscope {
  id: string;
  name: string;
  birthTime: Date;
  timezone: number;
  location: {
    latitude: number;
    longitude: number;
  };
}
```

- Only auth users should possible to access this.

## Frontend changes

- As the 10x UX engineer need to add CURD functionality for horoscopes.
- Should have a page for seen horoscopes.
- It should have a small form for adding Horoscope data, name, birth date, birth time, etc...
- Should possible to edit and delete horoscope.
- In future this will include graha charts, dasha charts, and reports, etc...
- Only auth users should possible to access the Horoscopes.

## Acceptance criteria

- After the change, user should have nice UX experience with Horoscope section

## Out of scope

- No need to do any calculations for grah charts, etc...
