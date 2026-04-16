/**
 * globals.d.ts
 * TypeScript ambient declarations for the OpenClaw Setup Wizard IIFE bundle.
 *
 * These variables exist at IIFE scope (shared across all concatenated setup/ files)
 * but are invisible to the IDE because there are no import/export statements.
 * This file gives VS Code IntelliSense visibility into the shared IIFE globals
 * and into variables that flow from generateNativeScript() scope into the os/ generators.
 *
 * Build: node build.mjs  →  dist/setup.js  (all files concatenated into one IIFE)
 */

// ── IIFE-level data constants (from setup/data/) ──────────────────────────────
declare var PROVIDERS: Record<string, {
  id: string; name: string; envKey?: string; envLabel?: string;
  baseURL?: string; isProxy?: boolean; isLocal?: boolean; requiresOllama?: boolean;
}>;
declare var CHANNELS: Record<string, {
  id: string; name: string; pluginInstall?: string; isZalo?: boolean;
}>;
declare var SKILLS: Array<{ id: string; name: string; slug?: string }>;
declare var PLUGINS: Array<{ id: string; name: string; package: string }>;
declare var DEFAULT_SECURITY_RULES: Record<'vi' | 'en', string>;
declare var state: {
  currentStep: number; totalSteps: number; channel: string; deployMode: string;
  nativeOs: string; botCount: number; activeBotIndex: number;
  config: {
    provider: string; model: string; apiKey: string; botToken: string; botName: string;
    description: string; userInfo: string; projectPath: string;
    skills: string[]; plugins: string[]; securityRules?: string;
    botTokens?: string[];
  };
  bots: Array<{
    name?: string; desc?: string; persona?: string; slashCmd?: string;
    token?: string; apiKey?: string; provider?: string; model?: string;
  }>;
};

// ── IIFE-level constants (from setup/data/header.js) ─────────────────────────
declare var openClawRuntimePackages: string;
declare function getGatewayAllowedOrigins(port: number): string[];
declare function populateEnvContent(): void;

// ── generateNativeScript() scope variables ────────────────────────────────────
// These are computed inside generateNativeScript() and passed to os/ generators
// via the ctx object. They are declared here to suppress IDE warnings in
// setup/generators/ files that reference them directly (pre-ctx migration).
declare var ch: typeof CHANNELS[string] | undefined;
declare var provider: typeof PROVIDERS[string] | undefined;
declare var is9Router: boolean;
declare var isOllama: boolean;
declare var isMultiBot: boolean;
declare var isComboChannel: boolean;
declare var hasBrowser: boolean;
declare var isVi: boolean;
declare var selectedModel: string;
declare var projectDir: string;
declare var todayStamp: string;
declare var allPlugins: string[];
declare var pluginCmd: string;
declare var nativeSkillInstallCmds: string[];
declare var nativeSkillConfigs: Array<{ slug: string }>;
declare var relayPluginSpec: string;
declare var multiBotAgentMetas: Array<{
  idx: number; name: string; desc: string; persona: string; slashCmd: string;
  token: string; agentId: string; accountId: string; workspaceDir: string;
}>;

// ── generateNativeScript() inner functions (pre-ctx migration) ────────────────
declare function providerLines(arr: string[], shell: 'bat' | 'sh'): void;
declare function sharedNativeFileMap(): Record<string, string>;
declare function sharedNativeEnvContent(): string;
declare function sharedNativeExecApprovalsContent(): string;
declare function sharedNativeConfigContent(): string;

// ── IIFE-level generator functions (from setup/generators/ and setup/os/) ─────
declare function native9RouterSyncScriptContent(): string;
declare function native9RouterServerEntryLookup(): string;
declare function windowsHiddenNodeLaunch(
  targetPath: string, extraEnv?: Record<string, string>, extraArgs?: string[]
): string;
declare function generateUninstallScript(): { name: string; content: string } | null;

declare function appendBatWriteCommands(arr: string[], files: Record<string, string>): void;
declare function appendShWriteCommands(arr: string[], files: Record<string, string>): void;
declare function batEscapeEchoLine(line: string): string;
declare function mapWindowsNativeFiles(files: Record<string, string>): Record<string, string>;

declare function botFiles(botIndex: number): Record<string, string>;
declare function botConfigContent(botIndex: number): string;
declare function botEnvContent(botIndex: number): string;
declare function botAuthProfilesContent(botIndex: number): string;
declare function botWorkspaceFiles(botIndex: number): Record<string, string>;
declare function botExecApprovalsContent(botIndex: number): string;
declare function botAgentYamlContent(botIndex: number): string;

// ── Extracted OS generators (setup/os/) ───────────────────────────────────────
declare function generateWinBat(ctx: object): { scriptName: string; scriptContent: string };
declare function generateMacOsSh(ctx: object): { scriptName: string; scriptContent: string };
declare function generateVpsSh(ctx: object): { scriptName: string; scriptContent: string };
declare function generateLinuxSh(ctx: object): { scriptName: string; scriptContent: string };

// ── Gateway & misc generators (setup/generators/) ─────────────────────────────
declare function generateGatewayStartBat(opts: object): string[];
declare function generateGatewayStartNohup(opts: object): string[];
declare function generateGatewayStartPm2(opts: object): string[];
declare function generateZaloLoginBat(opts: object): string[];
declare function generateZaloLoginSh(opts: object): string[];
