/**
 * Language-specific starter code for the RankRoom platform.
 * These are tailored for a professional LeetCode-style experience
 * where the user only writes the core solution.
 */

export interface FunctionMeta {
  functionName: string;
  parameterTypes: { name: string; type: string }[];
  returnType: string;
}

export const DEFAULT_BOILERPLATES: Record<string, string> = {
  python: `class Solution:
    def solve(self, input_data):
        # Your code here
        return input_data
`,
  java: `class Solution {
    public void solve() {
        // Your code here
        // The driver class 'Main' will call this.
    }
}
`,
  cpp: `#include <iostream>
#include <vector>
#include <string>

using namespace std;

class Solution {
public:
    void solve() {
        // Your code here
    }
};
`,
  c: `#include <stdio.h>
#include <stdlib.h>

/**
 * Solve the problem
 */
void solve() {
    // Your code here
    // Do NOT implement main()
}
`,
  javascript: `/**
 * @param {*} input
 * @return {*}
 */
var solve = function(input) {
    // Your code here
};
`,
  typescript: `function solve(input: unknown): unknown {
    // Your code here
    return input;
}
`,
};

/**
 * Checks if a problem has the necessary metadata to generate a wrapped boilerplate.
 */
export function hasWrappedMeta(problem: any): boolean {
  return !!(
    problem && 
    problem.functionName && 
    problem.parameterTypes && 
    Array.isArray(problem.parameterTypes) &&
    problem.returnType
  );
}

/**
 * Generates professional boilerplate code based on problem metadata.
 */
export function generateBoilerplateCode(language: string, meta: FunctionMeta): string {
  const { functionName, parameterTypes, returnType } = meta;
  const lowercaseLang = language.toLowerCase();

  switch (lowercaseLang) {
    case "python": {
      const params = ["self", ...parameterTypes.map(p => p.name)].join(", ");
      return `class Solution:\n    def ${functionName}(${params}):\n        # Your code here\n        pass\n`;
    }
    case "java": {
      const params = parameterTypes.map(p => `${p.type} ${p.name}`).join(", ");
      return `class Solution {\n    public ${returnType} ${functionName}(${params}) {\n        \n    }\n}\n`;
    }
    case "cpp": {
      const params = parameterTypes.map(p => `${p.type} ${p.name}`).join(", ");
      return `class Solution {\npublic:\n    ${returnType} ${functionName}(${params}) {\n        \n    }\n};\n`;
    }
    case "c": {
      const params = parameterTypes.map(p => `${p.type} ${p.name}`).join(", ");
      return `${returnType} ${functionName}(${params}) {\n    \n}\n`;
    }
    case "javascript": {
      const paramNames = parameterTypes.map(p => p.name).join(", ");
      return `/**\n${parameterTypes.map(p => ` * @param {${p.type}} ${p.name}`).join("\n")}\n * @return {${returnType}}\n */\nvar ${functionName} = function(${paramNames}) {\n    \n};\n`;
    }
    case "typescript": {
      const params = parameterTypes.map(p => `${p.name}: ${p.type}`).join(", ");
      return `function ${functionName}(${params}): ${returnType} {\n    \n}\n`;
    }
    default:
      return "";
  }
}

/**
 * Formats a wrapped input string (usually JSON in LeetCode-style problems)
 * into a more readable format for the UI.
 * 
 * Example: '{"nums": [2,7,11,15], "target": 9}' 
 * Becomes: 
 * nums = [2,7,11,15]
 * target = 9
 */
export function formatWrappedInput(input: string): string {
  if (!input) return "";
  
  // If it's already a multi-line formatted string, return it
  if (input.includes("\n") && !input.trim().startsWith("{")) {
    return input;
  }

  try {
    const parsed = JSON.parse(input);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.entries(parsed)
        .map(([key, value]) => `${key} = ${typeof value === 'string' ? value : JSON.stringify(value)}`)
        .join("\n");
    }
  } catch (e) {
    // Not valid JSON or not an object we want to format, return as is
  }
  
  return input;
}
