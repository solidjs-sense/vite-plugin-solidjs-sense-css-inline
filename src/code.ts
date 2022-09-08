import { NodeFactory, NodeFlags, Statement, SyntaxKind } from "typescript";

export function getInsertCode() {
  return `
window.onMountInsertCssInlineStyle = function (id, code) {
  let style = document.querySelector(id)
  if (!style) {
    style = document.createElement('style')
    style.id = \`#\${id}\`
    style.innerHTML = code
  }
  style.dataset.count = \`\${parseFloat(style.dataset.count || '0') + 1}\`
  const head = document.querySelector('head')
  if (head && !head.contains(style)) {
    head.appendChild(style)
  }
  return style
};

window.onCleanupRemoveCssInlineStyle = function (style) {
  if (style) {
    const newCount = parseFloat(style.dataset.count || '0') - 1
    if (newCount > 0) {
      style.dataset.count = \`\${newCount}\`
    } else {
      style.remove()
    }
  }
};
`
}

/*
 * code
let style: HTMLStyleElement | null ;
onMount(() => {
  style = onMountInsertCssInlineStyle('#id', code)
})

onCleanup(() => {
  onCleanupRemoveCssInlineStyle(style)
  style = undefined
})
 */
export const getStyleManageCode = (factory: NodeFactory, id: string, code: string): Statement[] => {
  return [
    factory.createVariableStatement(
      undefined,
      factory.createVariableDeclarationList(
        [factory.createVariableDeclaration(
          factory.createIdentifier(id),
          undefined,
          factory.createUnionTypeNode([
            factory.createTypeReferenceNode(
              factory.createIdentifier("HTMLStyleElement"),
              undefined
            ),
            factory.createLiteralTypeNode(factory.createNull())
          ]),
          undefined
        )],
        NodeFlags.Let
      )
    ),
    factory.createExpressionStatement(factory.createCallExpression(
      factory.createIdentifier("onMount"),
      undefined,
      [factory.createArrowFunction(
        undefined,
        undefined,
        [],
        undefined,
        factory.createToken(SyntaxKind.EqualsGreaterThanToken),
        factory.createBlock(
          [factory.createExpressionStatement(factory.createBinaryExpression(
            factory.createIdentifier(id),
            factory.createToken(SyntaxKind.EqualsToken),
            factory.createCallExpression(
              factory.createIdentifier("onMountInsertCssInlineStyle"),
              undefined,
              [factory.createStringLiteral(`#${id}`), factory.createIdentifier(code)]
            )
          ))],
          true
        )
      )]
    )),
    factory.createExpressionStatement(factory.createCallExpression(
      factory.createIdentifier("onCleanup"),
      undefined,
      [factory.createArrowFunction(
        undefined,
        undefined,
        [],
        undefined,
        factory.createToken(SyntaxKind.EqualsGreaterThanToken),
        factory.createBlock(
          [
            factory.createExpressionStatement(factory.createCallExpression(
              factory.createIdentifier("onCleanupRemoveCssInlineStyle"),
              undefined,
              [factory.createIdentifier(id)]
            )),
            factory.createExpressionStatement(factory.createBinaryExpression(
              factory.createIdentifier(id),
              factory.createToken(SyntaxKind.EqualsToken),
              factory.createIdentifier("undefined")
            ))
          ],
          true
        )
      )]
    ))
  ];
}
