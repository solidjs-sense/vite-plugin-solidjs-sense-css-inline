import { readFile } from 'fs/promises';
import { Plugin } from 'vite';
import { inlineCssModuleFileRE } from './constant';
import { wrapInlineCss } from './transform';
import { ScriptTarget } from 'typescript';
import { getInsertCode } from './code';

type BuildTarget = keyof typeof ScriptTarget

function isTarget(target: any): target is BuildTarget {
  if (ScriptTarget[target]) {
    return true
  }
  return false
};

export default (): Plugin =>  {
  let target: BuildTarget
  return {
    apply: 'build',
    enforce: 'pre',
    name: 'solidjs-sense-css-inline',
    configResolved(cf) {
      target = isTarget(cf.build.target) ? cf.build.target : 'ES2015'
    },
    async load(id) {
      const filePath = id.split('?')[0]
      if (filePath.endsWith('.tsx')) {
        const file = await readFile(filePath, {
          encoding: 'utf8'
        })
        if (inlineCssModuleFileRE.test(file)) {
          return wrapInlineCss(filePath, file, target!)
        }
        return file
      }
    },
    renderChunk(code, chunk) {
      if (chunk.isEntry) {
        return `${getInsertCode()}${code}`
      }
    },
    writeBundle(_opts, bundles) {
      // delete css assets
      const cssAssets = Object.keys(bundles).filter(key => bundles[key].type === 'asset' &&  bundles[key].fileName.endsWith('.css'))
      cssAssets.forEach(key => {
        delete bundles[key]
      })
    }
  }
}
