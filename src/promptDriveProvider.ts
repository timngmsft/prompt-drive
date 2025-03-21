import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { PromptDriveSettings } from './settings';

export class PromptDriveItem extends vscode.TreeItem {
    constructor(
        public readonly resourceUri: vscode.Uri,
        public readonly isDirectory: boolean,
        public readonly command?: vscode.Command,
        public readonly customLabel?: string
    ) {
        super(
            resourceUri,
            isDirectory
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None
        );

        if (resourceUri) {
            const fileName = path.basename(resourceUri.fsPath);
            
            // Set custom label if provided, otherwise use filename
            this.label = customLabel || fileName;

            // Set the context value for context menu filtering
            this.contextValue = isDirectory ? 'folder' : 'prompt';

            // Set the icons for files and folders
            this.iconPath = isDirectory 
                ? vscode.ThemeIcon.Folder
                : vscode.ThemeIcon.File;
                
            // Set the tooltip for prompt files
            if (!isDirectory && fileName.endsWith('.prompt')) {
                try {
                    const content = fs.readFileSync(resourceUri.fsPath, 'utf8');
                    // Simple summary without using LLM
                    // Take the first line or first 80 characters
                    const firstLine = content.split('\n')[0] || '';
                    this.tooltip = firstLine.length > 80 
                        ? firstLine.substring(0, 80) + '...' 
                        : firstLine;
                } catch (error) {
                    this.tooltip = 'Error reading prompt file';
                }
            }

            // Set a description for prompt files based on content
            if (!isDirectory && fileName.endsWith('.prompt')) {
                try {
                    const stats = fs.statSync(resourceUri.fsPath);
                    const sizekB = Math.round(stats.size / 1024 * 10) / 10;
                    this.description = `${sizekB}kB`;
                } catch (error) {
                    this.description = '';
                }
            }
        } else {
            // For root nodes
            this.contextValue = 'root';
        }
    }
}

// Define a root node type for better type checking
export class RootNode extends PromptDriveItem {
    constructor(
        public readonly rootLabel: string,
        public readonly basePath: string
    ) {
        super(vscode.Uri.file(basePath), true, undefined, rootLabel);
        this.contextValue = 'root';
        this.description = basePath;
    }
}

export class PromptDriveTreeDataProvider implements vscode.TreeDataProvider<PromptDriveItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<PromptDriveItem | undefined | null> = 
        new vscode.EventEmitter<PromptDriveItem | undefined | null>();
    readonly onDidChangeTreeData: vscode.Event<PromptDriveItem | undefined | null> = 
        this._onDidChangeTreeData.event;

    private settings: PromptDriveSettings;
    private userBasePath: string;
    private repoBasePath: string | null = null;
    private gitRepoRoot: string | null = null;

    constructor(userBasePath: string, repoBasePath?: string, gitRepoRoot?: string) {
        this.settings = PromptDriveSettings.getInstance();
        this.userBasePath = userBasePath;
        this.repoBasePath = repoBasePath || null;
        this.gitRepoRoot = gitRepoRoot || null;
        
        // Listen for settings changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('promptDrive')) {
                this.refresh();
            }
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Update the repository path and git repository root
     * Called when workspace folders change
     */
    updateRepositoryPath(repoPath?: string, gitRepoRoot?: string): void {
        this.repoBasePath = repoPath || null;
        this.gitRepoRoot = gitRepoRoot || null;
    }

    getTreeItem(element: PromptDriveItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: PromptDriveItem): Promise<PromptDriveItem[]> {
        if (!element) {
            // Root level - add USER and REPOSITORY nodes
            const rootNodes: PromptDriveItem[] = [];
            
            if (this.settings.enableUserPromptDrive && fs.existsSync(this.userBasePath)) {
                rootNodes.push(new RootNode('USER', this.userBasePath));
            }
            
            // Only show REPOSITORY node if we're in a Git repository
            if (this.settings.useRepositoryPromptDrive && this.gitRepoRoot) {
                rootNodes.push(new RootNode('REPOSITORY', this.repoBasePath!));
            }
            
            return rootNodes;
        } else if (element instanceof RootNode) {
            // Children of a root node - may need to create directory if it doesn't exist
            return this.getPromptDriveItems(element.basePath);
        } else if (element.isDirectory) {
            // Children of a directory
            return this.getPromptDriveItems(element.resourceUri.fsPath);
        }
        
        return [];
    }

    private async getPromptDriveItems(directoryPath: string): Promise<PromptDriveItem[]> {
        // If directory doesn't exist, return empty array
        // The directory will be created when a prompt or folder is added
        if (!fs.existsSync(directoryPath)) {
            return [];
        }

        try {
            const entries = fs.readdirSync(directoryPath);
            const items: PromptDriveItem[] = [];
            
            for (const entry of entries) {
                const entryPath = path.join(directoryPath, entry);
                const isDirectory = fs.statSync(entryPath).isDirectory();
                const uri = vscode.Uri.file(entryPath);
                
                // Add all directories and only .prompt files
                if (isDirectory || entry.endsWith('.prompt')) {
                    items.push(new PromptDriveItem(uri, isDirectory));
                }
            }

            // Sort: directories first, then files
            return items.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) {
                    return -1;
                }
                if (!a.isDirectory && b.isDirectory) {
                    return 1;
                }
                return a.label!.localeCompare(b.label!);
            });
        } catch (error) {
            // Handle errors gracefully
            console.error(`Error reading directory ${directoryPath}:`, error);
            return [];
        }
    }
}