import { FileSystemWatcher, Uri, window, workspace } from "vscode";
import { extSettings } from "./settings";
import { readdir } from "fs/promises";
import { writeToOutput } from "./output";
import { join } from "path";

export class GodotXMLWatcher {
    private readonly glob = "{doc_classes,doc/classes}/*.xml";

    watcher?: FileSystemWatcher;

    constructor(public updateFile: (file: Uri, exists: boolean) => void) {
        // Initialize the XML cache with currently found files.
        (async () => {
            const files = await workspace.findFiles(this.glob);
            if (files.length === 0) {
                // Try to use fallback directory
                const dir = extSettings.getExternalDocsDirectory();

                if (dir === undefined) {
                    return;
                }

                try {
                    for (const file of await readdir(dir)) {
                        this.updateFile(Uri.file(join(dir, file)), true);
                    }
                }
                catch (err) {
                    window.showErrorMessage(`Invalid ExternalDocsDirectory setting - failed to read the directory - ${err}`);
                }
            }
            else {
                for (const file of files) {
                    this.updateFile(file, true);
                }
            }
        })();
        this.recreateWatcher();
    }

    dispose() {
        this.watcher?.dispose();
        this.watcher = undefined;
    }

    recreateWatcher() {
        this.dispose();
        this.watcher = workspace.createFileSystemWatcher(this.glob);
        this.watcher.onDidChange((uri) => this.updateFile(uri, true));
        this.watcher.onDidCreate((uri) => this.updateFile(uri, true));
        this.watcher.onDidDelete((uri) => this.updateFile(uri, false));
    }
}
