# GrooveLinx Pocket Meter Specification

## Purpose

The Pocket Meter measures band groove stability rather than simple tempo accuracy.

The goal is to help bands understand how tightly they are playing together and how stable their groove is during rehearsals and recordings.

The system focuses on **rhythmic onset detection and tempo stability**, not full instrument separation.

---

# Core Metrics

## 1. Tempo Stability Score (Primary Metric)

Range: **0–100**

This is the primary number displayed in the UI.

It represents how stable the beat spacing is over time.

Calculation concept:

```
stabilityScore = 100 - clamp(stdDev(IOIs) / targetBeatMs * 100)
```

Where:

* IOI = Inter-Onset Interval
* stdDev(IOIs) = beat spacing variance
* targetBeatMs = expected beat duration

Interpretation:

| Score  | Meaning                |
| ------ | ---------------------- |
| 90–100 | Extremely tight groove |
| 75–89  | Good groove            |
| 60–74  | Some drift             |
| <60    | Unstable tempo         |

---

## 2. Pocket Position

Indicates whether the band sits ahead of, centered on, or behind the beat.

Output labels:

```
AHEAD
CENTERED
BEHIND
```

Derived from:

```
median(IOI) vs targetBeatPeriod
```

Displayed alongside a groove spectrum visualization:

```
EARLY | POCKET | LATE
```

Position marker indicates where the band sits relative to the beat.

---

## 3. Beat Spacing Variance

Technical metric displayed in milliseconds.

```
spacingVarianceMs = stdDev(IOIs)
```

This represents the jitter between beats.

Typical values:

| Variance | Interpretation   |
| -------- | ---------------- |
| <10ms    | Very tight       |
| 10–20ms  | Good groove      |
| 20–40ms  | Noticeable drift |
| >40ms    | Unstable         |

---

## 4. % Time In Pocket

Percentage of beats that fall within an acceptable timing window.

Used as a supporting statistic rather than the main metric.

---

# Audio Sources

The Pocket Meter must support three analysis modes.

## 1. Live Microphone

Uses device microphone during rehearsal.

Source characteristics:

* captures drum transients
* captures room audio
* lower analysis confidence

Analysis goal:

Estimate groove stability from kick and snare transients.

## 2. Recording Upload

User uploads rehearsal recording.

Advantages:

* higher accuracy
* longer analysis window
* richer reporting

## 3. Stem / Mix Upload

User uploads isolated stem or board mix.

Highest analysis quality.

Allows more precise onset detection.

---

# Audio Analysis Approach

The system uses **spectral flux onset detection**.

Frequency bands:

```
Kick Band: 50–200 Hz (weight 60%)
Transient Band: 200–8000 Hz (weight 40%)
```

Steps:

1. Compute frame-to-frame spectral increase.
2. Apply half-wave rectification.
3. Compare against adaptive noise floor.
4. Detect onset events.
5. Compute inter-onset intervals.

---

# Analysis Modes

## Live Mode

Real-time groove estimate.

Displayed metrics:

* tempo stability
* pocket position
* tempo drift graph

## File Analysis Mode

More detailed report including:

* tempo stability score
* beat spacing variance
* pocket position
* tempo drift graph
* pocket histogram
* best groove segments

---

# Confidence Model

Results should include a confidence indicator.

```
Live Mic: Low
Recording: Medium
Stem/Mix: High
```

This prevents overconfidence in noisy environments.

---

# Jam Band Support

Jam bands frequently allow tempo drift.

The Pocket Meter must distinguish between:

```
tempo drift
groove stability
```

Example:

```
Tempo Drift: +3 BPM
Groove Stability: 92%
```

Meaning the band sped up but stayed locked.

---

# Future Enhancements

Not required for v1.

Potential improvements:

* rhythm section lock (bass vs drums)
* groove personality profile
* pocket moment detection
* groove heat map across song sections

---

# Design Philosophy

The Pocket Meter should feel **musical rather than technical**.

Terminology should align with musician language:

```
In the Pocket
Groove Stability
Locked In
```

Avoid overly technical wording in the UI.
