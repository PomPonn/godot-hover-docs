import { access, constants } from "fs/promises";
import { workspace, WorkspaceConfiguration } from "vscode";
import { join } from "path";

const GODOT_CPP_FOLDER = "godot-cpp";
const CONFIG_SECTION_NAME = "godotHoverDocs";

class ExtensionSettings {
    private _isGdExtension: boolean = false;
    private _verbose: boolean = false;
    private _externalDocsDir: string | undefined;
    private _config: WorkspaceConfiguration | undefined;

    private async _setIfIsGdExtension() {
        this._isGdExtension = false;
        for (const folder of workspace.workspaceFolders ?? []) {
            const cppPath = join(folder.uri.fsPath, GODOT_CPP_FOLDER);
            // Doesn't exist when error is thrown.
            try { await access(cppPath, constants.F_OK); }
            catch { continue; }
            this._isGdExtension = true;
        }
    }

    constructor() {
        this.reload();
        this._setIfIsGdExtension();
    }

    reload() {
        this._config = workspace.getConfiguration(CONFIG_SECTION_NAME);

        this._verbose = this.get("verbose") as boolean;
        this._externalDocsDir = this.get("externalDocsDirectory") as (string | undefined);
    }

    get(name: string) {
        return this._config?.get(name);
    }

    getExternalDocsDirectory() {
        return this._externalDocsDir;
    }

    isVerbose() {
        return this._verbose;
    }

    isGdExtension() {
        return this._isGdExtension;
    }
}

export const extSettings = new ExtensionSettings()

workspace.onDidChangeConfiguration(e => {
    if (!e.affectsConfiguration(CONFIG_SECTION_NAME))
        return;

    extSettings.reload();
});