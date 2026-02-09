import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { setupConfigSchema } from '@/lib/schemas';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate with Zod
    const validation = setupConfigSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, message: "Invalid configuration", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { config } = validation.data;
    // Type assertion because validation guarantees config is Record<string, string>
    const typedConfig = config as Record<string, string>;

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
      const newKeys = Object.keys(typedConfig);

      const updatedLines = lines.map(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          if (newKeys.includes(key)) {
            // Replace this line
            const val = typedConfig[key];
            delete typedConfig[key]; // Mark as handled
            return `${key}="${val}"`;
          }
        }
        return line;
      });

      // Append remaining new keys
      Object.keys(typedConfig).forEach(key => {
        updatedLines.push(`${key}="${typedConfig[key]}"`);
      });

      envContent = updatedLines.join('\n');

    } catch {
      // File doesn't exist, create new
      Object.keys(typedConfig).forEach(key => {
        envContent += `${key}="${typedConfig[key]}"\n`;
      });
    }

    // Write to .env.local
    // Note: This only works in local development or environments with write access.

    // Check for Vercel environment
    if (process.env.VERCEL) {
      return NextResponse.json({
        success: false,
        message: "Serverless environment detected (Vercel). Please download the .env file manually.",
        envContent: envContent
      }, { status: 200 }); // Return 200 so we can handle the logic in UI without treating it as a crash
    }

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
      return NextResponse.json({
        success: false,
        message: "Could not write to file system (likely read-only environment). Please download the .env file.",
        envContent: envContent
      }, { status: 500 }); // Status 500 triggers the UI to show manual download
    }

  } catch (error) {
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
