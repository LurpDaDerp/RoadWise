// utils/weather.js
export async function fetchWeather(lat, lon) {
  try {
    // Weather API
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,precipitation_probability,visibility,windspeed_10m,weathercode&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&windspeed_unit=mph&precipitation_unit=inch&timezone=auto`;

    // Air Quality API
    const airQualityUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5,carbon_monoxide,ozone,uv_index,us_aqi&timezone=auto`;

    const [weatherRes, airRes] = await Promise.all([
      fetch(weatherUrl),
      fetch(airQualityUrl),
    ]);

    if (!weatherRes.ok) throw new Error("Weather fetch failed");
    if (!airRes.ok) throw new Error("Air quality fetch failed");

    const [weather, airQuality] = await Promise.all([
      weatherRes.json(),
      airRes.json(),
    ]);

    return { ...weather, airQuality };
  } catch (err) {
    console.error("Weather fetch error:", err);
    return null;
  }
}


export async function getWeatherIconName(code) {
  switch (code) {
    case 0: return "weather-sunny";              // Clear sky
    case 1: return "weather-sunny";              // Mainly clear
    case 2: return "weather-partly-cloudy";      // Partly cloudy
    case 3: return "weather-cloudy";             // Overcast
    case 45:
    case 48: return "weather-fog";               // Fog
    case 51:
    case 53:
    case 55: return "weather-rainy";             // Drizzle
    case 61:
    case 63:
    case 65: return "weather-pouring";           // Rain
    case 71:
    case 73:
    case 75: return "weather-snowy";             // Snow
    case 80:
    case 81:
    case 82: return "weather-rainy";             // Showers
    case 95:
    case 96:
    case 99: return "weather-lightning";         // Thunderstorm
    default: return "weather-cloudy-alert";      // Unknown
  }
}
