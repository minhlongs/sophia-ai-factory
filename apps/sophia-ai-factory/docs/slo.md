# Service Level Objectives (SLOs)

This document defines the SLOs for Sophia AI Factory production service.

## Overview

SLOs are measured in Honeycomb and tracked over rolling 30-day windows.

## Latency SLO

- **Target**: p95 request latency < 500ms
- **Measurement**: All API requests (excluding static assets)
- **Baseline**: Establish over first 7 days of production data
- **Alert**: Burn rate > 2 (error budget consumption > 2x expected)

## Availability SLO

- **Target**: 99.9% successful responses (2xx/3xx) over 30 days
- **Measurement**: All API and page requests
- **Calculation**: `successful_requests / total_requests`
- **Alert**: Availability < 99.9% for 1 hour window

## Error Rate SLO

- **Target**: < 0.1% server errors (5xx) over 30 days
- **Measurement**: API requests only
- **Alert**: Error rate > 0.5% for 15 minutes

## Instrumentation

- Traces exported to Honeycomb with attributes:
  - `http.method`
  - `http.route`
  - `component` (api, middleware, inngest)
  - `duration_ms`
  - `http.status_code`

- Metrics recorded via in-memory ring buffer at `/api/metrics` (protected)

## Dashboards

- Honeycomb board: `sophia-prod` → "SLO Overview"
- Panels:
  - Latency heatmap (p50/p95/p99 by route)
  - Error rate by status code
  - Availability gauge
  - Burn rate tracker
  - Top slowest routes

## Review Cadence

- Weekly SLO review (Monday 09:00 UTC)
- Monthly error budget burn assessment
- Alert tuning based on false positive rate
