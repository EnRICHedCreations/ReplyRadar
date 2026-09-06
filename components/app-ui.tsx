"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Radio,
  ArrowUpRight,
  Plus,
  Pause,
  Play,
  RefreshCw,
  Archive,
  VolumeX,
  X,
  Mail,
  Send,
  MessageCircle,
  Check,
} from "lucide-react";
import { PLANS, entitlement, inSchedule } from "@/lib/domain";
export async function api(path: string, method = "GET", body?: unknown) {
  const res = await fetch("/api/app/" + path, {
    method,
    headers: method === "GET" ? {} : { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error || "Request failed.");
  return d;
}
function useData(path: string, interval = 0) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      setData(await api(path));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [path]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const d = await api(path);
        if (active) {
          setData(d);
          setError("");
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      }
    };
    void load();
    const timer = interval ? setInterval(load, interval) : null;
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [path, interval]);
  return { data, error, refresh };
}
function Notice({ text }: { text: string }) {
  return text ? (
    <div className="notice" role="status">
      {text}
    </div>
  ) : null;
}
function Header({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-head row between wrap">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Radio size={34} />
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}
function ago(value: string) {
  if (!value) return "Not yet";
  const s = Math.max(0, Math.floor((Date.now() - +new Date(value)) / 1000));
  return s < 60
    ? s + "s ago"
    : s < 3600
      ? Math.floor(s / 60) + "m ago"
      : s < 86400
        ? Math.floor(s / 3600) + "h ago"
        : Math.floor(s / 86400) + "d ago";
}
function RadarRows({
  radars,
  refresh,
}: {
  radars: any[];
  refresh: () => Promise<void>;
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(""),
    [now, setNow] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  async function action(r: any, verb: string) {
    setBusy(r.id);
    try {
      const d = await api(
        `radars/${r.id}/${verb}`,
        "POST",
        verb === "toggle" ? { enabled: !r.enabled } : {},
      );
      setMessage(d.message || "Radar updated.");
      await refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <Notice text={message} />
      {!radars.length ? (
        <Empty
          title="Your first signal starts here."
          description="Create a radar to monitor a conversation. We’ll show the last scan, next scan, and any matches right here."
          action={
            <Link className="button primary" href="/radars/new">
              <Plus size={15} />
              Create your first radar
            </Link>
          }
        />
      ) : (
        radars.map((r) => (
          <article className="radar-row" key={r.id}>
            <div className="row between">
              <div className="row">
                <Radio size={18} color="#b6ef6d" />
                <h3 style={{ margin: 0 }}>{r.name}</h3>
              </div>
              <span
                className={
                  "tag " + (!r.enabled ? "neutral" : r.last_error ? "warn" : "")
                }
              >
                {!r.enabled
                  ? "Paused"
                  : !inSchedule(
                        new Date(now),
                        r.timezone,
                        r.active_schedule_json,
                      )
                    ? "Outside active hours"
                    : r.last_error?.replaceAll("_", " ") || "Active"}
              </span>
            </div>
            <div className="query mono">{r.query}</div>
            <div className="radar-meta">
              <span>
                Last scan <b>{ago(r.last_scan_at)}</b>
              </span>
              <span>
                Next scan{" "}
                <b>
                  {!r.enabled
                    ? "Paused"
                    : +new Date(r.next_scan_at) < now
                      ? "Due now"
                      : new Date(r.next_scan_at).toLocaleTimeString()}
                </b>
              </span>
              <span>
                Provider <b>{r.provider === "mock" ? "Mock data" : "X API"}</b>
              </span>
            </div>
            <div className="row wrap">
              <Link className="button quiet" href={"/matches?radar=" + r.id}>
                View matches
              </Link>
              <button
                className="quiet"
                disabled={busy === r.id || !r.enabled}
                onClick={() => action(r, "scan")}
              >
                <RefreshCw size={13} />
                Scan now
              </button>
              <Link className="button quiet" href={"/radars/" + r.id}>
                Edit
              </Link>
              <button
                className="quiet"
                disabled={busy === r.id}
                onClick={() => action(r, "toggle")}
              >
                {r.enabled ? <Pause size={13} /> : <Play size={13} />}{" "}
                {r.enabled ? "Pause" : "Resume"}
              </button>
              <Link className="muted" href={"/radars/" + r.id + "/history"}>
                Scan history →
              </Link>
            </div>
          </article>
        ))
      )}
    </>
  );
}
export function Overview({ radarsOnly = false }: { radarsOnly?: boolean }) {
  const { data, error, refresh } = useData("snapshot", 5000);
  return (
    <>
      <Header
        title={radarsOnly ? "Your radars" : "Overview"}
        subtitle={
          radarsOnly
            ? "Purposeful searches. Always listening."
            : "The conversations that matter, at a glance."
        }
        action={
          <Link className="button primary" href="/radars/new">
            <Plus size={15} />
            New radar
          </Link>
        }
      />
      <Notice text={error} />
      {data && (
        <>
          {data.provider === "mock" && (
            <Notice text="Mock mode is active. Posts are deterministic examples, not live X results. Configure the X provider to monitor real conversations." />
          )}
          {!data.worker && (
            <Notice text="Worker unavailable. Scans and notifications are waiting. Start the worker service and check its database connection." />
          )}
          {!radarsOnly && (
            <div className="stats">
              {[
                [
                  "Active radars",
                  data.stats.active_radars,
                  "Listening for new posts",
                ],
                [
                  "Matches today",
                  data.stats.matches_today,
                  "Since midnight UTC",
                ],
                [
                  "High opportunity",
                  data.stats.high_opportunity,
                  "Score of 80 or higher",
                ],
                [
                  "Avg detection time",
                  data.stats.avg_detection
                    ? data.stats.avg_detection + "s"
                    : "—",
                  "Today’s matched posts",
                ],
              ].map(([label, value, hint]) => (
                <div className="panel stat" key={label}>
                  <span className="eyebrow">{label}</span>
                  <strong>{value}</strong>
                  <small>{hint}</small>
                </div>
              ))}
            </div>
          )}
          <div className="panel">
            <div className="row between">
              <h3>Your monitoring network</h3>
              <span className="muted">{data.radars.length} radars</span>
            </div>
            <RadarRows radars={data.radars} refresh={refresh} />
          </div>
        </>
      )}
      {!data && !error && (
        <div className="loading">Loading your workspace…</div>
      )}
    </>
  );
}
export function RadarForm({
  id,
  onboarding = false,
}: {
  id?: string;
  onboarding?: boolean;
}) {
  const router = useRouter(),
    { data: snapshot } = useData("snapshot"),
    { data: integrations } = useData("integrations");
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [mode, setMode] = useState("simple"),
    [step, setStep] = useState(1),
    [goal, setGoal] = useState("customers"),
    [description, setDescription] = useState(""),
    [hours, setHours] = useState(false),
    [days, setDays] = useState([1, 2, 3, 4, 5]),
    [start, setStart] = useState("08:00"),
    [end, setEnd] = useState("23:00"),
    [selected, setSelected] = useState<string[]>([]);
  const { register, handleSubmit, reset, setValue } = useForm<any>({
    defaultValues: {
      name: "",
      query: "",
      description: "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      scan_interval_seconds: 600,
      minimum_score: 70,
      enabled: true,
    },
  });
  useEffect(() => {
    if (id)
      api("radars/" + id)
        .then((r) => {
          reset(r);
          setSelected(r.integration_ids || []);
          if (r.active_schedule_json) {
            setHours(true);
            setDays(r.active_schedule_json.days);
            setStart(r.active_schedule_json.start);
            setEnd(r.active_schedule_json.end);
          }
        })
        .catch((e) => setMessage(e.message));
  }, [id, reset]);
  const generate = async () => {
    setBusy(true);
    try {
      const d = await api("query", "POST", { description, goal });
      setValue("query", d.query);
      setMessage("Suggested query ready. Review it before activating.");
      setStep(3);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const limits = PLANS[entitlement(snapshot?.subscription)];
  return (
    <>
      <Header
        title={
          id
            ? "Edit radar"
            : onboarding
              ? "Let’s find your first conversation."
              : "Create a radar"
        }
        subtitle={
          onboarding
            ? `Step ${step} of 5 · A focused search beats a noisy feed.`
            : "Tell ReplyRadar what to listen for."
        }
      />
      <Notice text={message} />
      <form
        className="panel form"
        onSubmit={handleSubmit(async (values) => {
          setBusy(true);
          try {
            await api("radars" + (id ? "/" + id : ""), id ? "PUT" : "POST", {
              ...values,
              scan_interval_seconds: Number(values.scan_interval_seconds),
              minimum_score: Number(values.minimum_score),
              integration_ids: selected,
              active_schedule_json: hours ? { days, start, end } : null,
            });
            router.push("/overview");
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        })}
      >
        {(!onboarding || step === 1) && (
          <>
            <div className="field">
              <label htmlFor="goal">What do you want to find?</label>
              <select
                id="goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              >
                {[
                  ["customers", "Potential customers"],
                  ["competitors", "Competitor conversations"],
                  ["recommendations", "Recommendations"],
                  ["brand", "Brand mentions"],
                  ["industry", "Industry conversations"],
                  ["other", "Something else"],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            {onboarding && (
              <button
                type="button"
                className="primary"
                onClick={() => setStep(2)}
              >
                Continue
              </button>
            )}
          </>
        )}
        {(!onboarding || step === 2) && (
          <>
            <div className="tabs">
              <button
                type="button"
                className={mode === "simple" ? "selected" : ""}
                onClick={() => setMode("simple")}
              >
                Simple
              </button>
              <button
                type="button"
                className={mode === "advanced" ? "selected" : ""}
                onClick={() => {
                  setMode("advanced");
                  if (onboarding) setStep(3);
                }}
              >
                Advanced query
              </button>
            </div>
            {mode === "simple" && (
              <>
                <div className="field">
                  <label htmlFor="description">
                    Describe the conversations
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="People complaining about Vercel being expensive."
                  />
                </div>
                <button
                  type="button"
                  disabled={busy || description.length < 3}
                  onClick={generate}
                >
                  Generate query
                </button>
                <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                  Uses editable templates. Review the suggested query for your
                  use case.
                </p>
              </>
            )}
          </>
        )}
        {(!onboarding || step === 3) && (
          <>
            <div className="field">
              <label htmlFor="name">Radar name</label>
              <input
                id="name"
                {...register("name", { required: true })}
                placeholder="Deployment leads"
              />
            </div>
            <div className="field">
              <label htmlFor="query">X search query</label>
              <textarea
                id="query"
                className="mono"
                {...register("query", { required: true })}
                placeholder={
                  '("looking for" OR recommend) deployment -is:retweet'
                }
              />
              <small className="hint">
                Exact phrase: &quot;machine learning&quot; · OR · -spam ·
                from:username · lang:en · -is:retweet · -is:reply. Availability
                depends on X access; provider errors appear in scan history.
              </small>
            </div>
            <div className="grid2">
              <div className="field">
                <label htmlFor="interval">Scan interval</label>
                <select id="interval" {...register("scan_interval_seconds")}>
                  {[30, 60, 120, 600, 1800, 3600]
                    .filter((n) => n >= limits.interval)
                    .map((n) => (
                      <option key={n} value={n}>
                        {n >= 60 ? n / 60 + " minutes" : n + " seconds"}
                      </option>
                    ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="score">Minimum alert score</label>
                <input
                  id="score"
                  type="number"
                  min="0"
                  max="100"
                  {...register("minimum_score")}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="timezone">Timezone</label>
              <input
                id="timezone"
                {...register("timezone")}
                placeholder="America/New_York"
              />
            </div>
            <label className="row" style={{ marginBottom: 18 }}>
              <input
                type="checkbox"
                checked={hours}
                onChange={(e) => setHours(e.target.checked)}
              />
              Only scan during active hours
            </label>
            {hours && (
              <>
                <div className="row wrap" style={{ marginBottom: 15 }}>
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (d, i) => (
                      <label key={d} className="row">
                        <input
                          type="checkbox"
                          checked={days.includes(i)}
                          onChange={(e) =>
                            setDays(
                              e.target.checked
                                ? [...days, i]
                                : days.filter((x) => x !== i),
                            )
                          }
                        />
                        {d}
                      </label>
                    ),
                  )}
                </div>
                <div className="grid2">
                  <div className="field">
                    <label htmlFor="start">Start</label>
                    <input
                      id="start"
                      type="time"
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="end">End</label>
                    <input
                      id="end"
                      type="time"
                      value={end}
                      onChange={(e) => setEnd(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}
            {onboarding && (
              <button
                type="button"
                className="primary"
                onClick={() => setStep(4)}
              >
                Choose notifications
              </button>
            )}
          </>
        )}
        {(!onboarding || step === 4) && (
          <>
            <h3>Notification channels</h3>
            {integrations?.length ? (
              integrations
                .filter((i: any) => i.enabled)
                .map((i: any) => (
                  <label
                    className="row"
                    style={{ marginBottom: 12 }}
                    key={i.id}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(i.id)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, i.id]
                            : selected.filter((x) => x !== i.id),
                        )
                      }
                    />
                    {i.type} · {i.configuration_json.mode || "instant"}
                  </label>
                ))
            ) : (
              <p className="muted">
                No channels connected yet. You can activate now and add
                Telegram, Discord, or email in Integrations.
              </p>
            )}
            <Link href="/integrations" target="_blank" className="button quiet">
              Connect a channel <ArrowUpRight size={14} />
            </Link>
            {onboarding && (
              <button
                type="button"
                className="primary"
                onClick={() => setStep(5)}
                style={{ marginLeft: 10 }}
              >
                Continue
              </button>
            )}
          </>
        )}
        {(!onboarding || step === 5) && (
          <div style={{ marginTop: 25 }}>
            {onboarding && (
              <p className="muted">
                Your first scan enters the background queue immediately. You can
                pause or edit the radar anytime.
              </p>
            )}
            <button className="primary" disabled={busy}>
              {busy ? "Saving…" : id ? "Save radar" : "Activate radar"}{" "}
              <Radio size={15} />
            </button>
            {id && (
              <button
                type="button"
                className="quiet danger"
                style={{ marginLeft: 10 }}
                onClick={async () => {
                  if (!confirm("Delete this radar and its match history?"))
                    return;
                  try {
                    await api("radars/" + id, "DELETE");
                    router.push("/radars");
                  } catch (e) {
                    setMessage((e as Error).message);
                  }
                }}
              >
                Delete radar
              </button>
            )}
          </div>
        )}
        {onboarding && step > 1 && (
          <button
            type="button"
            className="quiet"
            style={{ marginTop: 15 }}
            onClick={() => setStep(step - 1)}
          >
            Back
          </button>
        )}
      </form>
    </>
  );
}
function MatchDetail({ match, close }: { match: any; close: () => void }) {
  const { data } = useData("deliveries/" + match.id, 5000),
    ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          "button,a[href],input,select",
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [close]);
  return (
    <div className="drawer-backdrop" onClick={close}>
      <div
        ref={ref}
        tabIndex={-1}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row between">
          <h2 id="detail-title">Conversation detail</h2>
          <button aria-label="Close details" onClick={close}>
            <X size={17} />
          </button>
        </div>
        <span className="tag">{match.score} / 100 opportunity</span>
        <h3 style={{ marginTop: 25 }}>@{match.username}</h3>
        <p>{match.text}</p>
        <p className="muted">
          {match.likes} likes · {match.replies} replies · {match.followers}{" "}
          followers
        </p>
        <a
          className="button primary"
          href={match.url}
          target="_blank"
          rel="noreferrer"
        >
          {match.url.includes("/search?")
            ? "Open example search on X"
            : "Open on X"}{" "}
          <ArrowUpRight size={15} />
        </a>
        <h3 style={{ marginTop: 30 }}>Why this scored {match.score}</h3>
        {Object.entries(match.score_breakdown_json).map(([k, v]) => (
          <div className="breakdown-row" key={k}>
            <span>{k}</span>
            <span>
              {String(v)} /{" "}
              {
                (
                  {
                    freshness: 30,
                    velocity: 25,
                    intent: 25,
                    saturation: 10,
                    reach: 10,
                  } as any
                )[k]
              }
            </span>
          </div>
        ))}
        <p className="muted" style={{ marginTop: 20 }}>
          Detected{" "}
          {Math.max(
            0,
            Math.round(
              (+new Date(match.detected_at) - +new Date(match.posted_at)) /
                1000,
            ),
          )}{" "}
          seconds after publication.
        </p>
        <h3>Matched radar · {match.radar_name}</h3>
        <div className="query mono">{match.query}</div>
        <h3>Notification history</h3>
        {data?.length ? (
          data.map((d: any) => (
            <p key={d.id} className="muted">
              {d.type} · {d.status} {d.last_error && "· " + d.last_error}
            </p>
          ))
        ) : (
          <p className="muted">No notification deliveries for this match.</p>
        )}
      </div>
    </div>
  );
}
export function Matches() {
  const [filter, setFilter] = useState("all"),
    [q, setQ] = useState(""),
    [radar, setRadar] = useState(""),
    [score, setScore] = useState("0"),
    [page, setPage] = useState(0),
    [detail, setDetail] = useState<any>(null),
    [message, setMessage] = useState("");
  useEffect(() => {
    const r = new URL(location.href).searchParams.get("radar");
    if (r) queueMicrotask(() => setRadar(r));
  }, []);
  const { data: snapshot } = useData("snapshot"),
    { data, error, refresh } = useData(
      "matches?" +
        new URLSearchParams({ filter, q, radar, score, page: String(page) }),
      5000,
    );
  const close = useCallback(() => setDetail(null), []);
  async function action(m: any, verb: string) {
    try {
      await api(
        "matches/" + m.id + "/" + verb,
        "POST",
        verb === "archive" ? { archived: !m.archived_at } : {},
      );
      await refresh();
      setMessage(verb === "mute" ? "Author muted." : "Match updated.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <>
      <Header
        title="Matches"
        subtitle="A feed of conversations worth your attention."
      />
      <Notice text={error || message} />
      {snapshot?.provider === "mock" && (
        <Notice text="Example posts from the mock provider. X links open a search, not a real post by the example author." />
      )}
      <div className="tabs">
        {[
          ["all", "All"],
          ["high", "High opportunity"],
          ["BUYING_INTENT", "Buying intent"],
          ["QUESTION", "Questions"],
          ["COMPLAINT", "Competitor pain"],
          ["BRAND_MENTION", "Brand"],
          ["archived", "Archived"],
        ].map(([v, l]) => (
          <button
            className={filter === v ? "selected" : ""}
            key={v}
            onClick={() => {
              setFilter(v);
              setPage(0);
            }}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="filters">
        <input
          aria-label="Search matches"
          placeholder="Search conversations…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
        />
        <select
          aria-label="Filter radar"
          value={radar}
          onChange={(e) => {
            setRadar(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All radars</option>
          {snapshot?.radars.map((r: any) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Minimum score"
          value={score}
          onChange={(e) => {
            setScore(e.target.value);
            setPage(0);
          }}
        >
          <option value="0">Any score</option>
          <option value="50">Score 50+</option>
          <option value="80">Score 80+</option>
          <option value="90">Score 90+</option>
        </select>
      </div>
      <div className="panel" style={{ padding: "0 20px" }}>
        {data?.items.length ? (
          data.items.map((m: any) => (
            <article className="match" key={m.id}>
              <button
                className="score"
                aria-label={"Show score breakdown: " + m.score}
                onClick={() => setDetail(m)}
              >
                <span>
                  {m.score}
                  <small>SCORE</small>
                </span>
              </button>
              <div>
                <div className="row between wrap">
                  <div>
                    <strong>{m.display_name || m.username}</strong>{" "}
                    <span className="muted">@{m.username}</span>
                  </div>
                  <span className="muted" style={{ fontSize: 11 }}>
                    {ago(m.posted_at)}
                  </span>
                </div>
                <p>{m.text}</p>
                <div className="match-meta">
                  <span>{m.likes} likes</span>
                  <span>{m.replies} replies</span>
                  <span>{m.reposts} reposts</span>
                  <span>{m.radar_name}</span>
                </div>
                <div style={{ marginTop: 12 }}>
                  <span className="tag neutral">
                    {m.intent.replaceAll("_", " ")}
                  </span>
                </div>
                <div className="match-actions">
                  <a
                    className="button primary"
                    href={m.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open on X <ArrowUpRight size={13} />
                  </a>
                  <button className="quiet" onClick={() => setDetail(m)}>
                    Details
                  </button>
                  <button
                    className="quiet"
                    onClick={() => action(m, "archive")}
                  >
                    <Archive size={13} />
                    {m.archived_at ? "Restore" : "Archive"}
                  </button>
                  <button className="quiet" onClick={() => action(m, "mute")}>
                    <VolumeX size={13} />
                    Mute author
                  </button>
                </div>
              </div>
            </article>
          ))
        ) : data ? (
          <Empty
            title="No matches here yet."
            description="New results appear after your next successful scan. Try another filter or review your query and scan history."
            action={
              <Link className="button" href="/radars">
                View radar status
              </Link>
            }
          />
        ) : (
          <div className="loading">Loading conversations…</div>
        )}
      </div>
      <div className="row between" style={{ marginTop: 20 }}>
        <button disabled={page === 0} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <span className="muted">Page {page + 1}</span>
        <button disabled={!data?.more} onClick={() => setPage(page + 1)}>
          Next
        </button>
      </div>
      {detail && <MatchDetail match={detail} close={close} />}
    </>
  );
}
export function Integrations() {
  const { data, error, refresh } = useData("integrations", 5000),
    { data: deliveries } = useData("deliveries", 5000);
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(""),
    [webhook, setWebhook] = useState(""),
    [mode, setMode] = useState("instant");
  async function connect(type: string) {
    setBusy(type);
    try {
      const d = await api("integrations", "POST", { type, webhook, mode });
      if (d.url) location.assign(d.url);
      else {
        setMessage("Connected. Select this channel in your radar settings.");
        setWebhook("");
        await refresh();
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <Header
        title="Integrations"
        subtitle="Put the signal where you’ll actually see it."
      />
      <Notice text={error || message} />
      <div className="stack">
        {[
          [
            "telegram",
            "Telegram",
            Send,
            "Connect privately through the ReplyRadar bot.",
          ],
          [
            "discord",
            "Discord",
            MessageCircle,
            "Deliver to your team’s channel. Growth plan required.",
          ],
          [
            "email",
            "Email",
            Mail,
            "Send alerts to your verified account email.",
          ],
        ].map(([type, title, Icon, copy]: any) => {
          const current = data?.find((i: any) => i.type === type);
          return (
            <section className="panel" key={type}>
              <div className="row between">
                <div className="row">
                  <Icon size={22} />
                  <h2 style={{ margin: 0 }}>{title}</h2>
                </div>
                <span
                  className={
                    "tag " +
                    (!current ? "neutral" : current.last_error ? "warn" : "")
                  }
                >
                  {current
                    ? current.last_error
                      ? "Needs attention"
                      : "Connected"
                    : "Not connected"}
                </span>
              </div>
              <p className="muted" style={{ marginTop: 12 }}>
                {copy}
              </p>
              {current ? (
                <>
                  <p className="muted">
                    Last successful delivery: {ago(current.last_success_at)}
                    {current.last_error && " · " + current.last_error}
                  </p>
                  <div className="row">
                    <button
                      onClick={async () => {
                        try {
                          const d = await api(
                            `integrations/${current.id}/test`,
                            "POST",
                            {},
                          );
                          setMessage(d.message);
                        } catch (e) {
                          setMessage((e as Error).message);
                        }
                      }}
                    >
                      Test notification
                    </button>
                    <button
                      className="quiet danger"
                      onClick={async () => {
                        try {
                          await api("integrations/" + current.id, "DELETE");
                          await refresh();
                        } catch (e) {
                          setMessage((e as Error).message);
                        }
                      }}
                    >
                      Disconnect
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {type === "discord" && (
                    <div className="field">
                      <label htmlFor="webhook">Discord webhook URL</label>
                      <input
                        id="webhook"
                        type="password"
                        autoComplete="off"
                        value={webhook}
                        onChange={(e) => setWebhook(e.target.value)}
                        placeholder="https://discord.com/api/webhooks/…"
                      />
                    </div>
                  )}
                  {type === "email" && (
                    <div className="field">
                      <label htmlFor="email-mode">Delivery preference</label>
                      <select
                        id="email-mode"
                        value={mode}
                        onChange={(e) => setMode(e.target.value)}
                      >
                        <option value="instant">Instant</option>
                        <option value="high">
                          High opportunity only (80+)
                        </option>
                      </select>
                    </div>
                  )}
                  <button
                    disabled={busy === type}
                    onClick={() => connect(type)}
                  >
                    <Plus size={14} />
                    Connect {title}
                  </button>
                </>
              )}
            </section>
          );
        })}
      </div>
      <section className="panel" style={{ marginTop: 25 }}>
        <h3>Recent deliveries</h3>
        <p className="muted">
          Tests run in the background worker. An uncertain delivery is not
          retried automatically to avoid duplicate alerts.
        </p>
        {deliveries?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d: any) => (
                  <tr key={d.id}>
                    <td>{d.type}</td>
                    <td>{d.status}</td>
                    <td>{d.attempt_count}</td>
                    <td>{d.last_error || ago(d.sent_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">
            No deliveries yet. Connect a channel and send a test.
          </p>
        )}
      </section>
    </>
  );
}
export function Usage() {
  const { data, error } = useData("usage", 10000),
    { data: snapshot } = useData("snapshot");
  const plan = entitlement(snapshot?.subscription),
    used = Number(
      data?.totals.find((t: any) => t.type === "scan")?.quantity || 0,
    ),
    limit = PLANS[plan].scans;
  return (
    <>
      <Header
        title="Usage"
        subtitle="Your actual activity for this calendar month (UTC)."
      />
      <Notice text={error} />
      <div className="stats">
        {[
          ["Scans", used],
          ["Monthly allowance", limit.toLocaleString()],
          [
            "Matches found",
            data?.totals.find((t: any) => t.type === "match")?.quantity || 0,
          ],
          [
            "Notifications sent",
            data?.totals.find((t: any) => t.type === "notification_sent")
              ?.quantity || 0,
          ],
        ].map(([l, v]) => (
          <div className="panel stat" key={l}>
            <span className="eyebrow">{l}</span>
            <strong>{data ? v : "—"}</strong>
          </div>
        ))}
      </div>
      <div className="panel">
        <div className="row between">
          <h3>{plan.toUpperCase()} plan</h3>
          <span className="muted">
            {used} / {limit.toLocaleString()} scans
          </span>
        </div>
        <progress aria-label="Monthly scan usage" value={used} max={limit} />
        <p className="muted" style={{ marginTop: 14 }}>
          Quota resets on the first of each month at 00:00 UTC. Failed provider
          attempts count; paused radars and scans outside active hours do not.
        </p>
        <Link className="button" href="/billing">
          Manage plan
        </Link>
      </div>
      <div className="panel" style={{ marginTop: 24 }}>
        <h3>Daily scan activity</h3>
        {data?.days.length ? (
          data.days.map((d: any) => (
            <div className="breakdown-row" key={d.day}>
              <span>{d.day}</span>
              <span>{d.scans} scans</span>
            </div>
          ))
        ) : (
          <p className="muted">No scans recorded this month.</p>
        )}
      </div>
    </>
  );
}
export function Billing() {
  const { data, error } = useData("snapshot", 10000),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const plan = entitlement(data?.subscription);
  async function go(path: string, body: unknown) {
    setBusy(true);
    try {
      const d = await api(path, "POST", body);
      location.assign(d.url);
    } catch (e) {
      setMessage((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <>
      <Header
        title="Billing"
        subtitle="A plan for every stage of the conversation."
        action={
          <button disabled={busy} onClick={() => go("billing/portal", {})}>
            Manage billing
          </button>
        }
      />
      <Notice text={error || message} />
      <div className="panel">
        <div className="row between">
          <div>
            <span className="eyebrow">CURRENT PLAN</span>
            <h2 style={{ margin: "8px 0" }}>{plan.toUpperCase()}</h2>
            <p className="muted">
              Subscription: {data?.subscription.status || "Loading…"}. Plan
              changes take effect after Stripe confirms them.
            </p>
          </div>
          <Check size={25} color="#b6ef6d" />
        </div>
      </div>
      <div className="pricing">
        {Object.entries(PLANS).map(([name, p]) => (
          <div className="panel" key={name}>
            <span className="eyebrow">{name}</span>
            <div className="price">
              ${p.price}
              <small> / mo</small>
            </div>
            <ul>
              <li>{p.radars} radars</li>
              <li>{p.interval}s minimum interval</li>
              <li>{p.scans.toLocaleString()} scans / month</li>
              <li>
                {name === "growth" ? "Discord included" : "Telegram & email"}
              </li>
            </ul>
            <button
              style={{ width: "100%" }}
              className={name === "pro" ? "primary" : ""}
              disabled={name === plan || busy}
              onClick={() =>
                name === "free" || plan !== "free"
                  ? go("billing/portal", {})
                  : go("billing", { plan: name })
              }
            >
              {name === plan
                ? "Current plan"
                : name === "free"
                  ? "Downgrade"
                  : plan === "free"
                    ? "Choose " + name
                    : "Change plan"}
            </button>
          </div>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 25 }}>
        Change, downgrade, or cancel your subscription in the billing portal. A
        checkout return URL never grants paid access.
      </p>
    </>
  );
}
export function Account({ preferences = false }: { preferences?: boolean }) {
  const { data, error } = useData("account"),
    { register, handleSubmit, reset } = useForm<any>(),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (data) reset(data);
  }, [data, reset]);
  return (
    <>
      <Header
        title={preferences ? "Settings" : "Account"}
        subtitle="Make ReplyRadar fit the way you work."
      />
      <Notice text={error || message} />
      <form
        className="panel form"
        onSubmit={handleSubmit(async (v) => {
          try {
            await api("account", "POST", v);
            setMessage("Settings saved.");
          } catch (e) {
            setMessage((e as Error).message);
          }
        })}
      >
        <div className="field">
          <label htmlFor="display">Display name</label>
          <input id="display" {...register("display_name")} />
        </div>
        <div className="field">
          <label htmlFor="tz">Default timezone</label>
          <input id="tz" {...register("timezone")} />
        </div>
        <div className="field">
          <label htmlFor="default-mode">Default notification preference</label>
          <select id="default-mode" {...register("preferences.default_mode")}>
            <option value="instant">Instant</option>
            <option value="high">High opportunity only</option>
          </select>
          <small className="hint">
            Existing integrations keep their selected preference.
          </small>
        </div>
        <button className="primary">Save settings</button>
      </form>
    </>
  );
}
export function History({ id }: { id: string }) {
  const { data, error } = useData("radars/" + id + "/history", 5000);
  return (
    <>
      <Header
        title="Scan history"
        subtitle="Every attempt, including the ones that didn’t work."
        action={
          <Link className="button" href={"/radars/" + id}>
            Edit radar
          </Link>
        }
      />
      <Notice text={error} />
      <div className="panel table-wrap">
        {data?.length ? (
          <table>
            <thead>
              <tr>
                {[
                  "Started",
                  "Status",
                  "Results",
                  "New matches",
                  "Duration",
                  "Provider",
                  "Error",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((s: any) => (
                <tr key={s.id}>
                  <td>{new Date(s.started_at).toLocaleString()}</td>
                  <td>{s.status}</td>
                  <td>{s.results_count}</td>
                  <td>{s.new_matches_count}</td>
                  <td>{s.duration_ms} ms</td>
                  <td>{s.provider}</td>
                  <td className="error">{s.error_message || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty
            title="No scans yet."
            description="Activate your radar to queue the first scan. If it remains waiting, check the worker status on Overview."
          />
        )}
      </div>
    </>
  );
}
