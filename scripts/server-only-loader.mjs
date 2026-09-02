import { existsSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') {
    return {
      shortCircuit: true,
      url: 'data:text/javascript,export%20%7B%7D%3B',
    };
  }
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!specifier.startsWith('.') || context.parentURL === undefined) throw error;
    for (const suffix of ['.js', '/index.js']) {
      const candidate = new URL(`${specifier}${suffix}`, context.parentURL);
      if (existsSync(fileURLToPath(candidate))) return { shortCircuit: true, url: candidate.href };
    }
    throw error;
  }
}
