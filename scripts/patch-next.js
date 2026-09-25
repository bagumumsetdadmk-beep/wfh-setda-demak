const fs = require('fs');
const path = require('path');

const filesToPatch = [
  path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'server', 'app-render', 'entry-base.js'),
  path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'esm', 'server', 'app-render', 'entry-base.js')
];

for (const file of filesToPatch) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    const buggyCodeRegex = /let SegmentViewNode\s*=\s*\(\)\s*=>\s*null;\s*let SegmentViewStateNode\s*=\s*\(\)\s*=>\s*null;\s*if\s*\(process\.env\.NODE_ENV\s*===\s*['"]development['"]\)\s*\{[\s\S]*?SegmentViewStateNode\s*=\s*mod\.SegmentViewStateNode;\s*\}/;
    if (buggyCodeRegex.test(content)) {
      content = content.replace(
        buggyCodeRegex,
        'let SegmentViewNode = (param)=>param && param.children ? param.children : null;\nlet SegmentViewStateNode = ()=>null;'
      );
      fs.writeFileSync(file, content, 'utf8');
      console.log(`[patch-next] Successfully patched ${file}`);
    } else {
      console.log(`[patch-next] Already patched or pattern not found in ${file}`);
    }
  }
}
