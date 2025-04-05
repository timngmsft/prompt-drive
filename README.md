# Prompt Drive

A Visual Studio Code extension for managing and sending prompts to Copilot. This extension allows you to save your favorite prompts in either:
* Your home folder (~/.promptDrive)
* Your repository's folder ([repoDir]/.promptDrive)
* Your workspace folder ([workspaceFolder]/.promptDrive) - if this is the same as the repository folder, only repository is shown

You can save prompts, manage them, edit them, and then send them to GitHub Copilot Chat / Edit.

## Features

- Managed and organize your prompts in the sidebar
- Send prompts directly to Copilot

## Usage

### Managing Prompts

- Click the notes icon in the activity bar to open Prompt Drive
- Use the "New Prompt" button to create a new prompt file
- Use the "New Folder" button to organize your prompts
- Double-click on a prompt file to open and edit it
- Right-click on a prompt file for additional options

### Sending Prompts to Copilot

1. Right-click on a prompt file in the tree view
2. Select "Send to Copilot" from the context menu. You can choose between "ask" and "agent" mode in Copilot.
3. The prompt content will be sent to Copilot and executed in Copilot

## Storage

Prompt files are stored locally in a `.promptDrive` folder in your home directory or your repository directory.

## Requirements

- Visual Studio Code 1.98.0 or higher
- GitHub Copilot extension installed and configured

## Extension Settings

This extension provides the following settings:

* `promptDrive.enableUserPromptDrive`: Enable user Prompt Drive ($HOME/.promptDrive)
* `promptDrive.useRepositoryPromptDrive`: Use repository Prompt Drive if present