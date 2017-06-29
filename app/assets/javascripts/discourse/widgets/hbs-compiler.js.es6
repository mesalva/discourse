let idx = 0;

function newAcc() {
  return `_acc${idx++}`;
}

function resolve(path) {
  return (path.indexOf('settings') === 0) ? `this.${path}` : path;
}

function processNode(parentAcc, node) {
  let instructions = [];
  let innerAcc;

  switch(node.type) {
    case "Program":
      node.body.forEach(bodyNode => {
        instructions = instructions.concat(processNode(parentAcc, bodyNode));
      });
      break;
    case "ElementNode":
      innerAcc = newAcc();
      instructions.push(`var ${innerAcc} = []`);
      node.children.forEach(child => {
        instructions = instructions.concat(processNode(innerAcc, child));
      });

      if (node.attributes.length) {
        const attributes = {};
        node.attributes.forEach(a => {
          attributes[a.name === 'class' ? 'className' : a.name] = a.value.chars;
        });

        instructions.push(`${parentAcc}.push(virtualDom.h('${node.tag}', ${JSON.stringify(attributes)}, ${innerAcc}))`);
      } else {
        instructions.push(`${parentAcc}.push(virtualDom.h('${node.tag}', ${innerAcc}))`);
      }

      break;

    case "TextNode":
      return `${parentAcc}.push(${JSON.stringify(node.chars)})`;

    case "MustacheStatement":
      let path = node.path.original;

      switch(path) {
        case 'attach':
          const widgetName = node.hash.pairs.find(p => p.key === "widget").value.value;
          instructions.push(`${parentAcc}.push(this.attach("${widgetName}", attrs, state))`);
          break;
        case 'yield':
          instructions.push(`${parentAcc}.push(this.attrs.contents());`);
          break;
        default:
          instructions.push(`${parentAcc}.push(${resolve(path)})`);
          break;
      }

      break;
    case "BlockStatement":
      if (node.path.original === "if") {
        innerAcc = newAcc();
        instructions.push(`var ${innerAcc} = []`);
        instructions.push(`if (${node.params[0].original}) {`);
        node.program.body.forEach(child => {
          instructions = instructions.concat(processNode(innerAcc, child));
        });
        if (innerAcc.length > 0) {
          instructions.push(`${parentAcc}.push(${innerAcc})`);
        }

        if (node.inverse) {
          instructions.push(`} else {`);
          node.inverse.body.forEach(child => {
            instructions = instructions.concat(processNode(innerAcc, child));
          });
          if (innerAcc.length > 0) {
            instructions.push(`${parentAcc}.push(${innerAcc})`);
          }
        }
        instructions.push(`}`);
      }

      break;
    default:
      break;
  }

  return instructions.join("\n");
}

export function compile(template) {
  const syntax = Ember.__loader.require('@glimmer/syntax');
  const compiled = syntax.preprocess(template);
  return `var _result = [];\n${processNode('_result', compiled)}\nreturn _result;`;
}
