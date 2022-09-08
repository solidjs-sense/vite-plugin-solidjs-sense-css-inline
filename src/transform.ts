import { customAlphabet } from 'nanoid';
import {
  createSourceFile,
  factory,
  ScriptTarget,
  createPrinter,
  transform,
  isImportDeclaration,
  visitEachChild,
  visitNode,
  Node,
  isStringLiteral,
  ImportDeclaration,
  NamedImports,
  isNamedImports,
  ImportSpecifier,
  isImportClause,
  isIdentifier,
  SyntaxKind,
  NodeFlags,
  isFunctionDeclaration,
  isJsxFragment,
  isJsxElement} from 'typescript';
import { getStyleManageCode } from './code';
import { inlineCssModuleLineRE, solidjsRE } from './constant';

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwzyABCDEFGHIJKLMNOPQRSTUVWZY', 10)

const isJSXFunction = (node: Node): boolean => {
  if (isJsxFragment(node) || isJsxElement(node)) {
    return true
  }
  for (const child of node.getChildren()) {
    if (isJSXFunction(child)) {
      return true
    }
  }
  return false
}

const getImportString = (node: ImportDeclaration): string | undefined => {
  return node.getChildren().find(n => isStringLiteral(n))?.getText().slice(1, -1)
}

export function wrapInlineCss(name: string, file: string, target: keyof typeof ScriptTarget) {
  let isHasSolidJSImportStatement = false
  const inlineStylesNames: string[] = []
  const source = createSourceFile(name, file, ScriptTarget[target], true)
  const result = transform(source, [(context) => {
    return (rootNode) => {
      function visit(node: Node): Node {
        // import declaration
        if (isImportDeclaration(node)) {
          const importString  = getImportString(node)
          const importIdentifier = node.getChildren().find(n => isImportClause(n))?.getChildren().find(n => isIdentifier(n))?.getText()

          if (importString && importIdentifier && inlineCssModuleLineRE.test(importString)) {
            const inlineStyle = `${importIdentifier}InlineContent`
            inlineStylesNames.push(inlineStyle)
            return factory.createSourceFile(
              [
                node,
                factory.createImportDeclaration(
                  undefined,
                  factory.createImportClause(false, factory.createIdentifier(inlineStyle), undefined),
                  factory.createStringLiteral(`${importString}?inline`)
                )
              ],
              factory.createToken(SyntaxKind.EndOfFileToken),
              NodeFlags.None
            )
          } else if (importString && solidjsRE.test(importString)) {
            isHasSolidJSImportStatement = true
            const text = node.getText()
            const hasOnMount = /onMount/.test(text)
            const hasOnCleanup = /onCleanup/.test(text)
            const namedImports: NamedImports =
              node.getChildren()
              .find(n => isImportClause(n))!.getChildren()
              .find(n => isNamedImports(n)) as NamedImports || factory.createNamedImports([])

            const importSpecifiers: ImportSpecifier[] = []

            if (!hasOnMount) {
              importSpecifiers.push(
                factory.createImportSpecifier(
                  false,
                  undefined,
                  factory.createIdentifier("onMount")
                )
              )
            }

            if (!hasOnCleanup) {
              importSpecifiers.push(
                factory.createImportSpecifier(
                  false,
                  undefined,
                  factory.createIdentifier("onCleanup")
                )
              )
            }

            return factory.updateImportDeclaration(
              node,
              undefined,
              factory.createImportClause(
                false,
                importIdentifier ? factory.createIdentifier(importIdentifier) : undefined,
                factory.createNamedImports(namedImports.elements.concat(importSpecifiers))
              ),
              node.moduleSpecifier,
              undefined
            )
          }
        } else if (
          inlineStylesNames.length &&
          isFunctionDeclaration(node) &&
          node.modifiers?.find(m => m.kind === SyntaxKind.ExportKeyword) &&
          isJSXFunction(node)
        ) {
          const styleContent = inlineStylesNames.reduce((a, c) => `${a ? `${a} + ${c}` : c}`, '')
          return factory.updateFunctionDeclaration(
            node,
            node.modifiers,
            node.asteriskToken,
            node.name,
            node.typeParameters,
            node.parameters,
            node.type,
            factory.createBlock(getStyleManageCode(factory, nanoid(), styleContent).concat(node.body?.statements || []))
          )
        }
       return visitEachChild(node, visit, context)
      }
      return visitNode(rootNode, visit);
    }
  }])
  const printer = createPrinter()
  const transformedSourceFile = result.transformed[0];
  const newFile = printer.printFile(transformedSourceFile)
  result.dispose()
  if (!isHasSolidJSImportStatement) {
    return `import { onMount, onCleanup } from 'solid-js';\n${newFile}`
  }
  return newFile
}
