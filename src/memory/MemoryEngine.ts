/**
 * Core Memory Engine - Persistent AI Assistant Memory
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import { Database } from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { 
  ProjectStatus, 
  ProjectAnalysis, 
  Memory, 
  SearchOptions, 
  MemoryConfig,
  Activity 
} from '../types';

export class MemoryEngine {
  private config: MemoryConfig;
  private db: Database | null = null;

  constructor(projectPath?: string) {
    this.config = {
      projectPath: projectPath || process.cwd(),
      dbPath: path.join(projectPath || process.cwd(), '.codecontext', 'memory.db'),
      scanIgnore: [
        'node_modules',
        '.git',
        'dist',
        'build',
        '.next',
        '.nuxt',
        'target',
        '__pycache__',
        '.venv',
        'venv',
        '.codecontext'
      ],
      autoScan: true,
      maxMemories: 10000,
      retentionDays: 365
    };
  }

  async initProject(projectPath: string, force = false): Promise<void> {
    this.config.projectPath = projectPath;
    this.config.dbPath = path.join(projectPath, '.codecontext', 'memory.db');

    // Create .codecontext directory
    const codecontextDir = path.join(projectPath, '.codecontext');
    await fs.ensureDir(codecontextDir);

    // Check if already initialized
    if (!force && await fs.pathExists(this.config.dbPath)) {
      throw new Error('Project already initialized. Use --force to reinitialize.');
    }

    // Initialize database
    await this.initDatabase();

    // Create project record
    const projectName = path.basename(projectPath);
    const projectId = uuidv4();

    await this.query(`
      INSERT INTO projects (id, name, path, created_at, last_active)
      VALUES (?, ?, ?, ?, ?)
    `, [projectId, projectName, projectPath, new Date().toISOString(), new Date().toISOString()]);

    // Create config file
    const configPath = path.join(codecontextDir, 'config.json');
    await fs.writeJson(configPath, {
      projectId,
      projectName,
      version: '1.0.0',
      initialized: new Date().toISOString()
    }, { spaces: 2 });

    // Create .gitignore entry
    const gitignorePath = path.join(projectPath, '.gitignore');
    if (await fs.pathExists(gitignorePath)) {
      const gitignore = await fs.readFile(gitignorePath, 'utf8');
      if (!gitignore.includes('.codecontext')) {
        await fs.appendFile(gitignorePath, '\n# CodeContext Memory\n.codecontext/\n');
      }
    }

    await this.logActivity('init', 'Project initialized with memory capabilities');
  }

  async getProjectStatus(projectPath: string): Promise<ProjectStatus> {
    this.config.projectPath = projectPath;
    this.config.dbPath = path.join(projectPath, '.codecontext', 'memory.db');

    if (!await fs.pathExists(this.config.dbPath)) {
      throw new Error('Project not initialized. Run "codecontext init" first.');
    }

    await this.connectDatabase();

    const project = await this.queryOne(`
      SELECT * FROM projects WHERE path = ?
    `, [projectPath]);

    if (!project) {
      throw new Error('Project not found in memory database');
    }

    const [filesCount, conversationsCount, patternsCount] = await Promise.all([
      this.queryOne('SELECT COUNT(*) as count FROM files'),
      this.queryOne('SELECT COUNT(*) as count FROM memories WHERE type = "conversation"'),
      this.queryOne('SELECT COUNT(*) as count FROM patterns')
    ]);

    const recentActivity = await this.query(`
      SELECT * FROM activities 
      ORDER BY created_at DESC 
      LIMIT 10
    `);

    // Get database size
    const stats = await fs.stat(this.config.dbPath);
    const memorySize = this.formatBytes(stats.size);

    return {
      projectId: project.id,
      projectName: project.name,
      createdAt: new Date(project.created_at),
      lastActive: new Date(project.last_active),
      filesTracked: filesCount.count,
      conversations: conversationsCount.count,
      patterns: patternsCount.count,
      memorySize,
      recentActivity: recentActivity.map((a: any) => ({
        timestamp: new Date(a.created_at),
        description: a.description,
        type: a.type
      }))
    };
  }

  async storeProjectAnalysis(projectPath: string, analysis: ProjectAnalysis): Promise<void> {
    this.config.projectPath = projectPath;
    this.config.dbPath = path.join(projectPath, '.codecontext', 'memory.db');

    await this.connectDatabase();

    // Store files
    for (const file of analysis.files) {
      await this.query(`
        INSERT OR REPLACE INTO files (path, language, size, lines, last_modified, hash)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [file.path, file.language, file.size, file.lines, file.lastModified.toISOString(), file.hash]);
    }

    // Store patterns
    for (const pattern of analysis.patterns) {
      await this.query(`
        INSERT OR REPLACE INTO patterns (id, type, name, description, frequency, confidence, examples, file, line_start, line_end)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        pattern.id,
        pattern.type,
        pattern.name,
        pattern.description,
        pattern.frequency,
        pattern.confidence,
        JSON.stringify(pattern.examples),
        pattern.file,
        pattern.lines[0],
        pattern.lines[1]
      ]);
    }

    // Update project metrics
    await this.query(`
      UPDATE projects SET 
        last_active = ?,
        total_files = ?,
        total_lines = ?,
        complexity = ?
      WHERE path = ?
    `, [
      new Date().toISOString(),
      analysis.metrics.totalFiles,
      analysis.metrics.totalLines,
      analysis.metrics.complexity,
      projectPath
    ]);

    await this.logActivity('scan', `Analyzed ${analysis.files.length} files, found ${analysis.patterns.length} patterns`);
  }

  async storeMemory(projectPath: string, memory: Omit<Memory, 'id'>): Promise<string> {
    this.config.projectPath = projectPath;
    this.config.dbPath = path.join(projectPath, '.codecontext', 'memory.db');

    await this.connectDatabase();

    const id = uuidv4();
    await this.query(`
      INSERT INTO memories (id, type, content, context, created_at, tags, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      memory.type,
      memory.content,
      memory.context || null,
      memory.timestamp.toISOString(),
      JSON.stringify(memory.tags || []),
      JSON.stringify(memory.metadata || {})
    ]);

    await this.logActivity('memory', `Stored ${memory.type}: ${memory.content.substring(0, 50)}...`);
    return id;
  }

  async searchMemories(projectPath: string, query?: string, options: SearchOptions = {}): Promise<Memory[]> {
    this.config.projectPath = projectPath;
    this.config.dbPath = path.join(projectPath, '.codecontext', 'memory.db');

    await this.connectDatabase();

    let sql = 'SELECT * FROM memories WHERE 1=1';
    const params: any[] = [];

    if (options.type) {
      sql += ' AND type = ?';
      params.push(options.type);
    }

    if (query) {
      sql += ' AND (content LIKE ? OR context LIKE ?)';
      params.push(`%${query}%`, `%${query}%`);
    }

    if (options.since) {
      sql += ' AND created_at >= ?';
      params.push(options.since.toISOString());
    }

    sql += ' ORDER BY created_at DESC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    const results = await this.query(sql, params);

    return results.map((row: any) => ({
      id: row.id,
      type: row.type,
      content: row.content,
      context: row.context,
      timestamp: new Date(row.created_at),
      tags: JSON.parse(row.tags || '[]'),
      metadata: JSON.parse(row.metadata || '{}')
    }));
  }

  async exportMemory(projectPath: string, format: 'json' | 'markdown' = 'json'): Promise<string> {
    this.config.projectPath = projectPath;
    this.config.dbPath = path.join(projectPath, '.codecontext', 'memory.db');

    await this.connectDatabase();

    const status = await this.getProjectStatus(projectPath);
    const memories = await this.searchMemories(projectPath);
    const patterns = await this.query('SELECT * FROM patterns');
    const files = await this.query('SELECT * FROM files');

    const data = {
      project: status,
      memories,
      patterns,
      files,
      exportedAt: new Date().toISOString()
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else {
      // Markdown format
      let md = `# CodeContext Memory Export\n\n`;
      md += `**Project:** ${status.projectName}\n`;
      md += `**Exported:** ${new Date().toLocaleString()}\n\n`;
      
      md += `## Statistics\n\n`;
      md += `- Files Tracked: ${status.filesTracked}\n`;
      md += `- Conversations: ${status.conversations}\n`;
      md += `- Patterns: ${status.patterns}\n`;
      md += `- Memory Size: ${status.memorySize}\n\n`;

      if (memories.length > 0) {
        md += `## Memories\n\n`;
        memories.forEach(memory => {
          md += `### ${memory.type} - ${memory.timestamp.toLocaleDateString()}\n\n`;
          md += `${memory.content}\n\n`;
          if (memory.context) {
            md += `*Context: ${memory.context}*\n\n`;
          }
        });
      }

      return md;
    }
  }

  async clearMemory(projectPath: string): Promise<void> {
    this.config.projectPath = projectPath;
    this.config.dbPath = path.join(projectPath, '.codecontext', 'memory.db');

    await this.connectDatabase();

    await this.query('DELETE FROM memories');
    await this.query('DELETE FROM patterns');
    await this.query('DELETE FROM files');
    await this.query('DELETE FROM activities');

    await this.logActivity('clear', 'All memory data cleared');
  }

  private async initDatabase(): Promise<void> {
    await this.connectDatabase();

    const schema = `
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        last_active TEXT NOT NULL,
        total_files INTEGER DEFAULT 0,
        total_lines INTEGER DEFAULT 0,
        complexity TEXT DEFAULT 'unknown'
      );

      CREATE TABLE IF NOT EXISTS files (
        path TEXT PRIMARY KEY,
        language TEXT,
        size INTEGER,
        lines INTEGER,
        last_modified TEXT,
        hash TEXT
      );

      CREATE TABLE IF NOT EXISTS patterns (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        frequency INTEGER DEFAULT 1,
        confidence REAL DEFAULT 0.0,
        examples TEXT,
        file TEXT,
        line_start INTEGER,
        line_end INTEGER
      );

      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        context TEXT,
        created_at TEXT NOT NULL,
        tags TEXT DEFAULT '[]',
        metadata TEXT DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
      CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at);
      CREATE INDEX IF NOT EXISTS idx_patterns_type ON patterns(type);
      CREATE INDEX IF NOT EXISTS idx_files_language ON files(language);
    `;

    await this.execute(schema);
  }

  private async connectDatabase(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      this.db = new Database(this.config.dbPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async query(sql: string, params: any[] = []): Promise<any[]> {
    if (!this.db) throw new Error('Database not connected');

    return new Promise((resolve, reject) => {
      this.db!.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  private async queryOne(sql: string, params: any[] = []): Promise<any> {
    const results = await this.query(sql, params);
    return results[0];
  }

  private async execute(sql: string, params: any[] = []): Promise<void> {
    if (!this.db) throw new Error('Database not connected');

    return new Promise((resolve, reject) => {
      this.db!.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async logActivity(type: string, description: string): Promise<void> {
    await this.query(`
      INSERT INTO activities (type, description, created_at)
      VALUES (?, ?, ?)
    `, [type, description, new Date().toISOString()]);
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}