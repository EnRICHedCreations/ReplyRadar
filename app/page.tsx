import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Radio,
  MessageCircle,
  Mail,
  Send,
} from "lucide-react";
import Brand from "@/components/brand";
import Demo from "@/components/demo";
import { PLANS } from "@/lib/domain";
export default function Home() {
  return (
    <main className="marketing">
      <header className="marketing-nav row between">
        <Brand />
        <nav>
          <a href="#product">Product</a>
          <a href="#how-it-works">How it works</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <div className="row">
          <Link href="/login" className="muted">
            Sign in
          </Link>
          <Link className="button primary" href="/signup">
            Start monitoring <ArrowUpRight size={15} />
          </Link>
        </div>
      </header>
      <section className="hero">
        <div>
          <span className="tag">
            <Radio size={13} /> YOUR NEXT CUSTOMER IS ALREADY TALKING
          </span>
          <h1>
            Find the conversations
            <br />
            <span>worth joining.</span>
          </h1>
          <p>
            Monitor X for the conversations that matter to your business. Find
            the opportunity, understand the context, and join while it’s still
            fresh.
          </p>
          <div className="row">
            <Link href="/signup" className="button primary">
              Start monitoring <ArrowRight size={16} />
            </Link>
            <a href="#how-it-works" className="button quiet">
              See how it works
            </a>
          </div>
          <p className="footnote">
            Start free. No credit card required. You write the reply.
          </p>
        </div>
        <Demo />
      </section>
      <section id="product" className="marketing-section">
        <span className="eyebrow">LESS SEARCHING. BETTER TIMING.</span>
        <h2>
          The right conversation.
          <br />
          Before everyone else gets there.
        </h2>
        <p className="muted" style={{ maxWidth: 620 }}>
          Someone is asking for exactly what you’re building. But conversations
          move fast. ReplyRadar keeps watch, filters the noise, and brings the
          useful ones to you.
        </p>
        <div className="grid2">
          <div className="panel">
            <span className="eyebrow">01 / LISTEN WITH INTENT</span>
            <h3 style={{ marginTop: 18 }}>Turn a signal into a search.</h3>
            <div className="query mono">
              vercel (expensive OR pricing OR bill OR alternative)
              <br />
              -is:retweet
            </div>
            <p className="muted">
              Competitor pain, recommendation requests, brand mentions, or your
              next customer.
            </p>
          </div>
          <div className="panel">
            <span className="eyebrow">02 / UNDERSTAND THE OPPORTUNITY</span>
            <h3 style={{ marginTop: 18 }}>More context. Less guesswork.</h3>
            <p className="muted">
              Every score explains the signals behind it: freshness, engagement
              velocity, intent, reply saturation, and author reach.
            </p>
            <div className="row wrap">
              <span className="tag">Buying intent</span>
              <span className="tag neutral">Low saturation</span>
              <span className="tag neutral">Fast engagement</span>
            </div>
          </div>
        </div>
      </section>
      <section id="how-it-works" className="marketing-section">
        <span className="eyebrow">FROM SEARCH TO CONVERSATION</span>
        <h2>Set your radar. Keep shipping.</h2>
        <div className="steps">
          {[
            [
              "Define the conversation",
              "Describe what matters, then fine-tune your query and active hours.",
            ],
            [
              "Let your radar listen",
              "Background scans discover, deduplicate, and score new posts.",
            ],
            [
              "Join when it matters",
              "Get an alert, read the context, and open X to reply yourself.",
            ],
          ].map(([title, copy], i) => (
            <div className="panel" key={title}>
              <div className="step-num">0{i + 1} ─────────</div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="marketing-section">
        <div className="row between wrap">
          <div>
            <span className="eyebrow">YOUR SIGNAL, WHERE YOU WORK</span>
            <h2>Alerts that reach you.</h2>
            <p className="muted">
              Choose instant alerts or high-opportunity notifications.
              <br />
              Connect each radar to the channels that matter.
            </p>
          </div>
          <div className="row wrap">
            <span className="button">
              <Send size={18} />
              Telegram
            </span>
            <span className="button">
              <MessageCircle size={18} />
              Discord
            </span>
            <span className="button">
              <Mail size={18} />
              Email
            </span>
          </div>
        </div>
      </section>
      <section id="pricing" className="marketing-section">
        <span className="eyebrow">A SMALL TOOL. A BETTER PIPELINE.</span>
        <h2>Start with one good conversation.</h2>
        <p className="muted">
          Monthly scan allowances apply across all radars. Scanning pauses at
          your limit.
        </p>
        <div className="pricing">
          {Object.entries(PLANS).map(([name, p]) => (
            <div
              className={"panel " + (name === "pro" ? "featured" : "")}
              key={name}
            >
              <span className="eyebrow">{name}</span>
              <div className="price">
                ${p.price}
                <small> / month</small>
              </div>
              <ul>
                <li>
                  {p.radars} {p.radars === 1 ? "radar" : "radars"}
                </li>
                <li>
                  {p.interval >= 60
                    ? p.interval / 60 + "-minute"
                    : p.interval + "-second"}{" "}
                  intervals
                </li>
                <li>{p.scans.toLocaleString()} scans / month</li>
                <li>
                  {name === "growth"
                    ? "Discord notifications"
                    : "Telegram & email alerts"}
                </li>
              </ul>
              <Link
                href="/signup"
                className={"button " + (name === "pro" ? "primary" : "quiet")}
                style={{ width: "100%" }}
              >
                Get started <ArrowUpRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      </section>
      <footer className="footer row between wrap">
        <Brand />
        <span>Find the signal. Write a thoughtful reply.</span>
        <Link href="/login">Sign in →</Link>
      </footer>
    </main>
  );
}
