export interface Session {
  id: number;
  user_id: number;
  start_time: string;
  end_time: string;
  sport?: string;
  distance_km?: number;
  avg_hr?: number;
  calories?: number;
  steps?: number;
  lat: number;
  lon: number;
  spo2_pct?: number;
}

export interface WeatherObservation {
  timestamp: string;
  temperature_c?: number;
  apparent_temp_c?: number;
  humidity_pct?: number;
  precipitation_mm?: number;
  wind_speed_ms?: number;
}
