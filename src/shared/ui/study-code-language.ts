export function inferCodeLanguage(code: string) {
  if (/\b(?:SELECT|FROM|WHERE|CREATE TABLE|INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM|ALTER TABLE|JOIN)\b/i.test(code)) return 'sql';
  if (/<\/?(?:html|head|body|div|p|span|table|script|style|form|input)\b/i.test(code)) return 'html';
  if (/(?:^|\n)\s*[.#][\w-]+[^\n]*\{[\s\S]*?:\s*[^;]+;/m.test(code)) return 'css';
  if (/^\s*(?:#!.*\b(?:bash|sh)|(?:echo|export|cd|pwd|grep|awk|sed|chmod|chown|mkdir|rmdir|rm|touch|ls|cp|mv|cat|find|tar|ssh|scp|sudo|apt(?:-get)?|systemctl|ps|kill|ping|ip|ifconfig|route|mount|umount|df|du|head|tail|cut|sort|uniq|wc|xargs|curl|wget|git)\s+)/m.test(code)) return 'bash';
  if (/\b(?:def\s+\w+\s*\(|elif\s|self\.|None\b|True\b|False\b|print\s*\()/m.test(code)) return 'python';
  if (/\b(?:interface|type)\s+\w+|:\s*(?:string|number|boolean)\b|\bas\s+const\b/.test(code)) return 'typescript';
  if (/\b(?:public|private|protected)\s+(?:static\s+)?(?:class|void|int|String|boolean)\b|\bSystem\.out\.print/.test(code)) return 'java';
  if (/\bstd::|\bcout\s*<</.test(code)) return 'text';
  if (/#include\s*[<"]|\bint\s+main\s*\(/.test(code)) return 'c';
  if (/\b(?:const|let|var)\s+\w+|\bfunction\s+\w+|=>|\bconsole\.\w+/.test(code)) return 'javascript';
  return 'text';
}
