import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const expected = {
  'contracts/evidra_consumer_probe.py': '8af3b940e978b76c1affab807822a8db388a8c676d14801d5ffed55538bcbc36',
  'contracts/evidra_policy_registry.py': 'df2f946f2d265cb8fd8d04012c5eb2beeab1830f60d5146a7761cb35279be247',
  'contracts/evidra_registry.py': '1b3a97ec340ad30c381404fecb76d3e4656d48dd550c2fdf02d4a7c2a50af8f7',
  'contracts/evidra_resolver.py': '3c9007bd1414227193b4459d96fb565e42e0b712661d802caa9477dd91a30bfe',
};
let failed = false;
for (const [file, hash] of Object.entries(expected)) {
  const actual = createHash('sha256').update(await readFile(resolve(root, file))).digest('hex');
  console.log(`${file} ${actual} ${actual === hash ? 'PASS' : 'FAIL'}`);
  failed ||= actual !== hash;
}
if (failed) process.exitCode = 1;
