/**
 * VS Code Integration - No extension required
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import { MemoryEngine } from '../memory/MemoryEngine';
import { VSCodeContext } from '../types';

export class VSCodeIntegration {
  private memory: MemoryEngine;

  constructor() {
    this.memory = new MemoryEngine();
  }

  async getFileContext(filePath: string, line: number | undefined = undefined): Promise<VSCodeContext> {
    const projectPath = this.findProjectRoot(filePath);
    
    try {
      const projectMemory = await this.memory.getProjectStatus(projectPath);
      
      // Get related patterns for this file
      const relatedPatterns = await this.getFilePatterns(projectPath, filePath);
      
      // Get recent memories that might be relevant
      const recentMemories = await this.memory.searchMemories(projectPath, undefined, { limit: 5 });
      
      // Generate context-aware suggestions
      const suggestions = await this.generateSuggestions(filePath, line, relatedPatterns);

      return {
        file: filePath,
        line,
        projectMemory,
        relatedPatterns,
        recentMemories,
        suggestions
      };
    } catch (error) {
      // If project not initialized, return minimal context
      return {
        file: filePath,
        line,
        projectMemory: {
          projectId: '',
          projectName: path.basename(projectPath),
          createdAt: new Date(),
          lastActive: new Date(),
          filesTracked: 0,
          conversations: 0,
          patterns: 0,
          memorySize: '0 B',
          recentActivity: []
        },
        relatedPatterns: [],
        recentMemories: [],
        suggestions: ['Run "codecontext init" to enable memory for this project']
      };
    }
  }

  private findProjectRoot(filePath: string): string {
    let dir = path.dirname(filePath);
    
    while (dir !== path.dirname(dir)) {
      // Check for common project indicators
      const indicators = [
        'package.json',
        'Cargo.toml',
        'go.mod',
        'requirements.txt',
        '.git',
        '.codecontext'
      ];
      
      for (const indicator of indicators) {
        if (fs.existsSync(path.join(dir, indicator))) {
          return dir;
        }
      }
      
      dir = path.dirname(dir);
    }
    
    return path.dirname(filePath);
  }

  private async getFilePatterns(projectPath: string, filePath: string): Promise<any[]> {
    // This would query the database for patterns related to this file
    // For now, return empty array
    return [];
  }

  private async generateSuggestions(filePath: string, line: number | undefined, patterns: any[]): Promise<string[]> {
    const suggestions: string[] = [];
    const ext = path.extname(filePath);
    
    // Language-specific suggestions
    switch (ext) {
      case '.js':
      case '.jsx':
        suggestions.push('Consider adding JSDoc comments for better documentation');
        suggestions.push('Use const/let instead of var for better scoping');
        break;
      case '.ts':
      case '.tsx':
        suggestions.push('Add explicit type annotations for better type safety');
        suggestions.push('Consider using interfaces for object shapes');
        break;
      case '.py':
        suggestions.push('Add type hints for better code documentation');
        suggestions.push('Follow PEP 8 style guidelines');
        break;
      case '.rs':
        suggestions.push('Consider using Result<T, E> for error handling');
        suggestions.push('Add documentation comments with ///');
        break;
    }

    // Pattern-based suggestions
    if (patterns.length > 0) {
      suggestions.push(`Found ${patterns.length} similar patterns in your codebase`);
    }

    // Context-aware suggestions based on file name
    if (filePath.includes('test')) {
      suggestions.push('Consider adding more test cases for edge conditions');
      suggestions.push('Ensure tests are independent and can run in any order');
    }

    if (filePath.includes('config')) {
      suggestions.push('Consider using environment variables for sensitive data');
      suggestions.push('Add validation for configuration values');
    }

    return suggestions;
  }
}