import * as vscode from 'vscode';

export class PromptDriveSettings {
    private static _instance: PromptDriveSettings;

    private _enableUserPromptDrive: boolean;
    private _useRepositoryPromptDrive: boolean;

    private constructor() {
        // Initialize with default values from configuration
        const config = vscode.workspace.getConfiguration('promptDrive');
        this._enableUserPromptDrive = config.get<boolean>('enableUserPromptDrive', true);
        this._useRepositoryPromptDrive = config.get<boolean>('useRepositoryPromptDrive', true);

        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('promptDrive')) {
                this.updateSettings();
            }
        });
    }

    /**
     * Get the singleton instance of PromptDriveSettings
     */
    public static getInstance(): PromptDriveSettings {
        if (!PromptDriveSettings._instance) {
            PromptDriveSettings._instance = new PromptDriveSettings();
        }
        return PromptDriveSettings._instance;
    }

    /**
     * Update settings from VS Code configuration
     */
    private updateSettings(): void {
        const config = vscode.workspace.getConfiguration('promptDrive');
        this._enableUserPromptDrive = config.get<boolean>('enableUserPromptDrive', true);
        this._useRepositoryPromptDrive = config.get<boolean>('useRepositoryPromptDrive', true);
    }

    /**
     * Check if user prompt drive is enabled
     */
    public get enableUserPromptDrive(): boolean {
        return this._enableUserPromptDrive;
    }

    /**
     * Check if repository prompt drive should be used
     */
    public get useRepositoryPromptDrive(): boolean {
        return this._useRepositoryPromptDrive;
    }
}