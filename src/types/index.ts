/**
 * Core type definitions for CodeContext Memory
 */

export interface ProjectStatus {
  projectId: string;
  projectName: string;
  createdAt: Date;
  lastActive: Date;
  filesTracked: number;
  conversations: number;
  patterns: number;
  memorySize: string;
  recentActivity: Activity[];
}

export interface Activity {
  timestamp: Date;
  description: string;
  type: 'scan' | 'memory' | 'conversation' | 'pattern';
}

export interface ProjectAnalysis {
  files: FileInfo[];
  patterns: CodePattern[];
  architecture: ProjectArchitecture;
  dependencies: Dependency[];
  metrics: ProjectMetrics;
}

export interface FileInfo {
  path: string;
  language: string;
  size: number;
  lines: number;
  lastModified: Date;
  hash: string;
}

export interface CodePattern {
  id: string;
  type: 'function' | 'class' | 'module' | 'pattern' | 'style';
  name: string;
  description: string;
  frequency: number;
  confidence: number;
  examples: string[];
  file: string;
  lines: [number, number];
}

export interface ProjectArchitecture {
  type: 'web' | 'api' | 'cli' | 'library' | 'mobile' | 'desktop' | 'unknown';
  frameworks: string[];
  languages: string[];
  buildTools: string[];
  packageManagers: string[];
  testFrameworks: string[];
}

export interface Dependency {
  name: string;
  version: string;
  type: 'production' | 'development' | 'peer';
  manager: 'npm' | 'yarn' | 'pip' | 'cargo' | 'go' | 'maven' | 'unknown';
}

export interface ProjectMetrics {
  totalLines: number;
  totalFiles: number;
  codeFiles: number;
  testFiles: number;
  configFiles: number;
  complexity: 'low' | 'medium' | 'high';
  maintainability: number; // 0-100
  testCoverage?: number; // 0-100
}

export interface Memory {
  id: string;
  type: 'conversation' | 'decision' | 'pattern' | 'note';
  content: string;
  context?: string;
  timestamp: Date;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface SearchOptions {
  type?: string;
  limit?: number;
  since?: Date;
  tags?: string[];
}

export interface VSCodeContext {
  file: string;
  line?: number;
  projectMemory: ProjectStatus;
  relatedPatterns: CodePattern[];
  recentMemories: Memory[];
  suggestions: string[];
}

export interface MemoryConfig {
  projectPath: string;
  dbPath: string;
  scanIgnore: string[];
  autoScan: boolean;
  maxMemories: number;
  retentionDays: number;
}