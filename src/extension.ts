import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { PromptDriveTreeDataProvider, PromptDriveItem } from './promptDriveProvider';

// Base directory for storing prompt files
const PROMPT_DRIVE_DIR = path.join(os.homedir(), '.promptDrive');

export function activate(context: vscode.ExtensionContext) {
    // Ensure the .promptDrive directory exists
    if (!fs.existsSync(PROMPT_DRIVE_DIR)) {
        fs.mkdirSync(PROMPT_DRIVE_DIR, { recursive: true });
    }

    // Create the TreeDataProvider for the prompt drive view
    const promptDriveProvider = new PromptDriveTreeDataProvider(PROMPT_DRIVE_DIR);
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
                const filePath = path.join(PROMPT_DRIVE_DIR, `${fileName}.prompt`);
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
                const folderPath = path.join(PROMPT_DRIVE_DIR, folderName);
                fs.mkdirSync(folderPath, { recursive: true });
                promptDriveProvider.refresh();
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('promptDrive.deleteEntry', async (item: PromptDriveItem) => {
            if (!item) return;

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
            if (!item || item.isDirectory) return;

            try {
                const content = fs.readFileSync(item.resourceUri.fsPath, 'utf8');
                
                // Find Copilot Chat or Edits panel and send the content
                await vscode.commands.executeCommand('workbench.action.quickOpen', '>Copilot');
                
                // Wait a moment for the quickOpen to show
                setTimeout(() => {
                    // Simulate typing and pressing Enter to send to Copilot
                    const copilotContent = content.trim();
                    vscode.env.clipboard.writeText(copilotContent);
                    
                    // Execute paste command
                    vscode.commands.executeCommand('editor.action.clipboardPasteAction').then(() => {
                        // Press Enter to send the content
                        vscode.commands.executeCommand('acceptSelectedSuggestion');
                    });
                }, 500);
                
                vscode.window.showInformationMessage('Sent prompt to Copilot');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to send to Copilot: ${error}`);
            }
        })
    );

    // Handle double-click on prompt files
    treeView.onDidChangeSelection(async (event) => {
        if (event.selection.length === 1) {
            const selectedItem = event.selection[0];
            if (!selectedItem.isDirectory) {
                // Open the file in the editor when selected
                const document = await vscode.workspace.openTextDocument(selectedItem.resourceUri);
                await vscode.window.showTextDocument(document);
            }
        }
    });
}

export function deactivate() {}