import * as fs from "fs";
import {
    Argument,
    Assignment,
    AttributeElement,
    Block,
    BlockDirective,
    Condition,
    Definition,
    Dimension,
    Directive,
    Expression,
    ExpressionList,
    False,
    Feature,
    Features,
    FunctionCall,
    GenericBlock,
    Guard,
    Import,
    Keyword,
    KeywordColor,
    LessCompiler,
    Media,
    Mixin,
    MixinCall,
    MixinCallArgs,
    MixinParams,
    Node,
    NodeType,
    Operation,
    Operator,
    Parameter,
    Paren,
    Property,
    Ratio,
    RGBColor,
    Rule,
    Ruleset,
    Selector,
    Selectors,
    Shorthand,
    Stylesheet,
    TextElement,
    True,
    ValueElement,
    Variable,
} from "@squarespace/less-ts";

const load = (path: string) =>
    fs.readFileSync(path, { encoding: "utf-8" }).toString();

export const makeCounters = (): Counters => ({
    colors: {},
    color_keywords: {},
    dimensions: {},
    directives: {},
    elements: {},
    functions: {},
    keywords: {},
    properties: {},
    ratio: {},
    variables: {},
    syntax: {},
});


export const sortKeys = (c: Counter) => {
    const r = [];
    const keys = Object.keys(c);
    keys.sort((a, b) => (c[a] < c[b] ? 1 : c[a] == c[b] ? 0 : -1));
    for (const key of keys) {
        r.push([key, c[key]]);
    }
    return r;
};

const compiler = new LessCompiler({
    indentSize: 2,
    compress: true,
    fastcolor: true,
});

export type Counter = { [x: string]: number };

export interface Counters {
    colors: Counter;
    color_keywords: Counter;
    dimensions: Counter;
    directives: Counter;
    elements: Counter;
    functions: Counter;
    keywords: Counter;
    properties: Counter;
    ratio: Counter;
    variables: Counter;
    syntax: Counter;
}

export class Scanner {
    constructor(private counters: Counters) { }

