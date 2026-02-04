import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { config } = body;

    if (!config) {
      return NextResponse.json({ success: false, message: "No config provided" }, { status: 400 });
    }

    // Construct env content
    let envContent = '';
    const envPath = path.join(process.cwd(), '.env.local');

    // Read existing .env.local if it exists to preserve other keys
    try {
      const existingEnv = await fs.readFile(envPath, 'utf-8');
      envContent = existingEnv;
      // Simple appending strategy or replacement could be complex.
      // For a setup wizard, usually we append or overwrite specific keys.
      // Let's verify if lines exist and replace them, or append if new.

      const lines = existingEnv.split('\n');
      const newKeys = Object.keys(config);

      const updatedLines = lines.map(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          if (newKeys.includes(key)) {
            // Replace this line
            const val = config[key];
            delete config[key]; // Mark as handled
            return `${key}="${val}"`;
          }
        }
        return line;
      });

      // Append remaining new keys
      Object.keys(config).forEach(key => {
        updatedLines.push(`${key}="${config[key]}"`);
      });

      envContent = updatedLines.join('\n');

    } catch (_error) {
      // File doesn't exist, create new
      Object.keys(config).forEach(key => {
        envContent += `${key}="${config[key]}"\n`;
      });
    }

    // Write to .env.local
    // Note: This only works in local development or environments with write access.
    // In Vercel, this will fail. We should catch that.
    try {
      await fs.writeFile(envPath, envContent);

      // Also set a marker that setup is done
      // We can use a cookie or just rely on the existence of keys.
      // Ideally, we add NEXT_PUBLIC_IS_CONFIGURED="true"
      if (!envContent.includes('NEXT_PUBLIC_IS_CONFIGURED')) {
         await fs.appendFile(envPath, '\nNEXT_PUBLIC_IS_CONFIGURED="true"\n');
      }

      return NextResponse.json({ success: true, message: "Configuration saved" });
    } catch (writeError) {
      console.error("Failed to write .env.local", writeError);
      return NextResponse.json({
        success: false,
        message: "Could not write to file system (likely read-only environment). Please download the .env file.",
        envContent: envContent
      }, { status: 500 }); // Status 500 triggers the UI to show manual download
    }

  } catch (error) {
    console.error("Save error", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
