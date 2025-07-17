/**
 * VS Code Setup - Configure integration without extension
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';

export async function setupVSCode(projectPath: string): Promise<void> {
  // Create .vscode directory in project
  const vscodeDir = path.join(projectPath, '.vscode');
  await fs.ensureDir(vscodeDir);

  // Create tasks.json for CodeContext commands
  const tasksPath = path.join(vscodeDir, 'tasks.json');
  const tasks = {
    version: '2.0.0',
    tasks: [
      {
        label: 'CodeContext: Show Status',
        type: 'shell',
        command: 'codecontext',
        args: ['status'],
        group: 'build',
        presentation: {
          echo: true,
          reveal: 'always',
          focus: false,
          panel: 'shared'
        },
        problemMatcher: []
      },
      {
        label: 'CodeContext: Scan Project',
        type: 'shell',
        command: 'codecontext',
        args: ['scan', '--deep'],
        group: 'build',
        presentation: {
          echo: true,
          reveal: 'always',
          focus: false,
          panel: 'shared'
        },
        problemMatcher: []
      },
      {
        label: 'CodeContext: Remember Current Context',
        type: 'shell',
        command: 'codecontext',
        args: ['remember', '${input:memoryContent}', '--context', '${file}:${lineNumber}'],
        group: 'build',
        presentation: {
          echo: true,
          reveal: 'always',
          focus: false,
          panel: 'shared'
        },
        problemMatcher: []
      },
      {
        label: 'CodeContext: Search Memories',
        type: 'shell',
        command: 'codecontext',
        args: ['recall', '${input:searchQuery}'],
        group: 'build',
        presentation: {
          echo: true,
          reveal: 'always',
          focus: false,
          panel: 'shared'
        },
        problemMatcher: []
      }
    ],
    inputs: [
      {
        id: 'memoryContent',
        description: 'What would you like to remember?',
        default: '',
        type: 'promptString'
      },
      {
        id: 'searchQuery',
        description: 'Search memories:',
        default: '',
        type: 'promptString'
      }
    ]
  };

  await fs.writeJson(tasksPath, tasks, { spaces: 2 });

  // Create settings.json with CodeContext integration
  const settingsPath = path.join(vscodeDir, 'settings.json');
  let settings = {};
  
  if (await fs.pathExists(settingsPath)) {
    settings = await fs.readJson(settingsPath);
  }

  // Add CodeContext-specific settings
  Object.assign(settings, {
    'terminal.integrated.env.linux': {
      'CODECONTEXT_PROJECT_PATH': projectPath
    },
    'terminal.integrated.env.osx': {
      'CODECONTEXT_PROJECT_PATH': projectPath
    },
    'terminal.integrated.env.windows': {
      'CODECONTEXT_PROJECT_PATH': projectPath
    },
    'files.watcherExclude': {
      '**/.codecontext/**': true
    }
  });

  await fs.writeJson(settingsPath, settings, { spaces: 2 });

  // Create keybindings for quick access
  const userDir = getUserVSCodeDir();
  if (userDir) {
    const keybindingsPath = path.join(userDir, 'keybindings.json');
    let keybindings = [];

    if (await fs.pathExists(keybindingsPath)) {
      const content = await fs.readFile(keybindingsPath, 'utf8');
      try {
        keybindings = JSON.parse(content);
      } catch {
        keybindings = [];
      }
    }

    // Add CodeContext keybindings if they don't exist
    const codecontextBindings = [
      {
        key: 'ctrl+shift+m ctrl+shift+s',
        command: 'workbench.action.tasks.runTask',
        args: 'CodeContext: Show Status'
      },
      {
        key: 'ctrl+shift+m ctrl+shift+r',
        command: 'workbench.action.tasks.runTask',
        args: 'CodeContext: Remember Current Context'
      },
      {
        key: 'ctrl+shift+m ctrl+shift+f',
        command: 'workbench.action.tasks.runTask',
        args: 'CodeContext: Search Memories'
      }
    ];

    for (const binding of codecontextBindings) {
      const exists = keybindings.some((k: any) => 
        k.key === binding.key && k.command === binding.command
      );
      if (!exists) {
        keybindings.push(binding);
      }
    }

    await fs.writeJson(keybindingsPath, keybindings, { spaces: 2 });
  }

  // Create workspace snippet for CodeContext
  const snippetsDir = path.join(vscodeDir, 'snippets');
  await fs.ensureDir(snippetsDir);

  const snippetsPath = path.join(snippetsDir, 'codecontext.code-snippets');
  const snippets = {
    'Remember in CodeContext': {
      scope: 'javascript,typescript,python,go,rust,java',
      prefix: 'ccr',
      body: [
        '// CodeContext Memory: $1',
        '// Context: ${TM_FILENAME}:${TM_LINE_NUMBER}',
        '$0'
      ],
      description: 'Add a CodeContext memory note'
    },
    'CodeContext TODO': {
      scope: 'javascript,typescript,python,go,rust,java',
      prefix: 'cct',
      body: [
        '// TODO (CodeContext): $1',
        '// Priority: ${2|low,medium,high|}',
        '// Context: ${TM_FILENAME}:${TM_LINE_NUMBER}',
        '$0'
      ],
      description: 'Add a CodeContext TODO'
    }
  };

  await fs.writeJson(snippetsPath, snippets, { spaces: 2 });

  // Create launch configuration for debugging CodeContext CLI
  const launchPath = path.join(vscodeDir, 'launch.json');
  let launch: any = { version: '0.2.0', configurations: [] };

  if (await fs.pathExists(launchPath)) {
    launch = await fs.readJson(launchPath);
  }

  const codecontextConfig = {
    name: 'Debug CodeContext CLI',
    type: 'node',
    request: 'launch',
    program: '${workspaceFolder}/node_modules/.bin/codecontext',
    args: ['${input:codecontextCommand}'],
    console: 'integratedTerminal',
    env: {
      'NODE_ENV': 'development'
    }
  };

  const exists = launch.configurations.some((config: any) => 
    config.name === codecontextConfig.name
  );

  if (!exists) {
    launch.configurations.push(codecontextConfig);
    await fs.writeJson(launchPath, launch, { spaces: 2 });
  }
}

function getUserVSCodeDir(): string | null {
  const platform = os.platform();
  const homeDir = os.homedir();

  let vscodeDir: string;

  switch (platform) {
    case 'win32':
      vscodeDir = path.join(homeDir, 'AppData', 'Roaming', 'Code', 'User');
      break;
    case 'darwin':
      vscodeDir = path.join(homeDir, 'Library', 'Application Support', 'Code', 'User');
      break;
    case 'linux':
      vscodeDir = path.join(homeDir, '.config', 'Code', 'User');
      break;
    default:
      return null;
  }

  return fs.existsSync(vscodeDir) ? vscodeDir : null;
}