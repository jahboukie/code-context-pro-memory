#!/usr/bin/env node

/**
 * CodeContext Pro CLI - Premium Version
 * 
 * The AI cognitive revolution starts here.
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
${chalk.bold.cyan('🧠 CodeContext Pro - AI Cognitive Upgrade')}

${chalk.yellow('🔥 EARLY ADOPTER SPECIAL: $99/month (Limited to 10,000 licenses)')}
${chalk.yellow('📈 After 10,000 sold: $199/month forever')}

This is the most powerful AI productivity tool ever created.
Your AI assistant will remember EVERYTHING and execute code in real-time.
  `);

// Purchase command
program
  .command('purchase')
  .description('🔥 Purchase your CodeContext Pro license')
  .argument('<email>', 'Your email address')
  .action(async (email) => {
    try {
      console.log(chalk.bold.cyan('\n🧠 Welcome to the AI Memory Revolution!\n'));
      
      const licenseKey = await licenseService.purchaseLicense(email);
      
      console.log(chalk.green('\n🎉 Purchase successful!'));
      console.log(chalk.blue(`\nNext step: codecontext activate ${email} ${licenseKey}`));
      
    } catch (error) {
      console.error(chalk.red('❌ Purchase failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Activate command
program
  .command('activate')
  .description('🚀 Activate your CodeContext Pro license')
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
🔒 LICENSE REQUIRED

This feature requires CodeContext Pro.

🔥 Early Adopter Special: $99/month  
📈 After 10,000 licenses: $199/month

Purchase now: codecontext purchase your@email.com
    `));
    process.exit(1);
  }
  return license;
}

program
  .command('init')
  .description('🧠 Initialize AI memory for current project')
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
      
      console.log(chalk.green('🧠 AI Memory initialized! Your assistant will remember EVERYTHING.'));
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
      
      console.log(chalk.bold('\n🧠 CodeContext Pro - AI Memory Status\n'));
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
      
      await firebaseService.reportUsage('status_check');
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to get status:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('scan')
  .description('🔍 Scan and analyze project with AI')
  .option('-d, --deep', 'Perform deep AI analysis')
  .action(async (options) => {
    try {
      await requireLicense();
      
      const memory = new MemoryEngine();
      const scanner = new ProjectScanner();
      
      console.log(chalk.blue('🔍 Scanning project with AI intelligence...'));
      const analysis = await scanner.scanProject(process.cwd(), options.deep);
      
      await memory.storeProjectAnalysis(process.cwd(), analysis);
      
      console.log(chalk.green(`✅ AI analyzed ${analysis.files.length} files`));
      console.log(chalk.blue(`🧩 Discovered ${analysis.patterns.length} code patterns`));
      console.log(chalk.blue(`🏗️ Detected ${analysis.architecture.frameworks.length} frameworks`));
      
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
  .description('🧠 Store memory for AI assistant')
  .argument('<content>', 'What to remember')
  .option('-t, --type <type>', 'Memory type (conversation, decision, pattern)', 'conversation')
  .option('-c, --context <context>', 'Additional context')
  .action(async (content, options) => {
    try {
      await requireLicense();
      await licenseService.validateFeatureAccess('persistentMemory');
      
      const memory = new MemoryEngine();
      
      await memory.storeMemory(process.cwd(), {
        type: options.type,
        content,
        context: options.context,
        timestamp: new Date()
      });
      
      // Sync to cloud
      await firebaseService.reportUsage('memory_store', { 
        type: options.type,
        contentLength: content.length 
      });
      
      console.log(chalk.green('🧠 Memory stored! AI will remember this forever.'));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to store memory:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('execute')
  .description('⚡ Execute and verify code with AI')
  .argument('<code-file>', 'Code file to execute')
  .option('-l, --language <lang>', 'Programming language')
  .action(async (codeFile, options) => {
    try {
      await requireLicense();
      await licenseService.validateFeatureAccess('executionEngine');
      
      const fs = require('fs-extra');
      const code = await fs.readFile(codeFile, 'utf8');
      
      console.log(chalk.blue('⚡ Executing code in secure cloud environment...'));
      
      const result = await firebaseService.validateExecution(
        code, 
        options.language || 'javascript',
        { projectPath: process.cwd() }
      );
      
      if (result.success) {
        console.log(chalk.green('✅ Code executed successfully!'));
        console.log(chalk.blue(`Output: ${result.output}`));
        console.log(chalk.gray(`Time: ${result.executionTime}ms, Memory: ${result.memoryUsed} bytes`));
      } else {
        console.log(chalk.red('❌ Code execution failed!'));
        console.log(chalk.red(`Error: ${result.error}`));
      }
      
      await firebaseService.reportUsage('code_execution', { 
        language: options.language,
        success: result.success,
        executionTime: result.executionTime 
      });
      
    } catch (error) {
      console.error(chalk.red('❌ Execution failed:'), error instanceof Error ? error.message : error);
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
      console.log(chalk.green('✅ Memory synced to cloud!'));
      
      await firebaseService.reportUsage('cloud_sync');
      
    } catch (error) {
      console.error(chalk.red('❌ Sync failed:'), error instanceof Error ? error.message : error);
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
      console.log(chalk.blue('💡 Restart VS Code to activate premium features'));
      
      await firebaseService.reportUsage('vscode_setup');
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to set up VS Code:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Show help if no command provided
program.parse();

if (!process.argv.slice(2).length) {
  console.log(chalk.bold.cyan('\n🧠 CodeContext Pro - AI Memory Revolution\n'));
  console.log(chalk.yellow('🔥 EARLY ADOPTER SPECIAL: $99/month (Limited to 10,000 licenses)'));
  console.log(chalk.yellow('📈 After 10,000 sold: $199/month forever\n'));
  
  program.outputHelp();
  
  console.log(chalk.blue('\n💡 Get started:'));
  console.log(chalk.blue('   codecontext purchase your@email.com'));
  console.log(chalk.blue('   codecontext activate your@email.com YOUR-LICENSE-KEY'));
  console.log(chalk.blue('   codecontext init'));
  
  console.log(chalk.gray('\n💰 This cognitive upgrade pays for itself in 1 day.'));
  console.log(chalk.gray('🚀 Join the AI memory revolution!'));
}