/**
 * Project Scanner - Analyzes project structure and code patterns
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import * as crypto from 'crypto';
import { glob } from 'fast-glob';
// @ts-ignore
import { parse as parseGitignore } from 'gitignore-parser';
import { 
  ProjectAnalysis, 
  FileInfo, 
  CodePattern, 
  ProjectArchitecture, 
  Dependency,
  ProjectMetrics 
} from '../types';
import { v4 as uuidv4 } from 'uuid';

export class ProjectScanner {
  private gitignore: any = null;

  async scanProject(projectPath: string, deep = false): Promise<ProjectAnalysis> {
    // Load gitignore
    const gitignorePath = path.join(projectPath, '.gitignore');
    if (await fs.pathExists(gitignorePath)) {
      const gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
      this.gitignore = parseGitignore(gitignoreContent);
    }

    // Scan files
    const files = await this.scanFiles(projectPath);
    
    // Analyze architecture
    const architecture = await this.analyzeArchitecture(projectPath, files);
    
    // Scan dependencies
    const dependencies = await this.scanDependencies(projectPath);
    
    // Extract patterns (basic or deep)
    const patterns = deep ? 
      await this.extractDeepPatterns(projectPath, files) : 
      await this.extractBasicPatterns(files);
    
    // Calculate metrics
    const metrics = this.calculateMetrics(files, patterns);

    return {
      files,
      patterns,
      architecture,
      dependencies,
      metrics
    };
  }

  private async scanFiles(projectPath: string): Promise<FileInfo[]> {
    const patterns = [
      '**/*.{js,jsx,ts,tsx,py,go,rs,java,cpp,c,h,hpp,php,rb,swift,kt}',
      '**/*.{json,yaml,yml,toml,xml}',
      '**/*.{md,txt,rst}',
      '**/package.json',
      '**/Cargo.toml',
      '**/requirements.txt',
      '**/go.mod',
      '**/pom.xml'
    ];

    const ignore = [
      'node_modules/**',
      '.git/**',
      'dist/**',
      'build/**',
      '**/*.min.js',
      '**/.codecontext/**'
    ];

    const filePaths = await glob(patterns, {
      cwd: projectPath,
      ignore,
      absolute: false
    });

    const files: FileInfo[] = [];

    for (const filePath of filePaths) {
      if (this.gitignore && !this.gitignore.accepts(filePath)) {
        continue;
      }

      const fullPath = path.join(projectPath, filePath);
      const stats = await fs.stat(fullPath);
      
      if (stats.isFile() && stats.size < 1024 * 1024) { // Skip files > 1MB
        const content = await fs.readFile(fullPath, 'utf8').catch(() => '');
        const lines = content.split('\n').length;
        const hash = crypto.createHash('md5').update(content).digest('hex');

        files.push({
          path: filePath,
          language: this.detectLanguage(filePath),
          size: stats.size,
          lines,
          lastModified: stats.mtime,
          hash
        });
      }
    }

    return files;
  }

  private async analyzeArchitecture(projectPath: string, files: FileInfo[]): Promise<ProjectArchitecture> {
    const frameworks: string[] = [];
    const languages = [...new Set(files.map(f => f.language))];
    const buildTools: string[] = [];
    const packageManagers: string[] = [];
    const testFrameworks: string[] = [];

    // Check for package.json
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (await fs.pathExists(packageJsonPath)) {
      packageManagers.push('npm');
      const packageJson = await fs.readJson(packageJsonPath);
      
      // Detect frameworks from dependencies
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      if (allDeps.react) frameworks.push('React');
      if (allDeps.vue) frameworks.push('Vue');
      if (allDeps.angular) frameworks.push('Angular');
      if (allDeps.express) frameworks.push('Express');
      if (allDeps.fastify) frameworks.push('Fastify');
      if (allDeps.next) frameworks.push('Next.js');
      if (allDeps.nuxt) frameworks.push('Nuxt.js');
      if (allDeps.svelte) frameworks.push('Svelte');

      // Detect test frameworks
      if (allDeps.jest) testFrameworks.push('Jest');
      if (allDeps.mocha) testFrameworks.push('Mocha');
      if (allDeps.vitest) testFrameworks.push('Vitest');
      if (allDeps.cypress) testFrameworks.push('Cypress');

      // Detect build tools
      if (allDeps.webpack) buildTools.push('Webpack');
      if (allDeps.vite) buildTools.push('Vite');
      if (allDeps.rollup) buildTools.push('Rollup');
      if (allDeps.parcel) buildTools.push('Parcel');
    }

    // Check for other package managers
    if (await fs.pathExists(path.join(projectPath, 'yarn.lock'))) {
      packageManagers.push('yarn');
    }
    if (await fs.pathExists(path.join(projectPath, 'Cargo.toml'))) {
      packageManagers.push('cargo');
    }
    if (await fs.pathExists(path.join(projectPath, 'go.mod'))) {
      packageManagers.push('go');
    }
    if (await fs.pathExists(path.join(projectPath, 'requirements.txt'))) {
      packageManagers.push('pip');
    }

    // Determine project type
    let type: ProjectArchitecture['type'] = 'unknown';
    if (frameworks.some(f => ['React', 'Vue', 'Angular', 'Svelte'].includes(f))) {
      type = 'web';
    } else if (frameworks.some(f => ['Express', 'Fastify'].includes(f))) {
      type = 'api';
    } else if (files.some(f => f.path.includes('bin/') || f.path.includes('cmd/'))) {
      type = 'cli';
    } else if (files.some(f => f.path.includes('lib/') && languages.includes('javascript'))) {
      type = 'library';
    }

    return {
      type,
      frameworks,
      languages,
      buildTools,
      packageManagers,
      testFrameworks
    };
  }

  private async scanDependencies(projectPath: string): Promise<Dependency[]> {
    const dependencies: Dependency[] = [];

    // Node.js dependencies
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (await fs.pathExists(packageJsonPath)) {
      const packageJson = await fs.readJson(packageJsonPath);
      
      Object.entries(packageJson.dependencies || {}).forEach(([name, version]) => {
        dependencies.push({
          name,
          version: version as string,
          type: 'production',
          manager: 'npm'
        });
      });

      Object.entries(packageJson.devDependencies || {}).forEach(([name, version]) => {
        dependencies.push({
          name,
          version: version as string,
          type: 'development',
          manager: 'npm'
        });
      });
    }

    // Python dependencies
    const requirementsPath = path.join(projectPath, 'requirements.txt');
    if (await fs.pathExists(requirementsPath)) {
      const requirements = await fs.readFile(requirementsPath, 'utf8');
      requirements.split('\n').forEach(line => {
        const match = line.trim().match(/^([a-zA-Z0-9_-]+)([>=<]+)?(.+)?$/);
        if (match) {
          dependencies.push({
            name: match[1],
            version: match[3] || '*',
            type: 'production',
            manager: 'pip'
          });
        }
      });
    }

    // Rust dependencies
    const cargoPath = path.join(projectPath, 'Cargo.toml');
    if (await fs.pathExists(cargoPath)) {
      // Simple TOML parsing for dependencies
      const cargoToml = await fs.readFile(cargoPath, 'utf8');
      const depSection = cargoToml.match(/\[dependencies\]([\s\S]*?)(?=\[|$)/);
      if (depSection) {
        depSection[1].split('\n').forEach(line => {
          const match = line.trim().match(/^([a-zA-Z0-9_-]+)\s*=\s*"([^"]+)"/);
          if (match) {
            dependencies.push({
              name: match[1],
              version: match[2],
              type: 'production',
              manager: 'cargo'
            });
          }
        });
      }
    }

    return dependencies;
  }

  private async extractBasicPatterns(files: FileInfo[]): Promise<CodePattern[]> {
    const patterns: CodePattern[] = [];

    // Language distribution pattern
    const languageCount = files.reduce((acc, file) => {
      acc[file.language] = (acc[file.language] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(languageCount).forEach(([language, count]) => {
      if (count > 1) {
        patterns.push({
          id: uuidv4(),
          type: 'pattern',
          name: `${language} files`,
          description: `Project uses ${language} language`,
          frequency: count,
          confidence: Math.min(count / files.length, 1),
          examples: files.filter(f => f.language === language).slice(0, 3).map(f => f.path),
          file: '',
          lines: [0, 0]
        });
      }
    });

    // File naming patterns
    const namePatterns = this.extractFileNamePatterns(files);
    patterns.push(...namePatterns);

    return patterns;
  }

  private async extractDeepPatterns(projectPath: string, files: FileInfo[]): Promise<CodePattern[]> {
    const patterns = await this.extractBasicPatterns(files);

    // Analyze code files for deeper patterns
    for (const file of files.slice(0, 50)) { // Limit for performance
      if (this.isCodeFile(file.language)) {
        const filePatterns = await this.extractCodePatterns(projectPath, file);
        patterns.push(...filePatterns);
      }
    }

    return patterns;
  }

  private async extractCodePatterns(projectPath: string, file: FileInfo): Promise<CodePattern[]> {
    const patterns: CodePattern[] = [];
    const content = await fs.readFile(path.join(projectPath, file.path), 'utf8').catch(() => '');
    const lines = content.split('\n');

    // Function patterns
    const functionPattern = this.getFunctionPattern(file.language);
    if (functionPattern) {
      let functionCount = 0;
      lines.forEach((line, index) => {
        if (functionPattern.test(line)) {
          functionCount++;
        }
      });

      if (functionCount > 0) {
        patterns.push({
          id: uuidv4(),
          type: 'function',
          name: `${file.language} functions`,
          description: `Functions in ${file.path}`,
          frequency: functionCount,
          confidence: 0.9,
          examples: [file.path],
          file: file.path,
          lines: [1, lines.length]
        });
      }
    }

    // Import/require patterns
    const importLines = lines.filter(line => 
      line.includes('import ') || 
      line.includes('require(') || 
      line.includes('from ') ||
      line.includes('#include')
    );

    if (importLines.length > 0) {
      patterns.push({
        id: uuidv4(),
        type: 'pattern',
        name: 'Imports/Dependencies',
        description: `Import statements in ${file.path}`,
        frequency: importLines.length,
        confidence: 0.8,
        examples: importLines.slice(0, 3),
        file: file.path,
        lines: [1, lines.length]
      });
    }

    return patterns;
  }

  private extractFileNamePatterns(files: FileInfo[]): CodePattern[] {
    const patterns: CodePattern[] = [];
    
    // Test file pattern
    const testFiles = files.filter(f => 
      f.path.includes('.test.') || 
      f.path.includes('.spec.') ||
      f.path.includes('test/') ||
      f.path.includes('tests/')
    );

    if (testFiles.length > 0) {
      patterns.push({
        id: uuidv4(),
        type: 'pattern',
        name: 'Test files',
        description: 'Project has test files',
        frequency: testFiles.length,
        confidence: 0.9,
        examples: testFiles.slice(0, 3).map(f => f.path),
        file: '',
        lines: [0, 0]
      });
    }

    // Config file pattern
    const configFiles = files.filter(f => 
      f.path.includes('config') || 
      f.path.includes('.config.') ||
      f.path.includes('settings')
    );

    if (configFiles.length > 0) {
      patterns.push({
        id: uuidv4(),
        type: 'pattern',
        name: 'Configuration files',
        description: 'Project has configuration files',
        frequency: configFiles.length,
        confidence: 0.8,
        examples: configFiles.slice(0, 3).map(f => f.path),
        file: '',
        lines: [0, 0]
      });
    }

    return patterns;
  }

  private calculateMetrics(files: FileInfo[], patterns: CodePattern[]): ProjectMetrics {
    const codeFiles = files.filter(f => this.isCodeFile(f.language));
    const testFiles = files.filter(f => 
      f.path.includes('.test.') || 
      f.path.includes('.spec.') ||
      f.path.includes('test/')
    );
    const configFiles = files.filter(f => 
      f.language === 'json' || 
      f.language === 'yaml' || 
      f.path.includes('config')
    );

    const totalLines = files.reduce((sum, f) => sum + f.lines, 0);
    const avgLinesPerFile = totalLines / files.length;

    let complexity: 'low' | 'medium' | 'high' = 'low';
    if (avgLinesPerFile > 200 || files.length > 100) complexity = 'medium';
    if (avgLinesPerFile > 500 || files.length > 500) complexity = 'high';

    const maintainability = Math.max(0, Math.min(100, 
      100 - (avgLinesPerFile / 10) - (files.length / 10) + (testFiles.length * 2)
    ));

    return {
      totalLines,
      totalFiles: files.length,
      codeFiles: codeFiles.length,
      testFiles: testFiles.length,
      configFiles: configFiles.length,
      complexity,
      maintainability: Math.round(maintainability)
    };
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.go': 'go',
      '.rs': 'rust',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.hpp': 'cpp',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.toml': 'toml',
      '.xml': 'xml',
      '.md': 'markdown',
      '.txt': 'text',
      '.rst': 'rst'
    };

    return languageMap[ext] || 'unknown';
  }

  private isCodeFile(language: string): boolean {
    return ![
      'json', 'yaml', 'toml', 'xml', 'markdown', 'text', 'rst', 'unknown'
    ].includes(language);
  }

  private getFunctionPattern(language: string): RegExp | null {
    const patterns: Record<string, RegExp> = {
      javascript: /^\s*(function\s+\w+|const\s+\w+\s*=|let\s+\w+\s*=|\w+\s*:\s*function)/,
      typescript: /^\s*(function\s+\w+|const\s+\w+\s*=|let\s+\w+\s*=|\w+\s*:\s*function|export\s+function)/,
      python: /^\s*def\s+\w+/,
      go: /^\s*func\s+\w+/,
      rust: /^\s*fn\s+\w+/,
      java: /^\s*(public|private|protected)?\s*(static\s+)?\w+\s+\w+\s*\(/,
      cpp: /^\s*\w+\s+\w+\s*\(/,
      c: /^\s*\w+\s+\w+\s*\(/
    };

    return patterns[language] || null;
  }
}