import chalk from 'chalk';

async function runSmokeTest() {
  const targetUrl = process.env.TARGET_URL || 'http://localhost:3000';
  console.log(chalk.blue(`🚀 Starting Smoke Test against: ${targetUrl}`));

  let success = true;

  // 1. Health Check
  try {
    const secret = process.env.HEALTH_CHECK_SECRET;
    const healthUrl = secret
      ? `${targetUrl}/api/health?token=${secret}`
      : `${targetUrl}/api/health`;

    // Mask secret in logs
    const displayUrl = secret ? healthUrl.replace(secret, '***') : healthUrl;
    console.log(chalk.yellow(`\n👉 Checking Health Endpoint: ${displayUrl}`));

    const start = Date.now();
    const res = await fetch(healthUrl);
    const duration = Date.now() - start;

    if (res.ok) {
      const data = await res.json();
      if (data.status === 'healthy' || data.status === 'degraded') {
        console.log(chalk.green(`✅ Health Check Passed (${duration}ms)`));
        if (secret) {
           console.log(chalk.dim(JSON.stringify(data, null, 2)));
        }
      } else {
        console.log(chalk.red(`❌ Health Check Failed: Status is ${data.status}`));
        success = false;
      }
    } else {
      console.log(chalk.red(`❌ Health Check Failed: HTTP ${res.status}`));
      success = false;
    }
  } catch (error) {
    console.log(chalk.red(`❌ Health Check Failed: Connection Error`));
    console.error(error);
    success = false;
  }

  // 2. Home Page Load
  try {
    console.log(chalk.yellow(`\n👉 Checking Home Page: ${targetUrl}`));
    const start = Date.now();
    const res = await fetch(targetUrl);
    const duration = Date.now() - start;

    if (res.ok) {
      console.log(chalk.green(`✅ Home Page Loaded (${duration}ms)`));
    } else {
      console.log(chalk.red(`❌ Home Page Failed: HTTP ${res.status}`));
      success = false;
    }
  } catch (error) {
    console.log(chalk.red(`❌ Home Page Failed: Connection Error`));
    console.error(error);
    success = false;
  }

  // Summary
  console.log('\n' + '='.repeat(30));
  if (success) {
    console.log(chalk.green.bold('✨ SMOKE TEST PASSED'));
    process.exit(0);
  } else {
    console.log(chalk.red.bold('🔥 SMOKE TEST FAILED'));
    process.exit(1);
  }
}

runSmokeTest();
