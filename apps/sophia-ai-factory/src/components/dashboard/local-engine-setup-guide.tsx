'use client';

/**
 * Local Engine Setup Guide Component
 * Step-by-step setup guide for Apple Silicon local rendering engine.
 *
 * @module components/dashboard/local-engine-setup-guide
 */

import React from 'react';
import { Terminal, Copy, Check, Cpu, Key, RefreshCw, Loader2, ShieldCheck } from 'lucide-react';
import { useLocalEngine } from './use-local-engine';

export function LocalEngineSetupGuide() {
  const {
    installCommand,
    apiKey,
    copiedCmd,
    copiedKey,
    isLoadingKey,
    isGeneratingKey,
    copyCommand,
    copyKey,
    generateNewKey,
  } = useLocalEngine();

  return (
    <div className="rounded-2xl bg-gradient-to-br from-indigo-950/40 via-purple-950/20 to-black/60 border border-indigo-500/20 p-6 shadow-xl backdrop-blur-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              Zero-Config Local Rendering Engine
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Apple Silicon (M1/M2/M3)
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Offload video rendering, local Whisper voice transcription, and FFmpeg stitching directly to your Mac.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded-lg">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Private & Secure</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Step 1: One-liner Terminal installer */}
        <div className="space-y-2 p-3.5 rounded-xl bg-black/40 border border-white/5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-300 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-indigo-400" />
              Step 1: Run Installer Script
            </span>
            <button
              onClick={copyCommand}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
              title="Copy install command"
            >
              {copiedCmd ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedCmd ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <div className="font-mono bg-black/60 p-2.5 rounded-lg border border-white/10 text-gray-200 select-all overflow-x-auto text-[11px] leading-relaxed">
            {installCommand}
          </div>
        </div>

        {/* Step 2: Connection API Key */}
        <div className="space-y-2 p-3.5 rounded-xl bg-black/40 border border-white/5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-indigo-400" />
              Step 2: Engine Connection Key
            </span>
            {apiKey ? (
              <button
                onClick={copyKey}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
                title="Copy API key"
              >
                {copiedKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey ? 'Copied' : 'Copy'}</span>
              </button>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-2 bg-black/60 p-2.5 rounded-lg border border-white/10 text-[11px] font-mono min-h-[38px]">
            {isLoadingKey ? (
              <div className="flex items-center gap-1.5 text-gray-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Checking active keys...</span>
              </div>
            ) : apiKey ? (
              <span className="text-indigo-300 select-all truncate">{apiKey}</span>
            ) : (
              <div className="flex items-center justify-between w-full">
                <span className="text-gray-400">No active connection key</span>
                <button
                  onClick={generateNewKey}
                  disabled={isGeneratingKey}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-sans text-xs transition-colors disabled:opacity-50"
                >
                  {isGeneratingKey ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                  <span>Generate Key</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
