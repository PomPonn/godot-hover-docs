import { window } from 'vscode';

// Create output channel
const output = window.createOutputChannel("Godot hover docs");

export function writeToOutput(text: string | Object) {
    if (typeof text === "object") {
        output.appendLine(JSON.stringify(text));
    }
    else {
        output.appendLine(text);
    }
    output.show();
}

export function clearOutput() {
    output.clear();
}