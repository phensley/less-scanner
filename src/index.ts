import * as fs from 'fs';
import { 
    Argument,
    Assignment,
    AttributeElement,
    BaseColor, 
    Block, 
    BlockDirective, 
    BlockNode, Condition, Definition, Dimension, Directive, Expression, ExpressionList, False, Feature, Features, FunctionCall, GenericBlock, Guard, Import, Keyword, KeywordColor, 
    LessCompiler, Media, Mixin, MixinCall, MixinCallArgs, MixinParams, Node, NodeType, Operation, Parameter, Paren, Property, Ratio, Rule, Ruleset, Selector, Selectors, Shorthand, TextElement, True, ValueElement, Variable } from '@squarespace/less-ts';

const compiler = new LessCompiler({ indentSize: 2, compress: true });

const load = (path: string) => fs.readFileSync(path, { encoding: 'utf-8' }).toString();

class Scanner {

    readonly keywords: Set<string> = new Set();
    readonly directives: Set<string> = new Set();
    readonly properties: Set<string> = new Set();
    readonly functions: Set<string> = new Set();
    readonly variables: Set<string> = new Set();
    readonly elements: Set<string> = new Set();
    readonly dimensions: Set<string> = new Set();

    private tree: BlockNode;

    constructor(source: string) {
        const tree = compiler.parse(source);
        if (!tree) {
            throw new Error(`got undefined`);
        }
        // console.log(tree);
        this.tree = tree as BlockNode;
    }

    scan() {
        this.scanRules(this.tree.block);
    }

    report(): any {
        return {
            keywords: sortSet(this.keywords),
            directives: sortSet(this.directives),
            properties: sortSet(this.properties),
            functions: sortSet(this.functions),
            variables: sortSet(this.variables),
            elements: sortSet(this.elements),
            dimensions: sortSet(this.dimensions),
        }
    }

    scanRules(block: Block) {  
        const { rules } = block;
        for (let i = 0; i < rules.length; i++) {
            const n = rules[i];
            if (n == undefined) {
                continue;
            }
            // console.log(n.type);
            switch (n.type) {
                case NodeType.MIXIN_CALL:
                case NodeType.RULE:
                    this.scanNode(n);
                    break;

                case NodeType.BLOCK_DIRECTIVE: {
                    const b = n as BlockDirective;
                    this.directives.add(b.name);
                    this.scanRules(b.block);
                    break;
                }

                case NodeType.GENERIC_BLOCK: 
                    this.scanRules((n as GenericBlock).block);
                    break;

                case NodeType.MEDIA: {
                    const m = n as Media;
                    if (m.features) {
                        this.scanNode(m.features);
                    }
                    this.scanRules(m.block);
                    break;
                }

                case NodeType.MIXIN: {
                    const m = n as Mixin;
                    this.scanNode(m.guard);
                    this.scanNode(m.params);
                    this.scanRules(m.block);
                    break;
                }

                case NodeType.RULESET: {
                    const r = n as Ruleset;
                    this.scanNode(r.selectors);
                    this.scanRules(r.block);
                    break;
                }
            }
        }
    }

