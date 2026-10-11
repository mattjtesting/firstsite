(() => {
  const TZ = 'Australia/Sydney';
  const CITY = { lat: -33.8688, lon: 151.2093 };
  const SYD = { lat: -33.9461, lon: 151.1772, elevationFt: 21 };
  const SEARCH_RADIUS_NM = 80;

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- Clock ----------

  const timeFmt = new Intl.DateTimeFormat('en-AU', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const shortTimeFmt = new Intl.DateTimeFormat('en-AU', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
  const dateFmt = new Intl.DateTimeFormat('en-AU', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const zoneFmt = new Intl.DateTimeFormat('en-AU', { timeZone: TZ, timeZoneName: 'short' });
  const offsetFmt = new Intl.DateTimeFormat('en-AU', { timeZone: TZ, timeZoneName: 'longOffset' });

  function zonePart(fmt, now) {
    const p = fmt.formatToParts(now).find((x) => x.type === 'timeZoneName');
    return p ? p.value : '';
  }

  function tick() {
    const now = new Date();
    $('clock').textContent = timeFmt.format(now);
    $('date').textContent = dateFmt.format(now);
    $('tz').textContent = `${zonePart(zoneFmt, now)} (${zonePart(offsetFmt, now)})`;
  }

  tick();
  setInterval(tick, 1000);

  // ---------- Weather (Open-Meteo, no key) ----------

  const WMO = {
    0: ['Clear sky', '☀️', '🌙'], 1: ['Mainly clear', '🌤️', '🌙'], 2: ['Partly cloudy', '⛅', '☁️'], 3: ['Overcast', '☁️'],
    45: ['Fog', '🌫️'], 48: ['Freezing fog', '🌫️'],
    51: ['Light drizzle', '🌦️'], 53: ['Drizzle', '🌦️'], 55: ['Heavy drizzle', '🌧️'],
    56: ['Freezing drizzle', '🌧️'], 57: ['Freezing drizzle', '🌧️'],
    61: ['Light rain', '🌦️'], 63: ['Rain', '🌧️'], 65: ['Heavy rain', '🌧️'],
    66: ['Freezing rain', '🌧️'], 67: ['Freezing rain', '🌧️'],
    71: ['Light snow', '🌨️'], 73: ['Snow', '🌨️'], 75: ['Heavy snow', '❄️'], 77: ['Snow grains', '🌨️'],
    80: ['Light showers', '🌦️'], 81: ['Showers', '🌧️'], 82: ['Violent showers', '⛈️'],
    85: ['Snow showers', '🌨️'], 86: ['Heavy snow showers', '❄️'],
    95: ['Thunderstorm', '⛈️'], 96: ['Thunderstorm with hail', '⛈️'], 99: ['Thunderstorm with hail', '⛈️'],
  };
  const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const compass = (deg) => COMPASS[Math.round(deg / 22.5) % 16];

  async function loadWeather() {
    const url = 'https://api.open-meteo.com/v1/forecast'
      + `?latitude=${CITY.lat}&longitude=${CITY.lon}&timezone=${encodeURIComponent(TZ)}`
      + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m,wind_direction_10m,precipitation'
      + '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset&forecast_days=1';
    const el = $('weather');
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      const c = d.current;
      const day = d.daily;
      const [desc, dayIcon, nightIcon] = WMO[c.weather_code] || ['Unknown', '🌡️'];
      const icon = c.is_day ? dayIcon : (nightIcon || dayIcon);
      const hhmm = (iso) => iso.slice(11, 16); // already in Sydney time

      el.className = '';
      el.innerHTML = `
        <div class="wx-main">
          <span class="wx-icon" aria-hidden="true">${icon}</span>
          <div>
            <div class="wx-temp">${Math.round(c.temperature_2m)}°C</div>
            <div class="wx-desc">${esc(desc)}</div>
          </div>
        </div>
        <dl class="stats">
          <div><dt>Feels like</dt><dd>${Math.round(c.apparent_temperature)}°C</dd></div>
          <div><dt>Today</dt><dd>${Math.round(day.temperature_2m_min[0])}° / ${Math.round(day.temperature_2m_max[0])}°</dd></div>
          <div><dt>Wind</dt><dd>${Math.round(c.wind_speed_10m)} km/h ${compass(c.wind_direction_10m)}</dd></div>
          <div><dt>Humidity</dt><dd>${Math.round(c.relative_humidity_2m)}%</dd></div>
          <div><dt>Rain chance</dt><dd>${day.precipitation_probability_max[0] ?? '–'}%</dd></div>
          <div><dt>UV max</dt><dd>${day.uv_index_max[0] != null ? Math.round(day.uv_index_max[0]) : '–'}</dd></div>
          <div><dt>Sunrise</dt><dd>${hhmm(day.sunrise[0])}</dd></div>
          <div><dt>Sunset</dt><dd>${hhmm(day.sunset[0])}</dd></div>
        </dl>
        <p class="muted small">Updated ${shortTimeFmt.format(new Date())}</p>`;
    } catch (err) {
      el.className = 'state error';
      el.textContent = `Couldn't load weather (${err.message}). Retrying shortly.`;
    }
  }

  loadWeather();
  setInterval(loadWeather, 10 * 60 * 1000);

  // ---------- Next arrival (live ADS-B) ----------

  const FEEDS = [
    `https://api.adsb.lol/v2/lat/${SYD.lat}/lon/${SYD.lon}/dist/${SEARCH_RADIUS_NM}`,
    `https://api.airplanes.live/v2/point/${SYD.lat}/${SYD.lon}/${SEARCH_RADIUS_NM}`,
  ];

  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;

  function distanceNm(a, b) {
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * 3440.065 * Math.asin(Math.sqrt(h));
  }

  function bearing(a, b) {
    const y = Math.sin(toRad(b.lon - a.lon)) * Math.cos(toRad(b.lat));
    const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat))
      - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lon - a.lon));
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  const angleDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

  // Decide whether an aircraft looks like it is arriving at SYD and, if so, estimate minutes to touchdown.
  function estimateArrival(ac) {
    if (typeof ac.lat !== 'number' || typeof ac.lon !== 'number') return null;
    if (typeof ac.alt_baro !== 'number') return null; // "ground" or missing
    const gs = ac.gs;
    if (typeof gs !== 'number' || gs < 110) return null; // excludes helicopters & light aircraft (e.g. into Bankstown)

    const alt = ac.alt_baro;
    const vrate = typeof ac.baro_rate === 'number' ? ac.baro_rate : (typeof ac.geom_rate === 'number' ? ac.geom_rate : null);
    const dist = distanceNm(ac, SYD);
    const toAirport = bearing(ac, SYD);
    const track = typeof ac.track === 'number' ? ac.track : null;
    const off = track == null ? 90 : angleDiff(track, toAirport);

    if (vrate != null && vrate > 300) return null; // climbing: departure or overflight
    if (dist > 70 || alt > 20000) return null;

    // A typical 3° approach loses ~300 ft per nm. Ignore aircraft far too high for their distance (cruising overhead).
    const maxAltForDist = 3000 + dist * 400;
    if (alt > maxAltForDist) return null;

    const descending = vrate != null && vrate < -200;
    const low = alt - SYD.elevationFt < 4000;
    if (!descending && !low) return null;

    let pathNm;
    if (off <= 45) {
      pathNm = dist * 1.1;
    } else if (dist < 30 && (descending || low)) {
      // On a downwind or base leg: assume it still has to fly out and turn back in.
      pathNm = dist * (1.3 + off / 180) + 4;
    } else {
      return null;
    }

    // Aircraft slow down on approach; use an average of current and approach speed.
    const avgKts = Math.max(140, (gs + 150) / 2);
    const minutes = (pathNm / avgKts) * 60;
    return { minutes, dist, alt, gs, vrate };
  }

  async function fetchAircraft() {
    let lastErr;
    for (const url of FEEDS) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.ac || data.aircraft || [];
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error('No feed available');
  }

  const routeCache = new Map();

  // Best-effort origin lookup by callsign; failure is fine.
  async function lookupRoute(ac) {
    const cs = (ac.flight || '').trim();
    if (!cs) return null;
    if (routeCache.has(cs)) return routeCache.get(cs);
    try {
      const res = await fetch('https://api.adsb.lol/api/0/routeset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planes: [{ callsign: cs, lat: ac.lat, lng: ac.lon }] }),
      });
      if (!res.ok) throw new Error();
      const [r] = await res.json();
      const airports = r && r._airports;
      let route = null;
      if (airports && airports.length >= 2) {
        const dest = airports[airports.length - 1];
        if (dest.iata === 'SYD' || dest.icao === 'YSSY') {
          const from = airports[airports.length - 2];
          route = { from: from.location || from.name || from.iata, fromCode: from.iata || from.icao };
        }
      }
      routeCache.set(cs, route);
      return route;
    } catch {
      return null;
    }
  }

  const label = (ac) => (ac.flight || '').trim() || ac.r || ac.hex.toUpperCase();
  const etaText = (m) => (m < 1 ? 'under a minute' : `~${Math.round(m)} min`);
  const etaClock = (m) => shortTimeFmt.format(new Date(Date.now() + m * 60000));

  async function loadFlights() {
    const el = $('flight');
    const queue = $('queue');
    try {
      const aircraft = await fetchAircraft();
      const arrivals = aircraft
        .map((ac) => ({ ac, est: estimateArrival(ac) }))
        .filter((x) => x.est)
        .sort((a, b) => a.est.minutes - b.est.minutes);

      $('flight-updated').textContent = `Last checked ${shortTimeFmt.format(new Date())}.`;

      if (!arrivals.length) {
        el.className = 'state';
        el.textContent = aircraft.length
          ? 'No aircraft are on approach to SYD right now. (Sydney has a curfew from 11pm to 6am.)'
          : 'No aircraft are visible near Sydney right now.';
        queue.hidden = true;
        return;
      }

      const { ac, est } = arrivals[0];
      const type = [ac.desc || ac.t, ac.r].filter(Boolean).join(' · ');
      el.className = '';
      el.innerHTML = `
        <div class="flight-head">
          <span class="callsign">${esc(label(ac))}</span>
          <span class="eta">Lands in ${etaText(est.minutes)} · about ${etaClock(est.minutes)}</span>
        </div>
        <p id="route" class="muted">${type ? esc(type) : '&nbsp;'}</p>
        <dl class="stats">
          <div><dt>Distance</dt><dd>${est.dist.toFixed(1)} nm</dd></div>
          <div><dt>Altitude</dt><dd>${Math.round(est.alt).toLocaleString('en-AU')} ft</dd></div>
          <div><dt>Ground speed</dt><dd>${Math.round(est.gs)} kt</dd></div>
          <div><dt>Vertical rate</dt><dd>${est.vrate != null ? `${Math.round(est.vrate)} ft/min` : '–'}</dd></div>
        </dl>`;

      const rest = arrivals.slice(1, 5);
      queue.hidden = !rest.length;
      queue.start = 2;
      queue.innerHTML = rest
        .map(({ ac: a, est: e }) => `<li><strong>${esc(label(a))}</strong> ${a.t ? `(${esc(a.t)})` : ''} — ${etaText(e.minutes)}, ${e.dist.toFixed(0)} nm out</li>`)
        .join('');

      const route = await lookupRoute(ac);
      if (route && $('route')) {
        const from = `From ${route.from}${route.fromCode ? ` (${route.fromCode})` : ''}`;
        $('route').textContent = type ? `${from} · ${type}` : from;
      }
    } catch (err) {
      el.className = 'state error';
      el.textContent = `Couldn't load live aircraft data (${err.message}). Retrying shortly.`;
      queue.hidden = true;
    }
  }

  loadFlights();
  setInterval(loadFlights, 30 * 1000);
})();
