"use client";
import { useState } from "react";
import { ArrowUpRight, Radio, Check } from "lucide-react";
export default function Demo() {
  const [found, setFound] = useState(false);
  return (
    <div className="panel demo">
      <div className="row between demo-header">
        <span className="eyebrow">LIVE PRODUCT WALKTHROUGH</span>
        <span className="tag neutral">Illustrative demo</span>
      </div>
      <div className="demo-body">
        <div className="row between">
          <span className="muted">Deployment leads</span>
          <Radio size={15} color="#b6ef6d" />
        </div>
        <div className="query mono">
          (&quot;looking for&quot; OR recommend) hosting
          <br />
          -is:retweet
        </div>
        {!found ? (
          <>
            <div className="radar-visual">
              <div className="rings" />
              <div className="signal" />
            </div>
            <button
              className="primary"
              style={{ width: "100%" }}
              onClick={() => setFound(true)}
            >
              Run example scan <ArrowUpRight size={15} />
            </button>
          </>
        ) : (
          <>
            <div className="row between" style={{ margin: "24px 0 15px" }}>
              <span className="tag">
                <Check size={12} />
                Match detected
              </span>
              <span className="muted">43s after posting</span>
            </div>
            <div className="row">
              <div className="score">
                91<small>OPPORTUNITY</small>
              </div>
              <div>
                <strong>Maya · example author</strong>
                <div className="muted">@maya_builds</div>
              </div>
            </div>
            <p style={{ fontSize: 15, color: "#e1e6ed", margin: "18px 0" }}>
              Anyone know a good deployment platform that isn’t insanely
              expensive? Shipping a small SaaS this week.
            </p>
            <div className="match-meta">
              <span>Buying intent</span>
              <span>Few replies</span>
              <span>Fresh conversation</span>
            </div>
            <button
              className="quiet"
              style={{ marginTop: 20 }}
              onClick={() => setFound(false)}
            >
              Replay walkthrough
            </button>
          </>
        )}
      </div>
    </div>
  );
}
