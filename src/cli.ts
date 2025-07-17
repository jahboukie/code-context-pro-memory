#!/usr/bin/env node

/**
 * CodeContext Memory CLI
 * 
 * Stop paying for AI amnesia. Give your AI assistant persistent memory superpowers.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { MemoryEngine } from './memory/MemoryEngine';
import { ProjectScanner } from './memory/ProjectScanner';
import { VSCodeIntegration } from './integrations/VSCodeIntegration';
import { setupVSCode } from './integrations/vscode-setup';
import * as packageJson from '../package.json';

const program = new Command();

program
  .name('codecontext')
  .description('AI Assistant Memory Engine - Stop AI amnesia forever')
  .version(packageJson.version);

program
  .command('init')
  .description('Initialize memory for current project')
  .option('-f, --force', 'Force reinitialize existing project')
  .action(async (options) => {
    try {
      const memory = new MemoryEngine();
      await memory.initProject(process.cwd(), options.force);
      
      console.log(chalk.green('✅ Memory initialized! Your AI assistant will now remember this project.'));
      console.log(chalk.blue('💡 Run "codecontext status" to see memory state'));
      console.log(chalk.blue('💡 Run "codecontext vscode" to set up VS Code integration'));
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize memory:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show current project memory status')
  .action(async () => {
    try {
      const memory = new MemoryEngine();
      const status = await memory.getProjectStatus(process.cwd());
      
      console.log(chalk.bold('\n🧠 CodeContext Memory Status\n'));
      console.log(`📂 Project: ${chalk.cyan(status.projectName)}`);
      console.log(`🆔 ID: ${status.projectId}`);
      console.log(`📅 Created: ${status.createdAt.toLocaleString()}`);
      console.log(`🕐 Last Active: ${status.lastActive.toLocaleString()}`);
      console.log(`📁 Files Tracked: ${chalk.yellow(status.filesTracked.toString())}`);
      console.log(`💬 Conversations: ${chalk.yellow(status.conversations.toString())}`);
      console.log(`🧩 Patterns: ${chalk.yellow(status.patterns.toString())}`);
      console.log(`📊 Memory Size: ${status.memorySize}`);
      
      if (status.recentActivity.length > 0) {
        console.log(chalk.bold('\n📈 Recent Activity:'));
        status.recentActivity.forEach(activity => {
          console.log(`  • ${activity.timestamp.toLocaleString()}: ${activity.description}`);
        });
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to get status:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('scan')
  .description('Scan and analyze project files')
  .option('-d, --deep', 'Perform deep analysis of code patterns')
  .action(async (options) => {
    try {
      const memory = new MemoryEngine();
      const scanner = new ProjectScanner();
      
      console.log(chalk.blue('🔍 Scanning project files...'));
      const analysis = await scanner.scanProject(process.cwd(), options.deep);
      
      await memory.storeProjectAnalysis(process.cwd(), analysis);
      
      console.log(chalk.green(`✅ Scanned ${analysis.files.length} files`));
      console.log(chalk.blue(`📊 Found ${analysis.patterns.length} code patterns`));
      console.log(chalk.blue(`🏗️ Detected ${analysis.architecture.frameworks.length} frameworks`));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to scan project:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('remember')
  .description('Store a conversation or decision in memory')
  .argument('<content>', 'Content to remember')
  .option('-t, --type <type>', 'Type of memory (conversation, decision, pattern)', 'conversation')
  .option('-c, --context <context>', 'Additional context')
  .action(async (content, options) => {
    try {
      const memory = new MemoryEngine();
      
      await memory.storeMemory(process.cwd(), {
        type: options.type,
        content,
        context: options.context,
        timestamp: new Date()
      });
      
      console.log(chalk.green('✅ Memory stored! Your AI assistant will remember this.'));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to store memory:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('recall')
  .description('Search and recall stored memories')
  .argument('[query]', 'Search query')
  .option('-t, --type <type>', 'Filter by memory type')
  .option('-l, --limit <limit>', 'Limit number of results', '10')
  .action(async (query, options) => {
    try {
      const memory = new MemoryEngine();
      const results = await memory.searchMemories(process.cwd(), query, {
        type: options.type,
        limit: parseInt(options.limit)
      });
      
      if (results.length === 0) {
        console.log(chalk.yellow('🤔 No memories found'));
        return;
      }
      
      console.log(chalk.bold(`\n🧠 Found ${results.length} memories:\n`));
      
      results.forEach((memory, index) => {
        console.log(chalk.cyan(`${index + 1}. [${memory.type}] ${memory.timestamp.toLocaleDateString()}`));
        console.log(`   ${memory.content}`);
        if (memory.context) {
          console.log(chalk.gray(`   Context: ${memory.context}`));
        }
        console.log();
      });
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to recall memories:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('vscode')
  .description('Set up VS Code integration (no extension required)')
  .action(async () => {
    try {
      await setupVSCode(process.cwd());
      console.log(chalk.green('✅ VS Code integration configured!'));
      console.log(chalk.blue('💡 Restart VS Code to activate memory integration'));
      console.log(chalk.blue('💡 Use Ctrl+Shift+P -> "CodeContext: " to access commands'));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to set up VS Code:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('export')
  .description('Export project memory to file')
  .option('-f, --format <format>', 'Export format (json, markdown)', 'json')
  .option('-o, --output <file>', 'Output file path')
  .action(async (options) => {
    try {
      const memory = new MemoryEngine();
      const data = await memory.exportMemory(process.cwd(), options.format);
      
      const filename = options.output || `codecontext-memory.${options.format}`;
      await require('fs-extra').writeFile(filename, data);
      
      console.log(chalk.green(`✅ Memory exported to ${filename}`));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to export memory:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('clear')
  .description('Clear project memory (use with caution)')
  .option('-f, --force', 'Skip confirmation prompt')
  .action(async (options) => {
    try {
      if (!options.force) {
        const inquirer = require('inquirer');
        const { confirm } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: 'Are you sure you want to clear all memory? This cannot be undone.',
          default: false
        }]);
        
        if (!confirm) {
          console.log(chalk.yellow('Memory clear cancelled'));
          return;
        }
      }
      
      const memory = new MemoryEngine();
      await memory.clearMemory(process.cwd());
      
      console.log(chalk.green('✅ Memory cleared'));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to clear memory:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Hidden command for VS Code integration
program
  .command('_vscode-context')
  .description('Get context for VS Code (internal)')
  .argument('<file>', 'File path')
  .option('-l, --line <line>', 'Line number')
  .action(async (file, options) => {
    try {
      const vscode = new VSCodeIntegration();
      const context = await vscode.getFileContext(file, options.line ? parseInt(options.line) : undefined);
      console.log(JSON.stringify(context, null, 2));
    } catch (error) {
      console.error(JSON.stringify({ error: error instanceof Error ? error.message : error }));
    }
  });

// Error handling
program.configureOutput({
  writeErr: (str) => process.stderr.write(chalk.red(str))
});

program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  console.log(chalk.bold.cyan('\n🧠 CodeContext Memory CLI\n'));
  console.log(chalk.gray('Stop paying for AI amnesia. Give your AI assistant persistent memory superpowers.\n'));
  program.outputHelp();
  console.log(chalk.blue('\n💡 Start with: codecontext init'));
  console.log(chalk.blue('💡 Then run: codecontext vscode'));
}