import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartBar,
  CheckCircle,
  Database,
  FlowerLotus,
  FlowerTulip,
  FunnelSimple,
  House,
  Leaf,
  Plant,
  Ruler,
  Sparkle,
  SquaresFour,
  UsersThree,
  WarningCircle,
  Wind,
  X,
} from "@phosphor-icons/react";

const SPECIES_COLORS = {
  rose: "#ef7b72",
  "shoeblack plant": "#a78bc4",
  hibiscus: "#8ca66e",
};

const SIZE_COLORS = {
  small: "#f4c56e",
  medium: "#b9a3d2",
  large: "#ef7b72",
};

const PUBLIC_BASE = import.meta.env.BASE_URL;

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: House },
  { id: "species", label: "Species", icon: ChartBar },
  { id: "height", label: "Height", icon: Ruler },
  { id: "relationships", label: "Size & fragrance", icon: SquaresFour },
  { id: "personalities", label: "Personalities", icon: UsersThree },
  { id: "closing", label: "Closing insight", icon: Leaf },
];

const titleCase = (value) =>
  value.replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatNumber = new Intl.NumberFormat("en-US");

function parseCsv(text) {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const headers = headerLine.split(",");
  return lines
    .filter(Boolean)
    .map((line) => {
      const values = line.split(",");
      return Object.fromEntries(
        headers.map((header, index) => [
          header,
          header === "height_cm" ? Number(values[index]) : values[index],
        ]),
      );
    })
    .filter((row) => Number.isFinite(row.height_cm));
}

function quantile(values, percentile) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * percentile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function summarize(rows) {
  const heights = rows.map((row) => row.height_cm);
  const species = [...new Set(rows.map((row) => row.species))].sort();
  const sizes = [...new Set(rows.map((row) => row.size))];
  const fragrances = [...new Set(rows.map((row) => row.fragrance))];
  const average = heights.reduce((sum, value) => sum + value, 0) / rows.length;
  const sortedHeights = [...heights].sort((a, b) => a - b);
  const median = quantile(sortedHeights, 0.5);
  const q1 = quantile(sortedHeights, 0.25);
  const q3 = quantile(sortedHeights, 0.75);
  const lowerFence = q1 - 1.5 * (q3 - q1);
  const upperFence = q3 + 1.5 * (q3 - q1);

  const speciesData = species
    .map((name) => {
      const subset = rows.filter((row) => row.species === name);
      const values = subset.map((row) => row.height_cm);
      return {
        name,
        label: titleCase(name),
        count: subset.length,
        percent: (subset.length / rows.length) * 100,
        average: values.reduce((sum, value) => sum + value, 0) / values.length,
        median: quantile(values, 0.5),
        min: Math.min(...values),
        max: Math.max(...values),
      };
    })
    .sort((a, b) => b.count - a.count);

  const fragranceData = fragrances
    .map((fragrance) => {
      const subset = rows.filter((row) => row.fragrance === fragrance);
      return {
        fragrance,
        label: titleCase(fragrance),
        total: subset.length,
        ...Object.fromEntries(
          sizes.map((size) => [
            size,
            subset.filter((row) => row.size === size).length,
          ]),
        ),
      };
    })
    .sort((a, b) => ["strong", "mild", "none"].indexOf(a.fragrance) - ["strong", "mild", "none"].indexOf(b.fragrance));

  const mostCommonFragrance = fragranceData.reduce((top, item) =>
    item.total > top.total ? item : top,
  );

  const personaFor = (row) => {
    if (row.height_cm >= q3) return "showstoppers";
    if (row.height_cm <= q1) return "ground-huggers";
    if (row.fragrance === "strong") return "fragrant-souls";
    return "garden-friends";
  };

  const personaDefinitions = [
    {
      id: "showstoppers",
      name: "The Showstoppers",
      description: `Height at or above the upper quartile (${q3.toFixed(1)} cm).`,
      note: "Tall bloomers that draw the eye",
      color: "coral",
      icon: FlowerTulip,
    },
    {
      id: "garden-friends",
      name: "The Garden Friends",
      description: "Mid-height flowers with none or mild fragrance.",
      note: "Balanced flowers that bring harmony",
      color: "sage",
      icon: Plant,
    },
    {
      id: "fragrant-souls",
      name: "The Fragrant Souls",
      description: "Mid-height flowers with strong fragrance.",
      note: "Strong scent with a measured presence",
      color: "lavender",
      icon: Wind,
    },
    {
      id: "ground-huggers",
      name: "The Ground Huggers",
      description: `Height at or below the lower quartile (${q1.toFixed(1)} cm).`,
      note: "Delicate flowers that stay close",
      color: "sun",
      icon: FlowerLotus,
    },
  ].map((persona) => {
    const subset = rows.filter((row) => personaFor(row) === persona.id);
    return {
      ...persona,
      count: subset.length,
      percent: (subset.length / rows.length) * 100,
      median: quantile(subset.map((row) => row.height_cm), 0.5),
    };
  });

  return {
    total: rows.length,
    species,
    sizes,
    fragrances,
    speciesData,
    fragranceData,
    personas: personaDefinitions,
    average,
    median,
    q1,
    q3,
    min: Math.min(...heights),
    max: Math.max(...heights),
    outliers: heights.filter((height) => height < lowerFence || height > upperFence).length,
    mostCommonFragrance,
  };
}

function DataTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>{titleCase(String(label))}</strong>
      {payload.map((entry) => (
        <span key={entry.dataKey}>
          <i style={{ background: entry.color }} />
          {titleCase(entry.name)}: {formatNumber.format(entry.value)}
        </span>
      ))}
    </div>
  );
}

function MetricCard({ tone, icon: Icon, value, label, note }) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <span className="metric-icon" aria-hidden="true"><Icon size={28} weight="duotone" /></span>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
        <small>{note}</small>
      </div>
    </article>
  );
}

function FilterGroup({ label, options, value, onChange }) {
  return (
    <label className="filter-control">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="all">All {label.toLowerCase()}</option>
        {options.map((option) => (
          <option value={option} key={option}>{titleCase(option)}</option>
        ))}
      </select>
    </label>
  );
}

function LoadingState() {
  return (
    <main className="state-page" aria-live="polite">
      <FlowerLotus size={38} weight="duotone" />
      <h1>Growing the data garden…</h1>
      <p>Reading 10,000 flower records and preparing the story.</p>
    </main>
  );
}

function AppContent({ rows, duplicateCount }) {
  const initialSummary = useMemo(() => summarize(rows), [rows]);
  const [species, setSpecies] = useState("all");
  const [size, setSize] = useState("all");
  const [fragrance, setFragrance] = useState("all");
  const [activePersona, setActivePersona] = useState(null);
  const [showDataHealth, setShowDataHealth] = useState(false);

  const filteredRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          (species === "all" || row.species === species) &&
          (size === "all" || row.size === size) &&
          (fragrance === "all" || row.fragrance === fragrance),
      ),
    [rows, species, size, fragrance],
  );

  const summary = useMemo(
    () => (filteredRows.length ? summarize(filteredRows) : null),
    [filteredRows],
  );
  const filtersActive = species !== "all" || size !== "all" || fragrance !== "all";

  const resetFilters = () => {
    setSpecies("all");
    setSize("all");
    setFragrance("all");
    setActivePersona(null);
  };

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="app-shell">
      <aside className="chapter-rail" aria-label="Garden story chapters">
        <button className="brand" onClick={() => scrollTo("overview")} aria-label="Back to overview">
          <Leaf size={34} weight="duotone" />
          <span>The Living<br />Garden</span>
        </button>
        <nav>
          {NAV_ITEMS.map(({ id, label, icon: Icon }, index) => (
            <button key={id} onClick={() => scrollTo(id)}>
              <small>{String(index + 1).padStart(2, "0")}</small>
              <Icon size={22} weight="duotone" aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="rail-signoff">
          <img src={`${PUBLIC_BASE}assets/botanical-sprig.png`} alt="" />
          <span>A data garden that grows understanding.</span>
        </div>
      </aside>

      <main className="garden-page">
        <section className="hero" id="overview">
          <div className="hero-copy">
            <div className="eyebrow"><Sparkle size={16} weight="fill" /> A data story about a living garden</div>
            <h1>The Living Garden</h1>
            <p>10,000 flowers. Four simple traits—species, size, fragrance, and height—reveal a living garden of beauty and balance.</p>
          </div>
          <div className="hero-flourish" aria-hidden="true">
            <img src={`${PUBLIC_BASE}assets/botanical-sprig.png`} alt="" />
            <span>A joyful mix of<br />shape, scent, and height.</span>
          </div>
        </section>

        <section className="filter-bar" aria-label="Filter the garden">
          <div className="filter-title"><FunnelSimple size={20} weight="duotone" /><span>Explore the garden</span></div>
          <FilterGroup label="Species" options={initialSummary.species} value={species} onChange={setSpecies} />
          <FilterGroup label="Size" options={initialSummary.sizes} value={size} onChange={setSize} />
          <FilterGroup label="Fragrance" options={initialSummary.fragrances} value={fragrance} onChange={setFragrance} />
          <button className="data-health-button" onClick={() => setShowDataHealth((current) => !current)} aria-expanded={showDataHealth}>
            <Database size={18} weight="duotone" /> Dataset check
          </button>
          {filtersActive && <button className="reset-button" onClick={resetFilters}><X size={16} /> Reset</button>}
        </section>

        {showDataHealth && (
          <section className="data-health" aria-live="polite">
            <div><CheckCircle size={20} weight="fill" /><strong>Complete</strong><span>No missing values across four fields.</span></div>
            <div><CheckCircle size={20} weight="fill" /><strong>Clean categories</strong><span>3 species, 3 sizes, and 3 fragrance levels.</span></div>
            <div><WarningCircle size={20} weight="fill" /><strong>{formatNumber.format(duplicateCount)} repeats</strong><span>Exact duplicate rows are retained as source records.</span></div>
            <div><CheckCircle size={20} weight="fill" /><strong>{initialSummary.outliers} global outliers</strong><span>Using the 1.5× IQR height rule.</span></div>
          </section>
        )}

        {!summary ? (
          <section className="empty-state" aria-live="polite">
            <FlowerLotus size={44} weight="duotone" />
            <h2>No flowers match this combination</h2>
            <p>The garden has no records with all three selected traits. Reset the filters to continue exploring.</p>
            <button onClick={resetFilters}>Show the full garden</button>
          </section>
        ) : (
          <>
            <section className="metrics" aria-label="Garden summary">
              <MetricCard tone="coral" icon={FlowerLotus} value={formatNumber.format(summary.total)} label="Flowers in view" note={`${((summary.total / rows.length) * 100).toFixed(1)}% of the garden`} />
              <MetricCard tone="sage" icon={Leaf} value={summary.species.length} label="Species" note={summary.species.length === 1 ? titleCase(summary.species[0]) : "A balanced trio"} />
              <MetricCard tone="lavender" icon={Wind} value={titleCase(summary.mostCommonFragrance.fragrance)} label="Most common fragrance" note={`${((summary.mostCommonFragrance.total / summary.total) * 100).toFixed(1)}% of flowers`} />
              <MetricCard tone="sun" icon={Ruler} value={`${summary.average.toFixed(1)} cm`} label="Average height" note={`${summary.min.toFixed(1)}–${summary.max.toFixed(1)} cm range`} />
            </section>

            <section className="analysis-grid">
              <article className="analysis-panel" id="species">
                <header>
                  <div><span className="section-number">02</span><h2>Species distribution</h2></div>
                  <p>{summary.speciesData[0].label} appears most often in this view.</p>
                </header>
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={summary.speciesData} layout="vertical" margin={{ top: 6, right: 18, bottom: 8, left: 8 }}>
                      <CartesianGrid stroke="#e6e6d7" horizontal={false} />
                      <XAxis type="number" tick={{ fill: "#617062", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="label" width={110} tick={{ fill: "#283c2c", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<DataTooltip />} cursor={{ fill: "#f5f2e9" }} />
                      <Bar dataKey="count" name="flowers" radius={[0, 7, 7, 0]}>
                        {summary.speciesData.map((item) => <Cell key={item.name} fill={SPECIES_COLORS[item.name]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="panel-insight"><Leaf size={17} weight="fill" /> {summary.speciesData[0].label} accounts for {summary.speciesData[0].percent.toFixed(1)}% of this garden view.</p>
              </article>

              <article className="analysis-panel" id="height">
                <header>
                  <div><span className="section-number">03</span><h2>Height comparison</h2></div>
                  <p>Each line shows a species range and its average.</p>
                </header>
                <div className="range-chart" role="img" aria-label="Height range and average by species">
                  {summary.speciesData.slice().sort((a, b) => b.average - a.average).map((item) => {
                    const domainMin = summary.min;
                    const domainMax = summary.max;
                    const left = ((item.min - domainMin) / (domainMax - domainMin || 1)) * 100;
                    const width = ((item.max - item.min) / (domainMax - domainMin || 1)) * 100;
                    const average = ((item.average - domainMin) / (domainMax - domainMin || 1)) * 100;
                    return (
                      <div className="range-row" key={item.name} title={`${item.label}: ${item.min.toFixed(1)}–${item.max.toFixed(1)} cm, average ${item.average.toFixed(1)} cm`}>
                        <span>{item.label}</span>
                        <div className="range-track">
                          <i className="range-line" style={{ left: `${left}%`, width: `${width}%`, background: SPECIES_COLORS[item.name] }} />
                          <b style={{ left: `${average}%`, borderColor: SPECIES_COLORS[item.name] }}><span>{item.average.toFixed(0)}</span></b>
                        </div>
                        <small>{item.min.toFixed(0)}–{item.max.toFixed(0)}</small>
                      </div>
                    );
                  })}
                  <div className="range-axis"><span>{summary.min.toFixed(0)} cm</span><span>{summary.median.toFixed(0)} median</span><span>{summary.max.toFixed(0)} cm</span></div>
                </div>
                <p className="panel-insight"><Ruler size={17} weight="duotone" /> {summary.speciesData.slice().sort((a, b) => b.average - a.average)[0].label} is tallest on average at {summary.speciesData.slice().sort((a, b) => b.average - a.average)[0].average.toFixed(1)} cm.</p>
              </article>

              <article className="analysis-panel" id="relationships">
                <header>
                  <div><span className="section-number">04</span><h2>Size & fragrance</h2></div>
                  <p>Size mix within each fragrance level.</p>
                </header>
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={summary.fragranceData} layout="vertical" margin={{ top: 6, right: 12, bottom: 8, left: 2 }}>
                      <XAxis type="number" tick={{ fill: "#617062", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="label" width={62} tick={{ fill: "#283c2c", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<DataTooltip />} cursor={{ fill: "#f5f2e9" }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                      {["small", "medium", "large"].map((key, index) => (
                        <Bar key={key} dataKey={key} name={key} stackId="sizes" fill={SIZE_COLORS[key]} radius={index === 0 ? [6, 0, 0, 6] : index === 2 ? [0, 6, 6, 0] : 0} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="panel-insight"><Wind size={17} weight="duotone" /> {titleCase(summary.mostCommonFragrance.fragrance)} fragrance leads with {formatNumber.format(summary.mostCommonFragrance.total)} flowers.</p>
              </article>
            </section>

            <section className="personalities" id="personalities">
              <header className="section-heading">
                <div><span className="section-number">05</span><h2>Flower personalities</h2></div>
                <p>Four measurable groups bring this garden to life.</p>
              </header>
              <div className="persona-grid">
                {summary.personas.map(({ id, name, description, note, count, percent, median, color, icon: Icon }) => (
                  <button className={`persona persona--${color} ${activePersona === id ? "is-active" : ""}`} key={id} onClick={() => setActivePersona(activePersona === id ? null : id)} aria-pressed={activePersona === id}>
                    <span className="persona-icon"><Icon size={30} weight="duotone" /></span>
                    <span className="persona-copy">
                      <strong>{name}</strong>
                      <em>{note}</em>
                      <span>{formatNumber.format(count)} flowers · {percent.toFixed(1)}%</span>
                      <small>{description} Median height: {median.toFixed(1)} cm.</small>
                    </span>
                  </button>
                ))}
              </div>
              {activePersona && <p className="persona-help" aria-live="polite">Selected: {summary.personas.find((persona) => persona.id === activePersona)?.name}. Click again to clear.</p>}
            </section>

            <section className="closing" id="closing">
              <img src={`${PUBLIC_BASE}assets/botanical-sprig.png`} alt="Botanical sprig with coral flowers" />
              <div className="closing-label"><span className="section-number">06</span><span>Closing insight</span></div>
              <div>
                <h2>Diversity in form. Harmony in balance.</h2>
                <p>{summary.speciesData.slice().sort((a, b) => b.average - a.average)[0].label} brings the tallest average height, while {titleCase(summary.mostCommonFragrance.fragrance)} is the most common fragrance. Every group adds a distinct rhythm to the garden.</p>
              </div>
              <Leaf size={36} weight="duotone" aria-hidden="true" />
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export function App() {
  const [rows, setRows] = useState([]);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${PUBLIC_BASE}data/flower_dataset.csv`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("The flower dataset could not be loaded.");
        return response.text();
      })
      .then((text) => {
        const parsed = parseCsv(text);
        const signatures = new Set(parsed.map((row) => `${row.species}|${row.size}|${row.fragrance}|${row.height_cm}`));
        setDuplicateCount(parsed.length - signatures.size);
        setRows(parsed);
        setStatus("ready");
      })
      .catch((error) => {
        if (error.name !== "AbortError") setStatus("error");
      });
    return () => controller.abort();
  }, []);

  if (status === "loading") return <LoadingState />;
  if (status === "error") {
    return (
      <main className="state-page" role="alert">
        <WarningCircle size={42} weight="duotone" />
        <h1>The garden could not be opened</h1>
        <p>Check that the local dataset is available, then refresh the page to try again.</p>
        <button onClick={() => window.location.reload()}>Try again</button>
      </main>
    );
  }
  return <AppContent rows={rows} duplicateCount={duplicateCount} />;
}
