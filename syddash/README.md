# syddash

A static "Sydney Today" dashboard, meant to be served at the `syddash` subdomain
(e.g. `syddash.<your-domain>`). Point that subdomain's web root at this folder.

It shows:

- **Local time** in Sydney (Australia/Sydney, handles AEST/AEDT automatically).
- **Current weather** from [Open-Meteo](https://open-meteo.com/) (no API key), refreshed every 10 minutes.
- **Next plane to land at SYD**, estimated from live ADS-B positions
  ([adsb.lol](https://adsb.lol/), falling back to [airplanes.live](https://airplanes.live/); no API key),
  refreshed every 30 seconds. Aircraft are counted as arriving when they are descending or low,
  within 70 nm of the airport and heading toward it (or on a downwind/base leg nearby).
  The ETA is an estimate, not an airline schedule.

No build step: `index.html`, `style.css` and `app.js` are all there is.
To try it locally, run `python3 -m http.server` in this folder and open http://localhost:8000.
