import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { CodeParser } from '../src/core/parser.js';

describe('CodeParser', () => {
  let parser;

  beforeAll(async () => {
    parser = new CodeParser();
    await parser.init();
  });

  it('should initialize and parse standard JavaScript code', async () => {
    const code = 'function add(a, b) { return a + b; }';
    const result = await parser.parse(code, 'javascript');

    expect(result.tree).toBeDefined();
    expect(result.rootNode.type).toBe('program');
    expect(result.hasErrors).toBe(false);
    expect(result.language).toBe('javascript');
  });

  it('should parse TypeScript with type annotations', async () => {
    const tsCode = `
      interface User { id: number; name: string; }
      function getUser(id: number): User { return { id, name: "Alice" }; }
    `;
    const result = await parser.parse(tsCode, 'typescript');

    expect(result.tree).toBeDefined();
    expect(result.rootNode.type).toBe('program');
    expect(result.hasErrors).toBe(false);
    expect(result.language).toBe('typescript');
  });

  it('should parse TSX containing JSX elements', async () => {
    const tsxCode = `
      export const Button = ({ text }: { text: string }) => {
        return <button className="btn">{text}</button>;
      };
    `;
    const result = await parser.parse(tsxCode, '.tsx');

    expect(result.tree).toBeDefined();
    expect(result.hasErrors).toBe(false);
    expect(result.language).toBe('tsx');
  });

  it('should parse Python code', async () => {
    const pyCode = `
def greet(name: str) -> str:
    return f"Hello {name}"
`;
    const result = await parser.parse(pyCode, 'python');

    expect(result.tree).toBeDefined();
    expect(result.rootNode.type).toBe('module');
    expect(result.hasErrors).toBe(false);
    expect(result.language).toBe('python');
  });

  it('should handle syntax errors gracefully without throwing', async () => {
    const brokenCode = 'function broken( { return ???';
    const result = await parser.parse(brokenCode, 'javascript');

    expect(result.tree).toBeDefined();
    expect(result.hasErrors).toBe(true);
    expect(result.rootNode.type).toBe('program');
  });

  it('should parse files directly from disk', async () => {
    const filePath = path.resolve('tests/fixtures/sample-repo/src/app.js');
    const result = await parser.parseFile(filePath);

    expect(result.tree).toBeDefined();
    expect(result.content).toContain('startApp');
    expect(result.language).toBe('javascript');
  });
});
