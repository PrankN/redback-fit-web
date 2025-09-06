import { useEffect, useMemo, useState } from "react";
import { getSessions, getSessionWeather } from "../../services/api";
import type { Session, WeatherObservation } from "../../types/session";

/** Extend the Session type locally with optional UI-only fields (dummy/derived) */
type UISession = Session & {
  coach?: string;            // dummy
  training_type?: string;    // dummy
  vo2max?: number;           // dummy
  duration_minutes?: number; // derived
  pace_min_per_km?: number;  // derived
};

type ColumnKey =
  | "id" | "start" | "end" | "duration" | "pace"
  | "sport" | "distance" | "calories" | "avg_hr" | "steps"
  | "spo2" | "vo2max" | "coach" | "training" | "weather";

const defaultVisible: Record<ColumnKey, boolean> = {
  id: true,
  start: true,
  end: false,
  duration: true,
  pace: false,
  sport: true,
  distance: true,
  calories: false,
  avg_hr: false,
  steps: false,
  spo2: true,
  vo2max: false,
  coach: false,
  training: false,
  weather: true,
};

function formatLocal(dtISO: string) {
  const d = new Date(dtISO);
  return d.toLocaleString();
}
function minutesBetween(aISO: string, bISO: string) {
  const a = new Date(aISO).getTime();
  const b = new Date(bISO).getTime();
  return Math.max(0, (b - a) / 60000);
}
function paceMinPerKm(distanceKm?: number, minutes?: number) {
  if (!distanceKm || distanceKm <= 0 || !minutes || minutes <= 0) return undefined;
  return minutes / distanceKm;
}
function fmtPace(minPerKm?: number) {
  if (!minPerKm) return "—";
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${s.toString().padStart(2, "0")}/km`;
}
function pickClosest(observations: WeatherObservation[], isoTime: string) {
  if (!observations?.length) return undefined;
  const target = new Date(isoTime).getTime();
  let best = observations[0];
  let bestDiff = Math.abs(new Date(best.timestamp).getTime() - target);
  for (const o of observations) {
    const diff = Math.abs(new Date(o.timestamp).getTime() - target);
    if (diff < bestDiff) { best = o; bestDiff = diff; }
  }
  return best;
}

const th: React.CSSProperties = { textAlign: "left", padding: 8, borderBottom: "1px solid #eee" };
const td: React.CSSProperties = { padding: 8, borderBottom: "1px solid #f2f2f2" };

export default function SessionsPage() {
  const [rows, setRows] = useState<UISession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<UISession | null>(null);
  const [weatherById, setWeatherById] = useState<Record<number, WeatherObservation[]>>({});
  const [visibleCols, setVisibleCols] = useState(defaultVisible);

  // Simple filters
  const [fromDate, setFromDate] = useState<string>("");  // yyyy-mm-dd
  const [toDate, setToDate] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const data = await getSessions();

        // ---- DUMMY/DERIVED ENRICHMENT ----
        const coaches = ["Sarah Eastern", "John Mitchell", "Linda Carter"];
        const trainings = ["Strength", "Cardio", "Flexibility", "Team Practice", "Tempo", "Intervals"];

        const enriched: UISession[] = data.map((s, idx) => {
          const duration = minutesBetween(s.start_time, s.end_time);
          const pace = paceMinPerKm(s.distance_km, duration);

          return {
            ...s,
            // Keep backend spo2 if present, else dummy 94–99
            spo2_pct: s.spo2_pct ?? Math.floor(94 + Math.random() * 6),
            // Dashboard-inspired dummy fields
            coach: coaches[idx % coaches.length],
            training_type: trainings[idx % trainings.length],
            vo2max: Math.floor(45 + Math.random() * 20), // 45–64 approximate
            // Derived
            duration_minutes: duration,
            pace_min_per_km: pace,
          };
        });
        // -----------------------------------

        setRows(enriched);
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onRowClick(s: UISession) {
    setSelected(s);
    if (!weatherById[s.id]) {
      try {
        const wx = await getSessionWeather(s.id);
        setWeatherById(prev => ({ ...prev, [s.id]: wx }));
      } catch (e) {
        console.error("weather fetch failed", e);
      }
    }
  }

  const filtered = useMemo(() => {
    if (!fromDate && !toDate) return rows;
    const from = fromDate ? new Date(fromDate).getTime() : -Infinity;
    const to   = toDate   ? new Date(toDate).getTime()   : +Infinity;
    return rows.filter(r => {
      const t = new Date(r.start_time).getTime();
      return t >= from && t <= to;
    });
  }, [rows, fromDate, toDate]);

  function toggleCol(k: ColumnKey) {
    setVisibleCols(v => ({ ...v, [k]: !v[k] }));
  }

  function renderSpo2(val?: number) {
    if (val == null) return "—";
    const color = val < 95 ? "crimson" : val < 97 ? "orange" : "green";
    return <span style={{ color }}>{val}%</span>;
  }

  return (
    // Tighter right padding; left padding matches sidebar width
    <div style={{ padding: "24px 12px 24px 0px", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <h2 style={{ margin: 0, flex: "0 0 auto" }}>Sessions</h2>

        {/* Filters dropdown */}
        <details style={{ marginLeft: "auto", flex: "0 0 auto", position: "relative" }}>
          <summary
            style={{
              listStyle: "none", cursor: "pointer",
              padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6,
              userSelect: "none", background: "#fff"
            }}
          >
            Filters ▾
          </summary>
          <div
            style={{
              position: "absolute", right: 0, marginTop: 6, zIndex: 20,
              background: "#fff", border: "1px solid #e6e6e6", borderRadius: 8,
              padding: 12, width: 420, boxShadow: "0 10px 20px rgba(0,0,0,0.08)"
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Columns</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              {(
                [
                  "id","start","end","duration","pace","sport","distance",
                  "calories","avg_hr","steps","spo2","vo2max","coach","training","weather",
                ] as ColumnKey[]
              ).map(k => (
                <label key={k} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                  <input type="checkbox" checked={visibleCols[k]} onChange={() => toggleCol(k)} />
                  {{
                    spo2: "SpO₂",
                    vo2max: "VO₂ Max",
                    avg_hr: "Avg HR",
                    pace: "Pace",
                    training: "Training",
                    distance: "Distance",
                  }[k] || k[0].toUpperCase() + k.slice(1)}
                </label>
              ))}
            </div>

            <div style={{ fontWeight: 600, marginBottom: 8 }}>Date range</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                From <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              </label>
              <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                To <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
              </label>
              <button
                onClick={() => { setFromDate(""); setToDate(""); }}
                style={{ marginLeft: "auto" }}
              >
                Clear
              </button>
            </div>
          </div>
        </details>
      </div>

      {loading && <div>Loading…</div>}
      {error && <div style={{ color: "crimson" }}>Error: {error}</div>}
      {!loading && !filtered.length && <div>No sessions. Add one, then refresh.</div>}

      {!!filtered.length && (
        // Tighter grid gap to reduce visible whitespace near scrollbar
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 12 }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #e5e5e5" }}>
              <thead>
                <tr>
                  {visibleCols.id && <th style={th}>ID</th>}
                  {visibleCols.start && <th style={th}>Start</th>}
                  {visibleCols.end && <th style={th}>End</th>}
                  {visibleCols.duration && <th style={th}>Duration</th>}
                  {visibleCols.pace && <th style={th}>Pace</th>}
                  {visibleCols.sport && <th style={th}>Sport</th>}
                  {visibleCols.distance && <th style={th}>Distance (km)</th>}
                  {visibleCols.calories && <th style={th}>Calories</th>}
                  {visibleCols.avg_hr && <th style={th}>Avg HR</th>}
                  {visibleCols.steps && <th style={th}>Steps</th>}
                  {visibleCols.spo2 && <th style={th}>SpO₂ (%)</th>}
                  {visibleCols.vo2max && <th style={th}>VO₂ Max</th>}
                  {visibleCols.coach && <th style={th}>Coach</th>}
                  {visibleCols.training && <th style={th}>Training</th>}
                  {visibleCols.weather && <th style={th}>Weather</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const wx = weatherById[r.id];
                  const close = wx ? pickClosest(wx, r.start_time) : undefined;
                  const badge = close
                    ? `${(close.temperature_c ?? 0).toFixed(1)}°C, ${(close.precipitation_mm ?? 0).toFixed(1)}mm`
                    : "Click row…";

                  const durStr = r.duration_minutes != null
                    ? `${Math.floor(r.duration_minutes)}m`
                    : "—";

                  return (
                    <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => onRowClick(r)}>
                      {visibleCols.id && <td style={td}>{r.id}</td>}
                      {visibleCols.start && <td style={td}>{formatLocal(r.start_time)}</td>}
                      {visibleCols.end && <td style={td}>{formatLocal(r.end_time)}</td>}
                      {visibleCols.duration && <td style={td}>{durStr}</td>}
                      {visibleCols.pace && <td style={td}>{fmtPace(r.pace_min_per_km)}</td>}
                      {visibleCols.sport && <td style={td}>{r.sport ?? "—"}</td>}
                      {visibleCols.distance && <td style={td}>{r.distance_km ?? 0}</td>}
                      {visibleCols.calories && <td style={td}>{r.calories ?? "—"}</td>}
                      {visibleCols.avg_hr && <td style={td}>{r.avg_hr ?? "—"}</td>}
                      {visibleCols.steps && <td style={td}>{r.steps ?? "—"}</td>}
                      {visibleCols.spo2 && <td style={td}>{renderSpo2(r.spo2_pct)}</td>}
                      {visibleCols.vo2max && <td style={td}>{r.vo2max ?? "—"}</td>}
                      {visibleCols.coach && <td style={td}>{r.coach ?? "—"}</td>}
                      {visibleCols.training && <td style={td}>{r.training_type ?? "—"}</td>}
                      {visibleCols.weather && <td style={td}>{wx ? badge : <span style={{ opacity: .7 }}>Click row…</span>}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Details panel */}
          <aside style={{ border: "1px solid #e6e6e6", borderRadius: 8, padding: 12, height: "fit-content" }}>
            <h3 style={{ marginTop: 0 }}>Details</h3>
            {!selected && <div>Select a session…</div>}
            {selected && (
              <>
                <div><strong>Session #{selected.id}</strong></div>
                <div>Start: {formatLocal(selected.start_time)}</div>
                <div>End: {formatLocal(selected.end_time)}</div>
                <div>Duration: {selected.duration_minutes != null ? `${Math.floor(selected.duration_minutes)}m` : "—"}</div>
                <div>Distance: {selected.distance_km ?? 0} km</div>
                <div>Pace: {fmtPace(selected.pace_min_per_km)}</div>
                <div>Avg HR: {selected.avg_hr ?? "—"}</div>
                <div>Calories: {selected.calories ?? "—"}</div>
                <div>Steps: {selected.steps ?? "—"}</div>
                <div>SpO₂: {renderSpo2(selected.spo2_pct)}</div>
                <div>VO₂ Max: {selected.vo2max ?? "—"}</div>
                <div>Coach: {selected.coach ?? "—"}</div>
                <div>Training: {selected.training_type ?? "—"}</div>
                <div>Lat/Lon: {selected.lat}, {selected.lon}</div>
                <hr />
                <div><strong>Weather near start</strong></div>
                {weatherById[selected.id]
                  ? (() => {
                      const c = pickClosest(weatherById[selected.id], selected.start_time);
                      return c
                        ? <div>{(c.temperature_c ?? 0).toFixed(1)}°C | {(c.humidity_pct ?? 0).toFixed(0)}% RH | {(c.wind_speed_ms ?? 0).toFixed(1)} m/s | {(c.precipitation_mm ?? 0).toFixed(1)} mm</div>
                        : <div>No observation.</div>;
                    })()
                  : <div>Loading…</div>
                }
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
