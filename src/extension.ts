import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as childProcess from 'child_process';

import { PromptDriveTreeDataProvider, PromptDriveItem } from './promptDriveProvider';
import { PromptDriveSettings } from './settings';

// Base directory for storing prompt files
const USER_PROMPT_DRIVE_DIR = path.join(os.homedir(), '.promptDrive');

/**
 * Attempts to find the Git repository root for a given folder path
 * @param folderPath Path to check for Git repository
 * @returns Repository root path if found, undefined otherwise
 */
function findGitRepositoryRoot(folderPath: string): string | undefined {
    try {
        // Use Git to find the repository root
        const result = childProcess.spawnSync(
            'git',
            ['rev-parse', '--show-toplevel'],
            { cwd: folderPath, encoding: 'utf8', shell: true }
        );
        
        if (result.status === 0 && result.stdout) {
            // Git command succeeded, normalize path and return
            const repoRoot = result.stdout.trim().replace(/\r?\n|\r/g, '');
            return repoRoot;
        }
        
        return undefined;
    } catch (error) {
        console.error('Error finding Git repository root:', error);
        return undefined;
    }
}

export function activate(context: vscode.ExtensionContext) {
    // Ensure the settings singleton is initialized
    const settings = PromptDriveSettings.getInstance();

    // Ensure the .promptDrive directory exists if user prompt drive is enabled
    if (settings.enableUserPromptDrive && !fs.existsSync(USER_PROMPT_DRIVE_DIR)) {
        fs.mkdirSync(USER_PROMPT_DRIVE_DIR, { recursive: true });
    }

    // Find repository prompt drive path if a workspace is open
    let repoPromptDriveDir: string | undefined = undefined;
    let repoRoot: string | undefined = undefined;
    
    if (settings.useRepositoryPromptDrive && vscode.workspace.workspaceFolders?.length) {
        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        repoRoot = findGitRepositoryRoot(workspaceRoot);
        
        if (repoRoot) {
            repoPromptDriveDir = path.join(repoRoot, '.promptDrive');
        }
    }

    // Create the TreeDataProvider for the prompt drive view
    const promptDriveProvider = new PromptDriveTreeDataProvider(USER_PROMPT_DRIVE_DIR, repoPromptDriveDir, repoRoot);
    const treeView = vscode.window.createTreeView('promptDriveExplorer', {
        treeDataProvider: promptDriveProvider,
        showCollapseAll: true,
        canSelectMany: false
    });

    context.subscriptions.push(treeView);

    // Register the commands
    context.subscriptions.push(
        vscode.commands.registerCommand('promptDrive.refreshEntry', () => {
            promptDriveProvider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('promptDrive.createPrompt', async () => {
            const fileName = await vscode.window.showInputBox({
                placeHolder: 'Enter prompt file name',
                prompt: 'Enter a name for the new prompt file (without extension)',
                validateInput: (val) => {
                    if (!val || val.trim().length === 0) {
                        return 'File name is required';
                    }
                    return null;
                }
            });

            if (fileName) {
                // Determine which prompt drive to use based on settings and workspace
                let targetDir = USER_PROMPT_DRIVE_DIR;
                let createDir = false;
                
                // If we have both user and repo options, ask user which one to use
                if (settings.enableUserPromptDrive && settings.useRepositoryPromptDrive && repoRoot) {
                    const repoOption = {
                        label: 'Repository Prompt Drive',
                        description: repoPromptDriveDir
                    };
                    
                    const choice = await vscode.window.showQuickPick(
                        [
                            { label: 'User Prompt Drive', description: USER_PROMPT_DRIVE_DIR },
                            repoOption
                        ],
                        { placeHolder: 'Select where to create the prompt' }
                    );
                    
                    if (!choice) return; // User cancelled
                    
                    if (choice.label === 'Repository Prompt Drive') {
                        targetDir = repoPromptDriveDir!;
                        createDir = !fs.existsSync(repoPromptDriveDir!);
                    } else {
                        targetDir = USER_PROMPT_DRIVE_DIR;
                    }
                } else if (!settings.enableUserPromptDrive && repoRoot) {
                    targetDir = repoPromptDriveDir!;
                    createDir = !fs.existsSync(repoPromptDriveDir!);
                } else if (!settings.enableUserPromptDrive && !repoRoot) {
                    vscode.window.showErrorMessage('No prompt drive location is enabled in settings.');
                    return;
                }
                
                const filePath = path.join(targetDir, `${fileName}.prompt`);
                
                // Ensure target directory exists
                if (!fs.existsSync(targetDir) || createDir) {
                    try {
                        fs.mkdirSync(targetDir, { recursive: true });
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to create directory: ${error}`);
                        return;
                    }
                }
                
                try {
                    fs.writeFileSync(filePath, '');
                    promptDriveProvider.refresh();
                    
                    // Open the file in the editor
                    const document = await vscode.workspace.openTextDocument(filePath);
                    await vscode.window.showTextDocument(document);
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to create prompt file: ${error}`);
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('promptDrive.createFolder', async () => {
            const folderName = await vscode.window.showInputBox({
                placeHolder: 'Enter folder name',
                prompt: 'Enter a name for the new folder',
                validateInput: (val) => {
                    if (!val || val.trim().length === 0) {
                        return 'Folder name is required';
                    }
                    return null;
                }
            });

            if (folderName) {
                // Determine which prompt drive to use based on settings and workspace
                let targetDir = USER_PROMPT_DRIVE_DIR;
                let createDir = false;
                
                // If we have both user and repo options, ask user which one to use
                if (settings.enableUserPromptDrive && settings.useRepositoryPromptDrive && repoRoot) {
                    const repoOption = {
                        label: 'Repository Prompt Drive',
                        description: repoPromptDriveDir
                    };
                    
                    const choice = await vscode.window.showQuickPick(
                        [
                            { label: 'User Prompt Drive', description: USER_PROMPT_DRIVE_DIR },
                            repoOption
                        ],
                        { placeHolder: 'Select where to create the folder' }
                    );
                    
                    if (!choice) return; // User cancelled
                    
                    if (choice.label === 'Repository Prompt Drive') {
                        targetDir = repoPromptDriveDir!;
                        createDir = !fs.existsSync(repoPromptDriveDir!);
                    } else {
                        targetDir = USER_PROMPT_DRIVE_DIR;
                    }
                } else if (!settings.enableUserPromptDrive && repoRoot) {
                    targetDir = repoPromptDriveDir!;
                    createDir = !fs.existsSync(repoPromptDriveDir!);
                } else if (!settings.enableUserPromptDrive && !repoRoot) {
                    vscode.window.showErrorMessage('No prompt drive location is enabled in settings.');
                    return;
                }
                
                const folderPath = path.join(targetDir, folderName);
                
                try {
                    // Create the base directory first if needed
                    if (createDir) {
                        fs.mkdirSync(targetDir, { recursive: true });
                    }
                    
                    // Then create the requested folder
                    fs.mkdirSync(folderPath, { recursive: true });
                    promptDriveProvider.refresh();
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to create folder: ${error}`);
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('promptDrive.deleteEntry', async (item: PromptDriveItem) => {
            if (!item) {return;}

            const fileName = path.basename(item.resourceUri.fsPath);
            const confirmMessage = `Are you sure you want to delete ${fileName}?`;
            const confirmed = await vscode.window.showInformationMessage(confirmMessage, 'Yes', 'No') === 'Yes';

            if (confirmed) {
                try {
                    if (item.isDirectory) {
                        fs.rmSync(item.resourceUri.fsPath, { recursive: true });
                    } else {
                        fs.unlinkSync(item.resourceUri.fsPath);
                    }
                    promptDriveProvider.refresh();
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to delete: ${error}`);
                }
            }
        })
    );

    // Command to send prompt content to Copilot
    context.subscriptions.push(
        vscode.commands.registerCommand('promptDrive.sendToCopilot', async (item: PromptDriveItem) => {
            if (!item || item.isDirectory) {return;}

            try {
                const content = fs.readFileSync(item.resourceUri.fsPath, 'utf8').trim();
                await vscode.commands.executeCommand('workbench.action.chat.open', content);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to send to Copilot: ${error}`);
            }
        })
    );

    // Handle double-click on prompt files
    treeView.onDidChangeSelection(async (event) => {
        if (event.selection.length === 1) {
            const selectedItem = event.selection[0] as PromptDriveItem;
            if (!selectedItem.isDirectory) {
                // Open the file in the editor when selected
                const document = await vscode.workspace.openTextDocument(selectedItem.resourceUri);
                await vscode.window.showTextDocument(document);
            }
        }
    });
    
    // Listen for workspace folder changes to update repository prompt drive
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
        // Update the repository root and repository path
        if (settings.useRepositoryPromptDrive && vscode.workspace.workspaceFolders?.length) {
            const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            repoRoot = findGitRepositoryRoot(workspaceRoot);
            
            if (repoRoot) {
                repoPromptDriveDir = path.join(repoRoot, '.promptDrive');
                promptDriveProvider.updateRepositoryPath(repoPromptDriveDir, repoRoot);
            } else {
                repoPromptDriveDir = undefined;
                promptDriveProvider.updateRepositoryPath(undefined, undefined);
            }
        } else {
            repoRoot = undefined;
            repoPromptDriveDir = undefined;
            promptDriveProvider.updateRepositoryPath(undefined, undefined);
        }
        
        promptDriveProvider.refresh();
    });
}

export function deactivate() {}