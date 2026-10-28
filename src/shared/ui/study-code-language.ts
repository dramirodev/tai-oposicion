export function inferCodeLanguage(code: string) {
  if (/^\s*(?:<\?xml\b|xmlns:[\w.-]+\s*=|(?:xs|xsd):[A-Za-z_])/i.test(code)) return 'xml';
  if (/\b(?:SELECT|FROM|WHERE|CREATE TABLE|INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM|ALTER TABLE|JOIN)\b/i.test(code)) return 'sql';
  if (/<\/?(?:html|head|body|div|p|span|table|script|style|form|input)\b/i.test(code)) return 'html';
  if (/(?:^|\n)\s*[.#][\w-]+[^\n]*\{[\s\S]*?:\s*[^;]+;/m.test(code)) return 'css';
  if (/^\s*(?:#!.*\b(?:bash|sh)|(?:echo|export|cd|pwd|grep|awk|sed|chmod|chown|mkdir|rmdir|rm|touch|ls|cp|mv|cat|find|tar|ssh|scp|sudo|apt(?:-get)?|systemctl|ps|kill|ping|ip|ifconfig|route|mount|umount|df|du|head|tail|cut|sort|uniq|wc|xargs|curl|wget|git)\s+)/m.test(code)) return 'bash';
  if (/\b(?:using\s+System\s*;|namespace\s+[\w.]+|Console\.(?:Write|Read)|\w+\s*\?\s+[A-Za-z_]\w*)/m.test(code)) return 'csharp';
  if (/\b(?:std::|cout\s*<<)|#include\s*[<"](?:iostream|vector|string|map|set|algorithm)/m.test(code)) return 'cpp';
  if (/\b(?:System\.out\.print|(?:public\s+)?static\s+(?:void|int)\s+main\s*\(\s*String\s*\[\]|class\s+\w+\s*\{)/m.test(code)) return 'java';
  if (/\b(?:def\s+\w+\s*\(|elif\s|self\.|None\b|True\b|False\b)|(?<![\w.])print\s*\(/m.test(code)) return 'python';
  if (/\b(?:interface|type)\s+\w+|:\s*(?:string|number|boolean)\b|\bas\s+const\b/.test(code)) return 'typescript';
  if (/\b(?:public|private|protected)\s+(?:static\s+)?(?:class|void|int|String|boolean)\b|\bSystem\.out\.print/.test(code)) return 'java';
  if (/^\s*<\?php\b/i.test(code)) return 'php';
  if (/#include\s*[<"]|\bint\s+main\s*\(/.test(code)) return 'c';
  if (/\b(?:const|let|var)\s+\w+|\bfunction\s+\w+|=>|\bconsole\.\w+/.test(code)) return 'javascript';
  return 'text';
}