    scan(path: string): string | undefined {
        // console.log(`[info] scanning ${path}`);
        const source = load(path);
        let tree: Node | undefined;
        try {
            tree = compiler.parse(source);
        } catch (e) {
            return `failed to parse ${path}: ${e}`;
        }
        if (!tree) {
            return `failed to parse ${path}`;
        }
        this.scanRules((tree as Stylesheet).block);
        return undefined;
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
                    this.scanNode(n);
                    this.instr("mixin_call");
                    break;
                case NodeType.RULE:
                    this.scanNode(n);
                    this.instr("rule");
                    break;

                case NodeType.BLOCK_DIRECTIVE: {
                    this.instr("block_directive");
                    const b = n as BlockDirective;
                    this.dir(b.name);
                    this.scanRules(b.block);
                    break;
                }

                case NodeType.GENERIC_BLOCK:
                    this.instr("generic_block");
                    this.scanRules((n as GenericBlock).block);
                    break;

                case NodeType.MEDIA: {
                    this.instr("media");
                    const m = n as Media;
                    if (m.features) {
                        this.scanNode(m.features);
                    }
                    this.scanRules(m.block);
                    break;
                }

                case NodeType.MIXIN: {
                    this.instr("mixin");
                    const m = n as Mixin;
                    this.scanNode(m.guard);
                    this.scanNode(m.params);
                    this.scanRules(m.block);
                    break;
                }

                case NodeType.RULESET: {
                    this.instr("ruleset");
                    const r = n as Ruleset;
                    this.scanNode(r.selectors);
                    this.scanRules(r.block);
                    break;
                }
            }
        }
    }

    incr(c: Counter, s: string) {
        let n = c[s] || 0;
        c[s] = n + 1;
    }

    color(s: string) {
        this.incr(this.counters.colors, s);
    }

    dir(s: string) {
        this.incr(this.counters.directives, s);
    }

    dim(s: string) {
        this.incr(this.counters.dimensions, s);
    }

    elem(s: string) {
        this.incr(this.counters.elements, s);
    }

    func(s: string) {
        this.incr(this.counters.functions, s);
    }

    kwd(s: string) {
        this.incr(this.counters.keywords, s);
    }

    prop(s: string) {
        this.incr(this.counters.properties, s);
    }

    ratio(s: string) {
        this.incr(this.counters.ratio, s)
    }

    vars(s: string) {
        this.incr(this.counters.variables, s);
    }

    instr(s: string) {
        this.incr(this.counters.syntax, s);
    }

    scanNode(n: Node) {
        if (!n) {
            return;
        }
        switch (n.type) {
            case NodeType.ARGUMENT: {
                this.instr("argument");
                const a = n as Argument;
                this.scanNode(a.value);
                break;
            }

            case NodeType.ASSIGNMENT: {
                this.instr("assignment");
                const a = n as Assignment;
                this.scanNode(a.value);
                break;
            }

            case NodeType.COLOR: {
                if (n instanceof KeywordColor) {
                    this.instr("keyword_color");
                    const k = n as KeywordColor;
                    this.kwd(k.keyword);
                } else if (n instanceof RGBColor) {
                    this.instr("rgb_color");
                    const c = n as RGBColor;
                    const b = compiler.context().newBuffer();
                    c.repr(b);
                    this.color(b.toString());
                }
                break;
            }

            case NodeType.CONDITION: {
                this.instr("condition");
                const c = n as Condition;
                this.scanNode(c.left);
                this.scanNode(c.right);
                break;
            }

            case NodeType.DEFINITION: {
                this.instr("definition");
                const d = n as Definition;
                this.scanNode(d.value);
                break;
            }

            case NodeType.DIMENSION: {
                const d = n as Dimension;
                if (d.unit) {
                    this.instr("dimension");
                } else {
                    this.instr("number");
                }
                this.dim(d.value + (d.unit ? d.unit : ""));
                break;
            }

            case NodeType.DIRECTIVE: {
                this.instr("directive");
                const d = n as Directive;
                this.scanNode(d.value);
                break;
            }

            case NodeType.ELEMENT: {
                if (n instanceof AttributeElement) {
                    this.instr("attribute_element");
                    const a = n as AttributeElement;
                    for (const p of a.parts) {
                        this.scanNode(p);
                    }
                }
                if (n instanceof ValueElement) {
                    this.instr("value_element");
                    const v = n as ValueElement;
                    this.scanNode(v.value);
                }
                if (n instanceof TextElement) {
                    this.instr("text_element");
                    const t = n as TextElement;
                    this.elem(t.name);
                }
            }

            case NodeType.EXPRESSION: {
                this.instr("expression");
                const e = n as Expression;
                if (e.values) {
                    for (const v of e.values) {
                        this.scanNode(v);
                    }
                }
                break;
            }

            case NodeType.EXPRESSION_LIST: {
                this.instr("expression_list");
                const e = n as ExpressionList;
                for (const v of e.values) {
                    this.scanNode(v);
                }
                break;
            }

            case NodeType.FALSE: {
                this.instr("keyword");
                const f = n as False;
                this.kwd(f.value);
                break;
            }

            case NodeType.FEATURE: {
                this.instr("feature");
                const f = n as Feature;
                this.prop((f.property as Property).name);
                this.scanNode(f.value);
                break;
            }

            case NodeType.FEATURES: {
                this.instr("features");
                const f = n as Features;
                for (const p of f.features) {
                    this.scanNode(p);
                }
                break;
            }

            case NodeType.FUNCTION_CALL: {
                this.instr("function_call");
                const f = n as FunctionCall;
                this.func(f.name);
                for (const a of f.args) {
                    this.scanNode(a);
                }
                break;
            }

            case NodeType.GUARD: {
                this.instr("guard");
                const g = n as Guard;
                for (const c of g.conditions) {
                    this.scanNode(c);
                }
                break;
            }

            case NodeType.IMPORT: {
                this.instr("import");
                const i = n as Import;
                if (i.features) {
                    this.scanNode(i.features);
                }
                this.scanNode(i.path);
                break;
            }

            case NodeType.KEYWORD:
                this.instr("keyword");
                this.kwd((n as Keyword).value);
                break;

            case NodeType.MIXIN_ARGS: {
                this.instr("mixin_args");
                const m = n as MixinCallArgs;
                for (const a of m.args) {
                    this.scanNode(a);
                }
                break;
            }

            case NodeType.MIXIN_CALL: {
                this.instr("mixin_call");
                const m = n as MixinCall;
                this.scanNode(m.args);
                this.scanNode(m.selector);
                break;
            }

            case NodeType.MIXIN_PARAMS: {
                this.instr("mixin_params");
                const m = n as MixinParams;
                for (const p of m.params) {
                    this.scanNode(p);
                }
                break;
            }

            case NodeType.OPERATION: {
                const o = n as Operation;
                switch (o.operator) {
                    case Operator.ADD:
                        this.instr("operation_add");
                        break;
                    case Operator.SUBTRACT:
                        this.instr("operation_subtract");
                        break;
                    case Operator.MULTIPLY:
                        this.instr("operation_multiply");
                        break;
                    case Operator.DIVIDE:
                        this.instr("operation_divide");
                        break;
                    case Operator.AND:
                        this.instr("operation_and");
                        break;
                    case Operator.OR:
                        this.instr("operation_or");
                        break;
                    case Operator.EQUAL:
                        this.instr("operation_eq");
                        break;
                    case Operator.NOT_EQUAL:
                        this.instr("operation_ne");
                        break;
                    case Operator.GREATER_THAN:
                        this.instr("operation_gt");
                        break;
                    case Operator.GREATER_THAN_OR_EQUAL:
                        this.instr("operation_gte");
                        break;
                    case Operator.LESS_THAN:
                        this.instr("operation_lt");
                        break;
                    case Operator.LESS_THAN_OR_EQUAL:
                        this.instr("operation_lte");
                        break;
                }
                this.scanNode(o.left);
                this.scanNode(o.right);
                break;
            }

            case NodeType.PARAMETER: {
                this.instr("parameter");
                const p = n as Parameter;
                if (p.value) {
                    this.scanNode(p.value);
                }
                break;
            }

            case NodeType.PAREN: {
                this.instr("paren");
                const p = n as Paren;
                this.scanNode(p.value);
                break;
            }

            case NodeType.PROPERTY:
                this.instr("property");
                this.prop((n as Property).name);
                break;

            case NodeType.QUOTED:
                // ignored
                this.instr("quoted");
                break;

            case NodeType.RATIO: {
                this.instr("ratio");
                const r = n as Ratio;
                this.ratio(r.value);
                break;
            }

            case NodeType.RULE: {
                this.instr("rule");
                const r = n as Rule;
                this.scanNode(r.property);
                this.scanNode(r.value);
                break;
            }

            case NodeType.SELECTOR: {
                this.instr("selector");
                const s = n as Selector;
                for (const e of s.elements) {
                    this.scanNode(e);
                }
                break;
            }

            case NodeType.SELECTORS: {
                this.instr("selectors");
                const s = n as Selectors;
                for (const e of s.selectors) {
                    this.scanNode(e);
                }
                break;
            }

            case NodeType.SHORTHAND: {
                this.instr("shorthand");
                const s = n as Shorthand;
                this.scanNode(s.left);
                this.scanNode(s.right);
                break;
            }

            case NodeType.TRUE: {
                this.instr("keyword");
                const t = n as True;
                this.kwd(t.value);
                break;
            }

            case NodeType.UNICODE_RANGE:
                this.instr("unicode_range");
                break;
            case NodeType.URL:
                this.instr("url");
                break;

            case NodeType.VARIABLE: {
                this.instr("variable");
                const v = n as Variable;
                this.vars(v.name);
                break;
            }
        }
    }
}