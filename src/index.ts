import * as fs from "fs";
import * as filepath from "path";
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
  Parameter,
  Paren,
  Property,
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

const compiler = new LessCompiler({
  indentSize: 2,
  compress: true,
  fastcolor: true,
});

const load = (path: string) =>
  fs.readFileSync(path, { encoding: "utf-8" }).toString();

type Counter = { [x: string]: number };

const sortKeys = (c: Counter) => {
  const r = [];
  const keys = Object.keys(c);
  keys.sort((a, b) => (c[a] < c[b] ? 1 : c[a] == c[b] ? 0 : -1));
  for (const key of keys) {
    r.push([key, c[key]]);
  }
  return r;
};

class Scanner {
  readonly colors: Counter = {};
  readonly dimensions: Counter = {};
  readonly directives: Counter = {};
  readonly elements: Counter = {};
  readonly functions: Counter = {};
  readonly keywords: Counter = {};
  readonly properties: Counter = {};
  readonly variables: Counter = {};

  scan(path: string) {
    const source = load(path);
    let tree: Node | undefined;
    try {
      tree = compiler.parse(source);
    } catch (e) {
      console.log(`[warning] failed to parse ${path}: ${e}`);
      return;
    }
    if (!tree) {
      console.log(`[warning] failed to parse ${path}`);
      return;
    }
    console.log(`[info] scanning ${path}`);
    this.scanRules((tree as Stylesheet).block);
  }

  report(): any {
    return {
      colors: sortKeys(this.colors),
      directives: sortKeys(this.directives),
      dimensions: sortKeys(this.dimensions),
      elements: sortKeys(this.elements),
      functions: sortKeys(this.functions),
      keywords: sortKeys(this.keywords),
      properties: sortKeys(this.properties),
      variables: sortKeys(this.variables),
    };
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
          this.dir(b.name);
          // this.directives.add(b.name);
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

  incr(c: Counter, s: string) {
    let n = c[s] || 0;
    c[s] = n + 1;
  }

  color(s: string) {
    this.incr(this.colors, s);
  }

  dir(s: string) {
    this.incr(this.directives, s);
  }

  dim(s: string) {
    this.incr(this.dimensions, s);
  }

  elem(s: string) {
    this.incr(this.elements, s);
  }

  func(s: string) {
    this.incr(this.functions, s);
  }

  kwd(s: string) {
    this.incr(this.keywords, s);
  }

  prop(s: string) {
    this.incr(this.properties, s);
  }

  vars(s: string) {
    this.incr(this.variables, s);
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
          this.kwd(k.keyword);
        } else if (n instanceof RGBColor) {
          const c = n as RGBColor;
          const b = compiler.context().newBuffer();
          c.repr(b);
          this.color(b.toString());
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
        this.dim(d.value + (d.unit ? d.unit : ""));
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
          this.elem(t.name);
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
        this.kwd(f.value);
        break;
      }

      case NodeType.FEATURE: {
        const f = n as Feature;
        this.prop((f.property as Property).name);
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
        this.func(f.name);
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
        this.kwd((n as Keyword).value);
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
        this.prop((n as Property).name);
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
        this.kwd(t.value);
        break;
      }

      case NodeType.UNICODE_RANGE:
      case NodeType.URL:
        break;

      case NodeType.VARIABLE: {
        const v = n as Variable;
        this.vars(v.name);
        break;
      }
    }
  }
}

const main = () => {
  const scanner = new Scanner();

  const args = process.argv.slice(2);
  for (const arg of args) {
    if (!fs.existsSync(arg)) {
      console.log(`[warning] path ${arg} does not exist, skipping`);
      continue;
    }

    const s = fs.statSync(arg);
    if (s.isFile()) {
      scanner.scan(arg);
      continue;
    }
    if (s.isDirectory()) {
      const names = fs.readdirSync(arg);
      console.log(`[info] scanning directory ${arg}`);
      let n = 0;
      for (const name of names) {
        scanner.scan(filepath.join(arg, name));
        n++;
        if (n % 100 == 0) {
          console.log(`[info] processed ${n} of ${names.length}`);
        }
      }
    }
  }

  const r = scanner.report();
  for (const key of Object.keys(r)) {
    fs.writeFileSync(key + ".json", JSON.stringify(r[key]));
  }
};

main();
