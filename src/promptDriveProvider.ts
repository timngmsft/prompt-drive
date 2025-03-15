import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class PromptDriveItem extends vscode.TreeItem {
    constructor(
        public readonly resourceUri: vscode.Uri,
        public readonly isDirectory: boolean,
        public readonly command?: vscode.Command
    ) {
        super(
            resourceUri,
            isDirectory
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None
        );

        const fileName = path.basename(resourceUri.fsPath);
        this.label = fileName;

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
    }
}

export class PromptDriveTreeDataProvider implements vscode.TreeDataProvider<PromptDriveItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<PromptDriveItem | undefined | null> = 
        new vscode.EventEmitter<PromptDriveItem | undefined | null>();
    readonly onDidChangeTreeData: vscode.Event<PromptDriveItem | undefined | null> = 
        this._onDidChangeTreeData.event;

    constructor(private readonly basePath: string) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: PromptDriveItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: PromptDriveItem): Promise<PromptDriveItem[]> {
        if (element) {
            // Children of a directory
            return this.getPromptDriveItems(element.resourceUri.fsPath);
        } else {
            // Root elements
            return this.getPromptDriveItems(this.basePath);
        }
    }

    private async getPromptDriveItems(directoryPath: string): Promise<PromptDriveItem[]> {
        if (!fs.existsSync(directoryPath)) {
            return [];
        }

        const entries = fs.readdirSync(directoryPath);
        const items = entries.map(entry => {
            const entryPath = path.join(directoryPath, entry);
            const isDirectory = fs.statSync(entryPath).isDirectory();
            const uri = vscode.Uri.file(entryPath);

            // Only show files with .prompt extension
            if (!isDirectory && !entry.endsWith('.prompt')) {
                return null;
            }

            return new PromptDriveItem(uri, isDirectory);
        });

        // Filter out null values and sort: directories first, then files
        return items
            .filter((item): item is PromptDriveItem => item !== null)
            .sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) {
                    return -1;
                }
                if (!a.isDirectory && b.isDirectory) {
                    return 1;
                }
                return a.label!.localeCompare(b.label!);
            });
    }
}