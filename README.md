# CodeContext Memory CLI

**Stop paying for AI amnesia. Give your AI assistant persistent memory superpowers.**

[![npm version](https://badge.fury.io/js/codecontext-memory.svg)](https://badge.fury.io/js/codecontext-memory)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## The Problem

Current AI coding assistants suffer from **AI amnesia** - they forget everything between conversations:
- ❌ No memory of your project's patterns and decisions
- ❌ No learning from what worked vs. what failed  
- ❌ No understanding of your codebase evolution
- ❌ Every conversation starts from zero context

## The Solution

CodeContext Memory CLI gives your AI assistant **persistent memory superpowers**:
- ✅ **Remembers** your project's architecture, patterns, and decisions
- ✅ **Learns** from successful vs. failed approaches over time
- ✅ **Understands** your codebase's evolution and context
- ✅ **Builds confidence** based on historical outcomes

## Quick Start

### Install Globally

```bash
npm install -g codecontext-memory
```

### Initialize Your Project

```bash
cd your-project
codecontext init
codecontext scan --deep
```

### Set Up VS Code Integration (No Extension Required!)

```bash
codecontext vscode
```

Now your AI assistant has persistent memory! 🧠

## Features

### 🧠 Persistent Memory Engine
- Stores project context, patterns, and decisions
- Tracks code evolution and architectural changes
- Learns from successful vs. failed approaches

### 📊 Intelligent Project Analysis
- Scans and understands your codebase structure
- Identifies patterns, frameworks, and dependencies
- Calculates complexity and maintainability metrics

### 🔧 VS Code Integration
- Works without any extension installation
- Quick access via keyboard shortcuts
- Context-aware suggestions and memory recall

### 🔍 Smart Memory Search
- Search across all stored memories and patterns
- Context-aware filtering and relevance scoring
- Export memory for sharing or backup

## Commands

### Core Commands

```bash
# Initialize memory for current project
codecontext init

# Show project memory status
codecontext status

# Scan and analyze project files
codecontext scan --deep

# Store a memory/decision
codecontext remember "Decided to use React hooks for state management" --type decision

# Search memories
codecontext recall "React hooks"

# Set up VS Code integration
codecontext vscode
```

### Memory Management

```bash
# Export memory to file
codecontext export --format markdown --output memory-export.md

# Clear all memory (use with caution)
codecontext clear --force
```

## VS Code Integration

After running `codecontext vscode`, you get:

### Keyboard Shortcuts
- `Ctrl+Shift+M, Ctrl+Shift+S` - Show memory status
- `Ctrl+Shift+M, Ctrl+Shift+R` - Remember current context
- `Ctrl+Shift+M, Ctrl+Shift+F` - Search memories

### Task Integration
- Access via `Ctrl+Shift+P` → Tasks: Run Task → CodeContext commands
- Integrated terminal commands with project context

### Code Snippets
- Type `ccr` → Add CodeContext memory note
- Type `cct` → Add CodeContext TODO with context

## How It Works

### 1. Project Analysis
CodeContext scans your project to understand:
- File structure and languages used
- Framework and dependency patterns
- Architectural decisions and code organization
- Complexity metrics and maintainability scores

### 2. Memory Storage
All insights are stored locally in SQLite:
- Project metadata and metrics
- Code patterns and architectural decisions
- Conversation history and learning outcomes
- Searchable memory with full-text indexing

### 3. AI Integration
Your AI assistant can now:
- Understand your project's context and patterns
- Reference previous decisions and outcomes
- Learn from what worked vs. what failed
- Provide more relevant and consistent suggestions

## Memory Types

### 🗣️ Conversations
Store important discussions and decisions from AI interactions

### 🏗️ Architectural Decisions
Record and track major architectural choices and their rationale

### 🔍 Code Patterns
Automatically detected and manually noted code patterns

### 📝 Notes
General observations, TODOs, and contextual information

## Configuration

CodeContext creates a `.codecontext` directory in your project with:
- `memory.db` - SQLite database with all memory data
- `config.json` - Project configuration and metadata

### Customization

The memory engine automatically ignores common directories (node_modules, .git, dist, etc.) but you can customize this by creating a `.codecontextignore` file similar to `.gitignore`.

## Examples

### Remember a Decision
```bash
codecontext remember "Switched from Redux to Zustand for simpler state management" \
  --type decision \
  --context "State management refactor"
```

### Search for Related Memories
```bash
codecontext recall "state management"
# Returns all memories related to state management decisions
```

### Export Memory for Documentation
```bash
codecontext export --format markdown --output project-memory.md
# Creates a markdown file with all project memories and patterns
```

## Use Cases

### 🔄 Onboarding New Developers
Export project memory to help new team members understand context and decisions

### 📚 Documentation Generation
Use memory export to create living documentation of architectural decisions

### 🤖 AI Assistant Enhancement
Give AI assistants full context of your project's evolution and patterns

### 🔍 Code Review Context
Reference historical decisions and patterns during code reviews

### 📈 Project Analysis
Track complexity evolution and architectural changes over time

## Privacy & Security

- **Local-first**: All memory is stored locally in your project
- **No cloud sync**: Your code and decisions stay on your machine
- **Open source**: Full transparency in how memory is stored and used
- **Gitignore-friendly**: `.codecontext` directory is automatically ignored

## Roadmap

- [ ] **Phase 2**: Real-time code execution and verification
- [ ] **Phase 3**: AI-powered pattern recognition and suggestions  
- [ ] **Phase 4**: Multi-project memory sharing and team collaboration
- [ ] **Phase 5**: Integration with more editors (JetBrains, Vim, Emacs)

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- 🐛 Report bugs: [GitHub Issues](https://github.com/codecontext/memory-cli/issues)
- 💬 Join discussions: [GitHub Discussions](https://github.com/codecontext/memory-cli/discussions)
- 📧 Email: hello@codecontextpro.com

---

**Stop AI amnesia. Start building with memory.**

Made with ❤️ by the CodeContext team