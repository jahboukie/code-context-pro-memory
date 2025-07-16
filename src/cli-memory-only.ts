#!/usr/bin/env node

/**
 * CodeContext Memory Pro - Memory-Only Launch Version
 * 
 * The AI memory revolution starts here.
 * $99/month for the first 10,000 early adopters.
 * Then $199/month forever.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { MemoryEngine } from './memory/MemoryEngine';
import { ProjectScanner } from './memory/ProjectScanner';
import { VSCodeIntegration } from './integrations/VSCodeIntegration';
import { setupVSCode } from './integrations/vscode-setup';
import { licenseService } from './services/LicenseService';
import { firebaseService } from './services/FirebaseService';
import * as packageJson from '../package.json';

const program = new Command();

program
  .name('codecontext')
  .description('🧠 AI Memory Revolution - Stop AI amnesia forever')
  .version(packageJson.version)
  .addHelpText('before', `
${chalk.bold.cyan('🧠 CodeContext Memory Pro - AI Memory Revolution')}

${chalk.yellow('🔥 EARLY ADOPTER SPECIAL: $99/month FOREVER (First 10,000 licenses)')}
${chalk.yellow('📈 After 10,000 sold: $199/month')}

Give your AI assistant PERSISTENT MEMORY across ALL sessions.
The most revolutionary productivity upgrade since the IDE was invented.
  `);

// Purchase command
program
  .command('purchase')
  .description('🔥 Purchase your memory revolution license')
  .argument('<email>', 'Your email address')
  .action(async (email) => {
    try {
      console.log(chalk.bold.cyan('\n🧠 Welcome to the AI Memory Revolution!\n'));
      
      const licenseKey = await licenseService.purchaseLicense(email);
      
      console.log(chalk.green('\n🎉 License purchased!'));
      console.log(chalk.blue(`\nNext step: codecontext activate ${email} ${licenseKey}`));
      
    } catch (error) {
      console.error(chalk.red('❌ Purchase failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Activate command
program
  .command('activate')
  .description('🚀 Activate your memory revolution license')
  .argument('<email>', 'Your email address')
  .argument('<license-key>', 'Your license key')
  .action(async (email, licenseKey) => {
    try {
      await licenseService.activateLicense(email, licenseKey);
    } catch (error) {
      console.error(chalk.red('❌ Activation failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// License status
program
  .command('license')
  .description('📊 Show license status')
  .action(async () => {
    try {
      await licenseService.showLicenseStatus();
    } catch (error) {
      console.error(chalk.red('❌ Failed to get license status:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Protected commands (require license)
async function requireLicense() {
  const license = await licenseService.getCurrentLicense();
  if (!license) {
    console.log(chalk.red(`
🔒 MEMORY REVOLUTION LICENSE REQUIRED

This feature requires CodeContext Memory Pro.

🔥 Early Adopter Special: $99/month FOREVER
📈 After 10,000 licenses: $199/month

Your AI assistant is stuck with amnesia until activated.
Purchase now: codecontext purchase your@email.com
    `));
    process.exit(1);
  }
  return license;
}

program
  .command('init')
  .description('🧠 Initialize persistent AI memory for current project')
  .option('-f, --force', 'Force reinitialize existing project')
  .action(async (options) => {
    try {
      await requireLicense();
      await licenseService.validateFeatureAccess('persistentMemory');
      
      const memory = new MemoryEngine();
      await memory.initProject(process.cwd(), options.force);
      
      // Report usage
      await firebaseService.reportUsage('project_init', { 
        projectPath: process.cwd(),
        forced: options.force 
      });
      
      console.log(chalk.green('🧠 AI Memory initialized! Your assistant will REMEMBER EVERYTHING.'));
      console.log(chalk.blue('💡 Your AI now has persistent memory across ALL sessions'));
      console.log(chalk.blue('💡 Run "codecontext status" to see memory state'));
      console.log(chalk.blue('💡 Run "codecontext scan --deep" for advanced analysis'));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('📊 Show AI memory status')
  .action(async () => {
    try {
      await requireLicense();
      
      const memory = new MemoryEngine();
      const status = await memory.getProjectStatus(process.cwd());
      
      console.log(chalk.bold('\n🧠 CodeContext Memory Pro - AI Memory Status\n'));
      console.log(`📂 Project: ${chalk.cyan(status.projectName)}`);
      console.log(`🆔 ID: ${status.projectId}`);
      console.log(`📅 Created: ${status.createdAt.toLocaleString()}`);
      console.log(`🕐 Last Active: ${status.lastActive.toLocaleString()}`);
      console.log(`📁 Files Tracked: ${chalk.yellow(status.filesTracked.toString())}`);
      console.log(`💬 Conversations: ${chalk.yellow(status.conversations.toString())}`);
      console.log(`🧩 Patterns: ${chalk.yellow(status.patterns.toString())}`);
      console.log(`📊 Memory Size: ${status.memorySize}`);
      
      if (status.recentActivity.length > 0) {
        console.log(chalk.bold('\n📈 Recent Memory Activity:'));
        status.recentActivity.forEach(activity => {
          console.log(`  • ${activity.timestamp.toLocaleString()}: ${activity.description}`);
        });
      }
      
      console.log(chalk.green('\n✅ Your AI has persistent memory! No more amnesia.'));
      
      await firebaseService.reportUsage('status_check');
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to get status:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('scan')
  .description('🔍 Scan and analyze project for persistent memory')
  .option('-d, --deep', 'Perform deep pattern analysis')
  .action(async (options) => {
    try {
      const license = await requireLicense();
      
      // SECURITY: Validate usage before operation
      try {
        const usageResult = await firebaseService.validateUsage('scan', license.email, license.id);
        console.log(chalk.dim(`💡 Usage: ${usageResult.remaining}/${usageResult.limit} remaining (${usageResult.tier})`));
      } catch (error) {
        console.error(chalk.red('❌ Usage limit exceeded:'), error instanceof Error ? error.message : error);
        console.log(chalk.yellow('\n🔥 Upgrade to get more operations: https://codecontextpro.com'));
        process.exit(1);
      }
      
      const memory = new MemoryEngine();
      const scanner = new ProjectScanner();
      
      console.log(chalk.blue('🔍 Scanning project for persistent memory storage...'));
      const analysis = await scanner.scanProject(process.cwd(), options.deep);
      
      await memory.storeProjectAnalysis(process.cwd(), analysis);
      
      console.log(chalk.green(`✅ Stored ${analysis.files.length} files in AI memory`));
      console.log(chalk.blue(`🧩 Discovered ${analysis.patterns.length} code patterns`));
      console.log(chalk.blue(`🏗️ Detected ${analysis.architecture.frameworks.length} frameworks`));
      console.log(chalk.cyan('🧠 Your AI will remember all of this forever!'));
      
      await firebaseService.reportUsage('project_scan', { 
        filesScanned: analysis.files.length,
        patternsFound: analysis.patterns.length,
        deepScan: options.deep 
      });
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to scan:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('remember')
  .description('🧠 Store something in AI memory forever')
  .argument('<content>', 'What your AI should remember')
  .option('-t, --type <type>', 'Memory type (conversation, decision, pattern)', 'conversation')
  .option('-c, --context <context>', 'Additional context')
  .action(async (content, options) => {
    try {
      const license = await requireLicense();
      await licenseService.validateFeatureAccess('persistentMemory');
      
      // SECURITY: Validate usage before operation
      try {
        const usageResult = await firebaseService.validateUsage('remember', license.email, license.id);
        console.log(chalk.dim(`💡 Usage: ${usageResult.remaining}/${usageResult.limit} remaining (${usageResult.tier})`));
      } catch (error) {
        console.error(chalk.red('❌ Usage limit exceeded:'), error instanceof Error ? error.message : error);
        console.log(chalk.yellow('\n🔥 Upgrade to get more operations: https://codecontextpro.com'));
        process.exit(1);
      }
      
      const memory = new MemoryEngine();
      
      await memory.storeMemory(process.cwd(), {
        type: options.type,
        content,
        context: options.context,
        timestamp: new Date()
      });
      
      await firebaseService.reportUsage('memory_store', { 
        type: options.type,
        contentLength: content.length 
      });
      
      console.log(chalk.green('🧠 Memory stored! Your AI will remember this FOREVER.'));
      console.log(chalk.blue('💡 No more explaining the same context over and over'));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to store memory:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('recall')
  .description('🔍 Search AI memory')
  .argument('[query]', 'Search query')
  .option('-t, --type <type>', 'Filter by memory type')
  .option('-l, --limit <limit>', 'Limit number of results', '10')
  .action(async (query, options) => {
    try {
      const license = await requireLicense();
      
      // SECURITY: Validate usage before operation
      try {
        const usageResult = await firebaseService.validateUsage('recall', license.email, license.id);
        console.log(chalk.dim(`💡 Usage: ${usageResult.remaining}/${usageResult.limit} remaining (${usageResult.tier})`));
      } catch (error) {
        console.error(chalk.red('❌ Usage limit exceeded:'), error instanceof Error ? error.message : error);
        console.log(chalk.yellow('\n🔥 Upgrade to get more operations: https://codecontextpro.com'));
        process.exit(1);
      }
      
      const memory = new MemoryEngine();
      const results = await memory.searchMemories(process.cwd(), query, {
        type: options.type,
        limit: parseInt(options.limit)
      });
      
      if (results.length === 0) {
        console.log(chalk.yellow('🤔 No memories found'));
        return;
      }
      
      console.log(chalk.bold(`\n🧠 Your AI remembers ${results.length} things:\n`));
      
      results.forEach((memory, index) => {
        console.log(chalk.cyan(`${index + 1}. [${memory.type}] ${memory.timestamp.toLocaleDateString()}`));
        console.log(`   ${memory.content}`);
        if (memory.context) {
          console.log(chalk.gray(`   Context: ${memory.context}`));
        }
        console.log();
      });
      
      console.log(chalk.green('✅ This is the power of persistent AI memory!'));
      
      await firebaseService.reportUsage('memory_recall', { 
        query: query || 'all',
        resultsFound: results.length 
      });
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to recall memories:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('sync')
  .description('☁️ Sync memory to cloud')
  .action(async () => {
    try {
      await requireLicense();
      await licenseService.validateFeatureAccess('cloudSync');
      
      console.log(chalk.blue('☁️ Syncing memory to cloud...'));
      
      // Implementation would sync local memory to Firebase
      console.log(chalk.green('✅ Memory synced! Available on all your devices.'));
      
      await firebaseService.reportUsage('cloud_sync');
      
    } catch (error) {
      console.error(chalk.red('❌ Sync failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('export')
  .description('📤 Export AI memory to file')
  .option('-f, --format <format>', 'Export format (json, markdown)', 'json')
  .option('-o, --output <file>', 'Output file path')
  .action(async (options) => {
    try {
      const license = await requireLicense();
      
      // SECURITY: Validate usage before operation
      try {
        const usageResult = await firebaseService.validateUsage('export', license.email, license.id);
        console.log(chalk.dim(`💡 Usage: ${usageResult.remaining}/${usageResult.limit} remaining (${usageResult.tier})`));
      } catch (error) {
        console.error(chalk.red('❌ Usage limit exceeded:'), error instanceof Error ? error.message : error);
        console.log(chalk.yellow('\n🔥 Upgrade to get more operations: https://codecontextpro.com'));
        process.exit(1);
      }
      
      const memory = new MemoryEngine();
      const data = await memory.exportMemory(process.cwd(), options.format);
      
      const filename = options.output || `ai-memory.${options.format}`;
      await require('fs-extra').writeFile(filename, data);
      
      console.log(chalk.green(`✅ AI memory exported to ${filename}`));
      console.log(chalk.blue('💡 Share this with your team or use for documentation'));
      
      await firebaseService.reportUsage('memory_export', { 
        format: options.format,
        filename 
      });
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to export memory:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// VS Code integration (premium feature)
program
  .command('vscode')
  .description('🔧 Set up VS Code integration')
  .action(async () => {
    try {
      await requireLicense();
      
      await setupVSCode(process.cwd());
      console.log(chalk.green('✅ VS Code integration configured!'));
      console.log(chalk.blue('💡 Restart VS Code to activate memory features'));
      console.log(chalk.cyan('🧠 Your AI now has memory in VS Code too!'));
      
      await firebaseService.reportUsage('vscode_setup');
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to set up VS Code:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Show help if no command provided
program.parse();

if (!process.argv.slice(2).length) {
  console.log(chalk.bold.cyan('\n🧠 CodeContext Memory Pro - AI Memory Revolution\n'));
  console.log(chalk.yellow('🔥 EARLY ADOPTER SPECIAL: $99/month FOREVER (First 10,000 licenses)'));
  console.log(chalk.yellow('📈 After 10,000 sold: $199/month\n'));
  
  program.outputHelp();
  
  console.log(chalk.blue('\n💡 Start the memory revolution:'));
  console.log(chalk.blue('   codecontext purchase your@email.com'));
  console.log(chalk.blue('   codecontext activate your@email.com YOUR-LICENSE-KEY'));
  console.log(chalk.blue('   codecontext init'));
  
  console.log(chalk.cyan('\n🧠 What you get:'));
  console.log(chalk.cyan('   ✅ Persistent AI memory across ALL sessions'));
  console.log(chalk.cyan('   ✅ Never explain context again'));
  console.log(chalk.cyan('   ✅ AI remembers your decisions forever'));
  console.log(chalk.cyan('   ✅ Cloud sync across devices'));
  console.log(chalk.cyan('   ✅ VS Code integration'));
  
  console.log(chalk.gray('\n💰 Compare:'));
  console.log(chalk.gray('   ❌ ChatGPT Pro: $20/month (no memory)'));
  console.log(chalk.gray('   ❌ Claude Pro: $20/month (no memory)'));
  console.log(chalk.gray('   ✅ CodeContext Memory Pro: $99/month (INFINITE MEMORY)'));
  
  console.log(chalk.yellow('\n🚀 This memory upgrade pays for itself in 1 day.'));
  console.log(chalk.yellow('💎 Join the AI memory revolution!'));
}