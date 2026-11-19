import { CancellationToken, commands, Hover, HoverProvider, MarkdownString, Position, TextDocument } from 'vscode';
import { DocsData } from './xml_cache';
import { DocsParser } from './docs_parser';
import { clearOutput, writeToOutput } from './output';
import { extSettings } from './settings';

const sanitizeRegex = /^```cpp\s*|\s*```.*$|\*|&|<[^<>]+>/gs;
const godotNamespaceRegex = /godot::/g;
const classRegex = /^(?:class|struct)\s(\S+?)$/;
const methodRegex = /^.+?(\S+?)::*?([^\s:]+)\(/;
const propertyRegex = /^.+?(\S+?)::.*?(?<=::)([^\s:()]+)$/;
const constantRegex = /^.+?(\S+?)::.*?(?<=::)([^\s:()]+)\s=/

export class GodotXMLHoverProvider implements HoverProvider {
    isQuerying = false;
    readonly detectionPasses: [RegExp, any][] = [
        [classRegex, (m1: any, d: any, _: any) => this.docsParser.getClassDescription(m1, d)],
        [methodRegex, (m1: any, d: any, m2: any) => this.docsParser.getMethodDescription(m1, d, m2)],
        [propertyRegex, (m1: any, d: any, m2: any) => this.docsParser.getPropertyDescription(m1, d, m2)],
        [constantRegex, (m1: any, d: any, m2: any) => this.docsParser.getConstantDescription(m1, d, m2)],
    ] as const;

    constructor(
        public docsParser: DocsParser,
        public findXML: (classname: string) => Promise<DocsData | undefined>,
    ) { }

    async provideHover(document: TextDocument, position: Position, _: CancellationToken): Promise<Hover | null | undefined> {
        clearOutput();

        if (this.isQuerying) {
            return;
        }

        this.isQuerying = true;
        const hovers = await commands.executeCommand<Hover[]>("vscode.executeHoverProvider", document.uri, position);
        this.isQuerying = false;

        // Check hovers for matches.
        const contents: MarkdownString[] = [];
        for (const hover of hovers) {
            for (const content of hover.contents) {
                let value: string;
                if (typeof content === 'object') {
                    value = content.value;
                } else {
                    value = content;
                }

                if (extSettings.isGdExtension()) {
                    // Remove godot namespaces for easier parsing.
                    const newValue = value.replace(godotNamespaceRegex, '');
                    if (newValue === value) {
                        // There is no reason to continue parsing, because this hover content has no trace of godot namespace.
                        continue;
                    }
                    value = newValue;
                }

                // Remove all pointers, references, generic types and godot namespace if using GDExtension.
                // Since generic types can be recursive, we keep applying the regex until we reach
                // a stable value.
                value = this.sanitizeValue(value);
                writeToOutput("[Value]: " + value);

                for (const pass of this.detectionPasses) {
                    const result = await this.detect(value, pass[0], pass[1]);
                    if (result !== undefined) {
                        const md = new MarkdownString(result);
                        md.isTrusted = { enabledCommands: ['godot-hover-docs.followLink'] };
                        contents.push(md);
                        break;
                    }
                }
                break;
            }
        }

        return { contents };
    }

    sanitizeValue(text: string): string {
        while (true) {
            const newText = text.replace(sanitizeRegex, '');
            if (newText === text) {
                break;
            }
            text = newText;
        }

        return text;
    }

    async detect(text: string, regex: RegExp, descriptionGetter: any) {
        const match = regex.exec(text);
        if (!match) {
            return undefined;
        }

        writeToOutput("[DETECT] Matched: " + match[1] + (match[2] ? ", " + match[2] : ""));

        const docs = await this.findXML(match[1]);
        if (!docs?.class) {
            return undefined;
        }

        writeToOutput("[DETECT] Found class");

        return descriptionGetter(match[1], docs, match[2]);
    }
}