    scanNode(n: Node) {
        if (!n) {
            return;
        }
        switch (n.type) {
            case NodeType.ARGUMENT: {
                const a = n as Argument;
                this.scanNode(a.value);
                break;
            }

            case NodeType.ASSIGNMENT: {
                const a = n as Assignment;
                this.scanNode(a.value);
                break;
            }

            case NodeType.COLOR: {
                if (n instanceof KeywordColor) {
                    const k = n as KeywordColor;
                    this.keywords.add(k.keyword);
                }
                break;
            }

            case NodeType.CONDITION: {
                const c = n as Condition;
                this.scanNode(c.left);
                this.scanNode(c.right);
                break;
            }

            case NodeType.DEFINITION: {
                const d = n as Definition;
                this.scanNode(d.value);
                break;
            }

            case NodeType.DIMENSION: {
                const d = n as Dimension;
                this.dimensions.add(d.value + (d.unit ? d.unit : ''));
                break;
            }

            case NodeType.DIRECTIVE: {
                const d = n as Directive;
                this.scanNode(d.value);
                break;
            }

            case NodeType.ELEMENT: {
                if (n instanceof AttributeElement) {
                    const a = n as AttributeElement;
                    for (const p of a.parts) {
                        this.scanNode(p);
                    }
                }
                if (n instanceof ValueElement) {
                    const v = n as ValueElement;
                    this.scanNode(v.value);
                }
                if (n instanceof TextElement) {
                    const t = n as TextElement;
                    this.elements.add(t.name);
                }
            }

            case NodeType.EXPRESSION: {
                const e = n as Expression;
                if (e.values) {
                    for (const v of e.values) {
                        this.scanNode(v);
                    }
                }
                break;
            }

            case NodeType.EXPRESSION_LIST: {
                const e = n as ExpressionList;
                for (const v of e.values) {
                    this.scanNode(v);
                }
                break;
            }

            case NodeType.FALSE: {
                const f = n as False;
                this.keywords.add(f.value);
                break;
            }

            case NodeType.FEATURE: {
                const f = n as Feature;
                this.properties.add((f.property as Property).name);
                this.scanNode(f.value);
                break;
            }

            case NodeType.FEATURES: {
                const f = n as Features;
                for (const p of f.features) {
                    this.scanNode(p);
                }
                break;
            }

            case NodeType.FUNCTION_CALL: {
                const f = n as FunctionCall;
                this.functions.add(f.name);
                for (const a of f.args) {
                    this.scanNode(a);
                }
                break;
            }

            case NodeType.GUARD: {
                const g = n as Guard;
                for (const c of g.conditions) {
                    this.scanNode(c);
                }
                break;
            }

            case NodeType.IMPORT: {
                const i = n as Import;
                if (i.features) {
                    this.scanNode(i.features);
                }
                this.scanNode(i.path);
                break;
            }

            case NodeType.KEYWORD:
                this.keywords.add((n as Keyword).value);
                break;

            case NodeType.MIXIN_ARGS: {
                const m = n as MixinCallArgs;
                for (const a of m.args) {
                    this.scanNode(a);
                }
                break;
            }

            case NodeType.MIXIN_CALL: {
                const m = n as MixinCall;
                this.scanNode(m.args);
                this.scanNode(m.selector);
                break;
            }

            case NodeType.MIXIN_PARAMS: {
                const m = n as MixinParams;
                for (const p of m.params) {
                    this.scanNode(p);
                }
                break;
            }

            case NodeType.OPERATION: {
                const o = n as Operation;
                this.scanNode(o.left);
                this.scanNode(o.right);
                break;
            }

            case NodeType.PARAMETER: {
                const p = n as Parameter;
                if (p.value) {
                    this.scanNode(p.value);
                }
                break;
            }

            case NodeType.PAREN: {
                const p = n as Paren;
                this.scanNode(p.value);
                break;
            }

            case NodeType.PROPERTY:
                this.properties.add((n as Property).name);
                break;

            case NodeType.QUOTED: 
            case NodeType.RATIO:
                // ignored
                break;

            case NodeType.RULE: {
                const r = n as Rule;
                this.scanNode(r.property);
                this.scanNode(r.value);
                break;
            }

            case NodeType.SELECTOR: {
                const s = n as Selector;
                for (const e of s.elements) {
                    this.scanNode(e);
                }
                break;
            }

            case NodeType.SELECTORS: {
                const s = n as Selectors;
                for (const e of s.selectors) {
                    this.scanNode(e);
                }
                break;
            }

            case NodeType.SHORTHAND: {
                const s = n as Shorthand;
                this.scanNode(s.left);
                this.scanNode(s.right);
                break;
            }

            case NodeType.TRUE: {
                const t = n as True;
                this.keywords.add(t.value);
                break;
            }

            case NodeType.UNICODE_RANGE:
            case NodeType.URL:
                break;

            case NodeType.VARIABLE: {
                const v = n as Variable;
                this.variables.add(v.name);
                break;
            }
        }
    }
}

const sortSet = (set: Set<string>): string[] => {
    const res: string[] = [];
    set.forEach((v) => res.push(v));
    return res.sort();
};

const main = () => {
    const source = load('/Users/phensley/dev/less-exp/less/new-bedford-framework-canonical.less');
    // const source = '.foo { .bar { .baz { color: red; } } }';
    const scanner = new Scanner(source);
    scanner.scan();

    const r = scanner.report();
    for (const key of Object.keys(r)) {
        const v = r[key].join('\n');
        fs.writeFileSync(key + '.txt', v);
    }
    // fs.writeFileSync('report.json', r);

    // console.log('keywords:');
    // scanner.keywords.forEach(k => console.log(k));
    // console.log('------------------------------------');
    // console.log('properties:')
    // scanner.properties.forEach(p => console.log(p));

    // const result = compiler.compile(source);
    // console.log(result);
    // console.log(node);
};

main();
