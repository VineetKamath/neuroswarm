import React, { useMemo, useState } from 'react';

/**
 * Negative-selection detector map.
 *
 * Projects the 7-dimensional vitals space onto any two chosen axes. Green dots
 * are "self" — the normal readings the system was trained on. Rose circles are
 * matured detectors, each one a hypersphere that survived censoring because it
 * fell OUTSIDE the self region. That is the whole idea made visible: the
 * detectors ring the normal cloud without ever overlapping it, so anything
 * landing inside a circle is flagged without the system having been shown a
 * single example of an error.
 */
const FEATURE_LABELS = {
  heart_rate: 'Heart rate',
  bp_systolic: 'Systolic BP',
  bp_diastolic: 'Diastolic BP',
  resp_rate: 'Resp. rate',
  temp_celsius: 'Temperature',
  o2_saturation: 'SpO₂',
  blood_glucose: 'Glucose',
};

export const ImmuneMap = ({
  detectors = [],
  selfSet = [],
  features = [],
  selfRadius = 0.11,
  probe = null,          // { vector: number[], anomalous: bool } for a live reading
  height = 340,
}) => {
  const [xi, setXi] = useState(1);   // systolic
  const [yi, setYi] = useState(0);   // heart rate
  const [hovered, setHovered] = useState(null);

  const size = 460;
  const pad = 30;
  const px = (v) => pad + v * (size - pad * 2);
  const py = (v) => size - pad - v * (size - pad * 2);
  const scale = (size - pad * 2);

  // A detector's true radius is in 7-D; its 2-D footprint is at most that
  // radius, so the projection is drawn as an upper bound and labelled as such.
  const shown = useMemo(() => detectors.slice(0, 170), [detectors]);

  return (
    <div className="p-3">
      <div className="flex flex-wrap gap-2 mb-2">
        <AxisPicker label="X" features={features} value={xi} onChange={setXi} />
        <AxisPicker label="Y" features={features} value={yi} onChange={setYi} />
      </div>

      <svg viewBox={`0 0 ${size} ${size}`} className="w-full" style={{ height }}>
        <rect x={pad} y={pad} width={size - pad * 2} height={size - pad * 2}
              fill="rgba(15,23,42,.4)" stroke="#1e293b" />

        {/* detectors — non-self coverage */}
        <g>
          {shown.map((d, i) => (
            <circle
              key={i}
              cx={px(d.center[xi] ?? 0)}
              cy={py(d.center[yi] ?? 0)}
              r={Math.max(2, (d.radius || 0.05) * scale * 0.5)}
              fill="rgba(244,63,94,.055)"
              stroke="rgba(244,63,94,.42)"
              strokeWidth="0.8"
              onMouseEnter={() => setHovered({ type: 'detector', i, r: d.radius })}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </g>

        {/* self region — the normal manifold */}
        <g>
          {selfSet.map((s, i) => (
            <g key={i}>
              <circle cx={px(s[xi] ?? 0)} cy={py(s[yi] ?? 0)} r={selfRadius * scale * 0.5}
                      fill="rgba(16,185,129,.07)" />
              <circle cx={px(s[xi] ?? 0)} cy={py(s[yi] ?? 0)} r="2.4" fill="#34d399" />
            </g>
          ))}
        </g>

        {/* live probe */}
        {probe?.vector && (
          <g>
            <circle
              cx={px(probe.vector[xi] ?? 0)} cy={py(probe.vector[yi] ?? 0)} r="9"
              fill="none" strokeWidth="2"
              stroke={probe.anomalous ? '#fb7185' : '#38bdf8'}
              className="ns-pulse-ring"
              style={{ transformOrigin: `${px(probe.vector[xi] ?? 0)}px ${py(probe.vector[yi] ?? 0)}px` }}
            />
            <circle cx={px(probe.vector[xi] ?? 0)} cy={py(probe.vector[yi] ?? 0)} r="5"
                    fill={probe.anomalous ? '#fb7185' : '#38bdf8'} stroke="#0b1220" strokeWidth="1.5" />
          </g>
        )}

        <text x={size / 2} y={size - 8} textAnchor="middle" fontSize="11" fill="#64748b">
          {FEATURE_LABELS[features[xi]] || features[xi]} (normalized)
        </text>
        <text x={12} y={size / 2} textAnchor="middle" fontSize="11" fill="#64748b"
              transform={`rotate(-90 12 ${size / 2})`}>
          {FEATURE_LABELS[features[yi]] || features[yi]} (normalized)
        </text>
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> self (normal training data)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full border border-rose-400/70 bg-rose-500/10" />
          matured detector ({detectors.length} total, {shown.length} drawn)
        </span>
        {probe && (
          <span className="inline-flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${probe.anomalous ? 'bg-rose-400' : 'bg-sky-400'}`} />
            your reading
          </span>
        )}
        {hovered?.type === 'detector' && (
          <span className="ml-auto ns-tabular">detector radius {hovered.r?.toFixed(3)}</span>
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed">
        Detectors are 7-dimensional; circles show their projected footprint on these two axes, so
        apparent overlap with a green point may not exist in the full space.
      </p>
    </div>
  );
};

const AxisPicker = ({ label, features, value, onChange }) => (
  <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
    {label}
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="ns-focus rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200"
    >
      {features.map((f, i) => (
        <option key={f} value={i}>{FEATURE_LABELS[f] || f}</option>
      ))}
    </select>
  </label>
);
