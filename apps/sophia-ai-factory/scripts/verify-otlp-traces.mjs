#!/usr/bin/env node

/**
 * OTLP Trace Export Verification Script
 *
 * This script verifies that OpenTelemetry traces can be exported from local development
 * to the configured vendor endpoint (Honeycomb).
 *
 * Usage:
 *   tsx scripts/verify-otlp-traces.mjs
 *
 * Prerequisites:
 *   - HONEYCOMB_API_KEY set in environment
 *   - Dependencies installed: npm install @opentelemetry/sdk-trace-base @opentelemetry/exporter-trace-otlp-http
 *
 * The script will:
 *   1. Initialize OTel with test configuration
 *   2. Create a test span with attributes
 *   3. Export the span to the OTLP endpoint
 *   4. Report success/failure
 *
 * For manual verification in Honeycomb UI:
 *   - Look for service.name = "sophia-api" (or OTEL_SERVICE_NAME)
 *   - Search for span name "verify-otlp-test"
 *   - Check recent traces (last 5-10 minutes)
 */

import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { BasicTracerProvider, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { trace } from '@opentelemetry/api';

// Configuration from environment
const config = {
  apiKey: process.env.HONEYCOMB_API_KEY,
  dataset: process.env.HONEYCOMB_DATASET || 'sophia-prod',
  endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'https://api.honeycomb.io',
  serviceName: process.env.OTEL_SERVICE_NAME || 'sophia-api',
  sampleRate: parseFloat(process.env.OTEL_SAMPLERATE || '1'), // Use 100% for test
};

// Validate required config
if (!config.apiKey) {
  console.error('❌ HONEYCOMB_API_KEY environment variable is required');
  console.error('   Set it in your .env.local file or export it directly');
  console.error('   Example: export HONEYCOMB_API_KEY=your-honeycomb-api-key');
  process.exit(1);
}

console.log('🔍 OTLP Trace Export Verification');
console.log('─'.repeat(50));
console.log(`Endpoint: ${config.endpoint}/v1/traces`);
console.log(`Dataset: ${config.dataset}`);
console.log(`Service: ${config.serviceName}`);
console.log(`Sample Rate: ${config.sampleRate}`);
console.log('');

async function verifyOTLP() {
  let success = false;
  let errorMessage = '';

  try {
    // Enable debug diagnostics
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

    // Build headers for Honeycomb
    const headers = {
      'x-honeycomb-api-key': config.apiKey,
      'x-honeycomb-dataset': config.dataset,
    };

    // Create resource
    const resource = resourceFromAttributes({
      [SEMRESATTRS_SERVICE_NAME]: config.serviceName,
      'verify.test': 'true',
      'local.dev': true,
    });

    // Create trace exporter
    const traceExporter = new OTLPTraceExporter({
      url: `${config.endpoint}/v1/traces`,
      headers,
      timeoutMillis: 15000,
    });

    // Create tracer provider with processor
    const tracerProvider = new BasicTracerProvider({
      resource,
      spanProcessors: [new SimpleSpanProcessor(traceExporter)],
      sampler: new TraceIdRatioBasedSampler(config.sampleRate),
    });

    // Set global tracer provider
    trace.setGlobalTracerProvider(tracerProvider);

    console.log('📝 Creating test span...');

    // Get tracer and create span
    const tracer = trace.getTracer('sophia-test-verify');
    const startTime = Date.now();

    const span = tracer.startSpan('verify-otlp-test', {
      attributes: {
        'test.purpose': 'otlp-export-verification',
        'test.runId': `local-${Date.now()}`,
        'local.dev': true,
        'component': 'verification-script',
      },
    });

    // Add some events to make the span more visible
    span.addEvent('test.started', { timestamp: new Date().toISOString() });
    span.setAttribute('test.durationMs', 0);

    // End the span
    span.end();

    const duration = Date.now() - startTime;

    console.log(`   Span created and ended in ${duration}ms`);
    console.log('   Span attributes:');
    console.log('     - test.purpose: otlp-export-verification');
    console.log('     - test.runId: local-<timestamp>');
    console.log('     - local.dev: true');

    // Force flush and wait for export
    console.log('');
    console.log('📤 Exporting traces to OTLP endpoint...');

    // Set up error capture for the exporter
    let exportError = null;
    const originalOnError = traceExporter.onError;
    if (originalOnError) {
      traceExporter.onError = (error) => {
        exportError = error;
        if (originalOnError) originalOnError(error);
      };
    }

    await tracerProvider.forceFlush();

    // Give a small delay for async export
    await new Promise(resolve => setTimeout(resolve, 2000));

    await traceExporter.shutdown();

    if (exportError) {
      throw new Error(`Trace export failed: ${exportError.message}`);
    }

    console.log('✅ Trace export attempt completed');
    console.log('');
    console.log('─'.repeat(50));
    console.log('VERIFICATION COMPLETE');
    console.log('─'.repeat(50));
    console.log('');
    console.log('📊 Next steps:');
    console.log('   1. Open Honeycomb UI: https://ui.honeycomb.io');
    console.log('   2. Select dataset:', config.dataset);
    console.log('   3. Search for span name: "verify-otlp-test"');
    console.log('   4. Check that the span appears with attributes:');
    console.log('      - service.name =', config.serviceName);
    console.log('      - test.purpose = "otlp-export-verification"');
    console.log('      - local.dev = true');
    console.log('');
    console.log('💡 If traces do not appear in Honeycomb within 2-3 minutes:');
    console.log('   - Verify HONEYCOMB_API_KEY is valid and has write permissions');
    console.log('   - Check dataset name is correct and exists in Honeycomb');
    console.log('   - Check network connectivity (no firewall blocking)');
    console.log('   - Review debug logs above for OTel diagnostics');
    console.log('   - Run: npm run verify:otlp -- --verbose (if supported)');
    console.log('');

    success = true;
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    console.error('');
    console.error('❌ OTLP verification failed');
    console.error('   Error:', errorMessage);
    console.error('');
    console.error('─'.repeat(50));
    console.error('TROUBLESHOOTING:');
    console.error('─'.repeat(50));
    console.error('1. Ensure dependencies are installed:');
    console.error('   npm install @opentelemetry/sdk-trace-base @opentelemetry/exporter-trace-otlp-http');
    console.error('');
    console.error('2. Verify environment variables in .env.local:');
    console.error('   HONEYCOMB_API_KEY=your_key');
    console.error('   HONEYCOMB_DATASET=sophia-prod');
    console.error('   OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io');
    console.error('');
    console.error('3. Test with curl to check endpoint access:');
    console.error(`   curl -I ${config.endpoint}/v1/traces`);
    console.error('');
    console.error('4. Check if API key is valid by examining Honeycomb account settings');
  }

  return { success, errorMessage };
}

// Run verification
const result = await verifyOTLP();
process.exit(result.success ? 0 : 1);
