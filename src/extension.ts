import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { PromptDriveTreeDataProvider, PromptDriveItem } from './promptDriveProvider';
import { PromptDriveSettings } from './settings';

// Base directory for storing prompt files
const USER_PROMPT_DRIVE_DIR = path.join(os.homedir(), '.promptDrive');

export function activate(context: vscode.ExtensionContext) {
    // Ensure the settings singleton is initialized
    const settings = PromptDriveSettings.getInstance();

    // Ensure the .promptDrive directory exists if user prompt drive is enabled
    if (settings.enableUserPromptDrive && !fs.existsSync(USER_PROMPT_DRIVE_DIR)) {
        fs.mkdirSync(USER_PROMPT_DRIVE_DIR, { recursive: true });
    }

    // Find repository prompt drive if enabled
    let repoPromptDriveDir: string | undefined = undefined;
    
    if (settings.useRepositoryPromptDrive && vscode.workspace.workspaceFolders?.length) {
        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const potentialRepoPromptDriveDir = path.join(workspaceRoot, '.promptDrive');
        
        if (fs.existsSync(potentialRepoPromptDriveDir)) {
            repoPromptDriveDir = potentialRepoPromptDriveDir;
        }
    }

    // Create the TreeDataProvider for the prompt drive view
    const promptDriveProvider = new PromptDriveTreeDataProvider(USER_PROMPT_DRIVE_DIR, repoPromptDriveDir);
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
                
                // If we have both user and repo drives available, ask user which one to use
                if (settings.enableUserPromptDrive && settings.useRepositoryPromptDrive && repoPromptDriveDir) {
                    const choice = await vscode.window.showQuickPick(
                        [
                            { label: 'User Prompt Drive', description: USER_PROMPT_DRIVE_DIR },
                            { label: 'Repository Prompt Drive', description: repoPromptDriveDir }
                        ],
                        { placeHolder: 'Select where to create the prompt' }
                    );
                    
                    if (!choice) return; // User cancelled
                    
                    targetDir = choice.label === 'User Prompt Drive' ? USER_PROMPT_DRIVE_DIR : repoPromptDriveDir;
                } else if (!settings.enableUserPromptDrive && repoPromptDriveDir) {
                    targetDir = repoPromptDriveDir;
                } else if (!settings.enableUserPromptDrive && !repoPromptDriveDir) {
                    vscode.window.showErrorMessage('No prompt drive location is enabled in settings.');
                    return;
                }
                
                const filePath = path.join(targetDir, `${fileName}.prompt`);
                
                // Ensure target directory exists
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }
                
                fs.writeFileSync(filePath, '');
                promptDriveProvider.refresh();
                
                // Open the file in the editor
                const document = await vscode.workspace.openTextDocument(filePath);
                await vscode.window.showTextDocument(document);
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
                
                // If we have both user and repo drives available, ask user which one to use
                if (settings.enableUserPromptDrive && settings.useRepositoryPromptDrive && repoPromptDriveDir) {
                    const choice = await vscode.window.showQuickPick(
                        [
                            { label: 'User Prompt Drive', description: USER_PROMPT_DRIVE_DIR },
                            { label: 'Repository Prompt Drive', description: repoPromptDriveDir }
                        ],
                        { placeHolder: 'Select where to create the folder' }
                    );
                    
                    if (!choice) return; // User cancelled
                    
                    targetDir = choice.label === 'User Prompt Drive' ? USER_PROMPT_DRIVE_DIR : repoPromptDriveDir;
                } else if (!settings.enableUserPromptDrive && repoPromptDriveDir) {
                    targetDir = repoPromptDriveDir;
                } else if (!settings.enableUserPromptDrive && !repoPromptDriveDir) {
                    vscode.window.showErrorMessage('No prompt drive location is enabled in settings.');
                    return;
                }
                
                const folderPath = path.join(targetDir, folderName);
                fs.mkdirSync(folderPath, { recursive: true });
                promptDriveProvider.refresh();
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
                if (item.isDirectory) {
                    fs.rmSync(item.resourceUri.fsPath, { recursive: true });
                } else {
                    fs.unlinkSync(item.resourceUri.fsPath);
                }
                promptDriveProvider.refresh();
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
    
    // Listen for workspace folder changes to detect repository prompt drives
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
        promptDriveProvider.refresh();
    });
}

export function deactivate() {}