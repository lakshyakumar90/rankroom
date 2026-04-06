import type { ParameterTypeDef, SupportedParamType } from "./input-serializer.service";

export type WrapperLanguage =
  | "javascript"
  | "typescript"
  | "python"
  | "java"
  | "cpp"
  | "c";

export interface WrapperProblemMeta {
  functionName: string;
  parameterTypes: ParameterTypeDef[];
  returnType: SupportedParamType | "void";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function preprocessJavaCode(userCode: string): string {
  return userCode.replace(/public\s+class\s+Solution\b/g, "class Solution");
}

function formatOutputJs(returnType: SupportedParamType | "void"): string {
  switch (returnType) {
    case "void":
      return "";
    case "int":
    case "long":
    case "float":
    case "double":
    case "string":
      return "console.log(__result ?? \"\");";
    case "bool":
      return "console.log(__result ? \"true\" : \"false\");";
    default:
      return "console.log(JSON.stringify(__result));";
  }
}

function formatOutputPy(returnType: SupportedParamType | "void"): string {
  switch (returnType) {
    case "void":
      return "";
    case "int":
    case "long":
    case "float":
    case "double":
    case "string":
      return "print(__result)";
    case "bool":
      return 'print("true" if __result else "false")';
    default:
      return "print(json.dumps(__result, separators=(',',':')))";
  }
}

function formatOutputJava(returnType: SupportedParamType | "void", varName: string): string {
  switch (returnType) {
    case "void":
      return "";
    case "int":
    case "long":
    case "float":
    case "double":
    case "string":
      return `System.out.println(${varName});`;
    case "bool":
      return `System.out.println(${varName} ? \"true\" : \"false\");`;
    case "int[]":
      return `System.out.println(formatIntArray(${varName}));`;
    case "long[]":
      return `System.out.println(formatLongArray(${varName}));`;
    case "float[]":
    case "double[]":
      return `System.out.println(formatDoubleArray(${varName}));`;
    case "string[]":
    case "char[]":
      return `System.out.println(formatStringArray(${varName}));`;
    case "int[][]":
      return `System.out.println(formatInt2DArray(${varName}));`;
    case "string[][]":
      return `System.out.println(formatString2DArray(${varName}));`;
    default:
      return `System.out.println(${varName});`;
  }
}

function formatOutputCpp(returnType: SupportedParamType | "void"): string {
  switch (returnType) {
    case "void":
      return "";
    case "int":
    case "long":
    case "float":
    case "double":
    case "string":
      return "cout << __result << '\\n';";
    case "bool":
      return 'cout << (__result ? "true" : "false") << "\\n";';
    case "int[]":
    case "long[]":
      return "cout << __formatIntArray(__result) << '\\n';";
    case "float[]":
    case "double[]":
      return "cout << __formatDoubleArray(__result) << '\\n';";
    case "string[]":
    case "char[]":
      return "cout << __formatStringArray(__result) << '\\n';";
    case "int[][]":
      return "cout << __formatInt2DArray(__result) << '\\n';";
    case "string[][]":
      return "cout << __formatString2DArray(__result) << '\\n';";
    default:
      return "cout << __result << '\\n';";
  }
}

function formatOutputC(returnType: SupportedParamType | "void"): string {
  switch (returnType) {
    case "void":
      return "";
    case "int":
      return 'printf("%d\\n", __result);';
    case "long":
      return 'printf("%ld\\n", __result);';
    case "float":
    case "double":
      return 'printf("%.12g\\n", __result);';
    case "string":
      return 'printf("%s\\n", __result ? __result : "");';
    case "bool":
      return 'printf("%s\\n", __result ? "true" : "false");';
    case "int[]":
      return "__printIntArray(__result, __returnSize);";
    case "long[]":
      return "__printLongArray(__result, __returnSize);";
    case "float[]":
    case "double[]":
      return "__printDoubleArray(__result, __returnSize);";
    case "string[]":
    case "char[]":
      return "__printStringArray(__result, __returnSize);";
    default:
      return 'printf("%s\\n", "");';
  }
}

function generateJsTsParsing(param: ParameterTypeDef): string {
  const name = param.name;
  switch (param.type) {
    case "int":
    case "long":
      return `const ${name} = parseInt(__readLine(), 10);`;
    case "float":
    case "double":
      return `const ${name} = parseFloat(__readLine());`;
    case "string":
      return `const ${name} = __readLine();`;
    case "bool":
      return `const ${name} = __readLine().trim().toLowerCase() === "true";`;
    default:
      return `const ${name} = JSON.parse(__readLine() || "null");`;
  }
}

function generatePythonParsing(param: ParameterTypeDef): string {
  const name = param.name;
  switch (param.type) {
    case "int":
    case "long":
      return `${name} = int(__read_line())`;
    case "float":
    case "double":
      return `${name} = float(__read_line())`;
    case "string":
      return `${name} = __read_line()`;
    case "bool":
      return `${name} = __read_line().strip().lower() == 'true'`;
    default:
      return `${name} = json.loads(__read_line() or 'null')`;
  }
}

function generateJavaParsing(param: ParameterTypeDef): string {
  const name = param.name;
  switch (param.type) {
    case "int":
      return `int ${name} = Integer.parseInt(lines[lineIdx++].trim());`;
    case "long":
      return `long ${name} = Long.parseLong(lines[lineIdx++].trim());`;
    case "float":
      return `float ${name} = Float.parseFloat(lines[lineIdx++].trim());`;
    case "double":
      return `double ${name} = Double.parseDouble(lines[lineIdx++].trim());`;
    case "string":
      return `String ${name} = lines[lineIdx++];`;
    case "bool":
      return `boolean ${name} = lines[lineIdx++].trim().equalsIgnoreCase("true");`;
    case "int[]":
      return `int[] ${name} = parseIntArray(lines[lineIdx++]);`;
    case "long[]":
      return `long[] ${name} = parseLongArray(lines[lineIdx++]);`;
    case "float[]":
    case "double[]":
      return `double[] ${name} = parseDoubleArray(lines[lineIdx++]);`;
    case "string[]":
    case "char[]":
      return `String[] ${name} = parseStringArray(lines[lineIdx++]);`;
    case "int[][]":
      return `int[][] ${name} = parseInt2DArray(lines[lineIdx++]);`;
    case "string[][]":
      return `String[][] ${name} = parseString2DArray(lines[lineIdx++]);`;
    default:
      return `Object ${name} = null;`;
  }
}

function generateCppParsing(param: ParameterTypeDef): string {
  const name = param.name;
  switch (param.type) {
    case "int":
      return `int ${name} = stoi(__lines[__idx++]);`;
    case "long":
      return `long long ${name} = stoll(__lines[__idx++]);`;
    case "float":
      return `float ${name} = stof(__lines[__idx++]);`;
    case "double":
      return `double ${name} = stod(__lines[__idx++]);`;
    case "string":
      return `string ${name} = __lines[__idx++];`;
    case "bool":
      return `bool ${name} = __lines[__idx++] == "true";`;
    case "int[]":
      return `vector<int> ${name} = __parseIntArray(__lines[__idx++]);`;
    case "long[]":
      return `vector<long long> ${name} = __parseLongArray(__lines[__idx++]);`;
    case "float[]":
    case "double[]":
      return `vector<double> ${name} = __parseDoubleArray(__lines[__idx++]);`;
    case "string[]":
    case "char[]":
      return `vector<string> ${name} = __parseStringArray(__lines[__idx++]);`;
    case "int[][]":
      return `vector<vector<int>> ${name} = __parseInt2DArray(__lines[__idx++]);`;
    case "string[][]":
      return `vector<vector<string>> ${name} = __parseString2DArray(__lines[__idx++]);`;
    default:
      return "";
  }
}

function generateCParsing(param: ParameterTypeDef): string {
  const name = param.name;
  switch (param.type) {
    case "int":
      return `int ${name} = atoi(__readLine());`;
    case "long":
      return `long ${name} = atol(__readLine());`;
    case "float":
      return `float ${name} = strtof(__readLine(), NULL);`;
    case "double":
      return `double ${name} = strtod(__readLine(), NULL);`;
    case "string":
      return `char* ${name} = __dup(__readLine());`;
    case "bool":
      return `bool ${name} = __parseBool(__readLine());`;
    case "int[]":
      return `int ${name}Size = 0; int* ${name} = __parseIntArray(__readLine(), &${name}Size);`;
    case "long[]":
      return `int ${name}Size = 0; long* ${name} = __parseLongArray(__readLine(), &${name}Size);`;
    case "float[]":
    case "double[]":
      return `int ${name}Size = 0; double* ${name} = __parseDoubleArray(__readLine(), &${name}Size);`;
    case "string[]":
    case "char[]":
      return `int ${name}Size = 0; char** ${name} = __parseStringArray(__readLine(), &${name}Size);`;
    default:
      return "";
  }
}

function generateFunctionCall(userCode: string, language: WrapperLanguage, meta: WrapperProblemMeta): string {
  const args = meta.parameterTypes.map((param) => param.name).join(", ");

  if (language === "javascript" || language === "typescript") {
    const fn = escapeRegExp(meta.functionName);
    const isClass = /class\s+Solution\b/.test(userCode);
    const hasNamedFunction = new RegExp(`\\bfunction\\s+${fn}\\b`).test(userCode);
    const hasVarFunction = new RegExp(`\\b(?:var|const|let)\\s+${fn}\\s*=\\s*function\\b`).test(userCode);
    const hasArrowFunction = new RegExp(`\\b(?:var|const|let)\\s+${fn}\\s*=\\s*\\(`).test(userCode);

    if (isClass) {
      return `const __sol = new Solution();\nconst __result = __sol.${meta.functionName}(${args});`;
    }

    if (hasNamedFunction || hasVarFunction || hasArrowFunction) {
      return `const __result = ${meta.functionName}(${args});`;
    }

    return `const __sol = new Solution();\nconst __result = __sol.${meta.functionName}(${args});`;
  }

  if (language === "python") {
    return `__sol = Solution()\n__result = __sol.${meta.functionName}(${args})`;
  }

  if (language === "java") {
    return `Solution __sol = new Solution();\n${javaReturnType(meta.returnType)} __result = __sol.${meta.functionName}(${args});`;
  }

  if (language === "cpp") {
    return `Solution __sol;\nauto __result = __sol.${meta.functionName}(${args});`;
  }

  if (language === "c") {
    return `int __returnSize = 0;\nint* __result = ${meta.functionName}(${args}${args ? ", " : ""}&__returnSize);`;
  }

  throw new Error(`Unsupported wrapper language: ${language}`);
}

function javaReturnType(type: SupportedParamType | "void"): string {
  switch (type) {
    case "int":
      return "int";
    case "long":
      return "long";
    case "float":
      return "float";
    case "double":
      return "double";
    case "string":
      return "String";
    case "bool":
      return "boolean";
    case "int[]":
      return "int[]";
    case "long[]":
      return "long[]";
    case "float[]":
    case "double[]":
      return "double[]";
    case "string[]":
    case "char[]":
      return "String[]";
    case "int[][]":
      return "int[][]";
    case "string[][]":
      return "String[][]";
    case "void":
      return "void";
    default:
      return "Object";
  }
}

function generateJavaScriptWrapper(userCode: string, meta: WrapperProblemMeta): string {
  const parsing = meta.parameterTypes.map(generateJsTsParsing).join("\n");
  const call = generateFunctionCall(userCode, "javascript", meta);
  const output = formatOutputJs(meta.returnType);

  return `const __stdin = require('fs').readFileSync(0, 'utf8');
const __input = __stdin.length ? __stdin.replace(/\\r\\n/g, '\\n').trimEnd().split('\\n') : [];
let __lineIdx = 0;
function __readLine() { const L = __input[__lineIdx] !== undefined ? __input[__lineIdx] : ''; __lineIdx++; return L; }

${userCode}

${parsing}
${call}
${output}
`;
}

function generateTypeScriptWrapper(userCode: string, meta: WrapperProblemMeta): string {
  const parsing = meta.parameterTypes.map(generateJsTsParsing).join("\n");
  const call = generateFunctionCall(userCode, "typescript", meta);
  const output = formatOutputJs(meta.returnType);

  return `const __stdin: string = require('fs').readFileSync(0, 'utf8');
const __input: string[] = __stdin.length ? __stdin.replace(/\\r\\n/g, '\\n').trimEnd().split('\\n') : [];
let __lineIdx: number = 0;
function __readLine(): string { const L = __input[__lineIdx] !== undefined ? __input[__lineIdx]! : ''; __lineIdx++; return L; }

${userCode}

${parsing}
${call}
${output}
`;
}

function generatePythonWrapper(userCode: string, meta: WrapperProblemMeta): string {
  const parsing = meta.parameterTypes.map(generatePythonParsing).join("\n");
  const call = generateFunctionCall(userCode, "python", meta);
  const output = formatOutputPy(meta.returnType);

  return `import sys
import json
from typing import List, Optional, Dict, Tuple, Set

__input_lines = sys.stdin.read().strip().split('\\n')
__line_idx = 0

def __read_line():
    global __line_idx
    line = __input_lines[__line_idx] if __line_idx < len(__input_lines) else ''
    __line_idx += 1
    return line

${userCode}

${parsing}
${call}
${output}
`;
}

function generateJavaWrapper(userCode: string, meta: WrapperProblemMeta): string {
  const parsing = meta.parameterTypes.map((param) => `        ${generateJavaParsing(param)}`).join("\n");
  const call = generateFunctionCall(userCode, "java", meta)
    .split("\n")
    .map((line) => `        ${line}`)
    .join("\n");
  const output = formatOutputJava(meta.returnType, "__result");

  return `import java.util.*;
import java.io.*;

${preprocessJavaCode(userCode)}

public class Main {
    static int[] parseIntArray(String s) {
        s = s.trim();
        if (s.equals("[]")) return new int[0];
        s = s.substring(1, s.length() - 1);
        String[] parts = s.split(",");
        int[] arr = new int[parts.length];
        for (int i = 0; i < parts.length; i++) arr[i] = Integer.parseInt(parts[i].trim());
        return arr;
    }

    static long[] parseLongArray(String s) {
        s = s.trim();
        if (s.equals("[]")) return new long[0];
        s = s.substring(1, s.length() - 1);
        String[] parts = s.split(",");
        long[] arr = new long[parts.length];
        for (int i = 0; i < parts.length; i++) arr[i] = Long.parseLong(parts[i].trim());
        return arr;
    }

    static double[] parseDoubleArray(String s) {
        s = s.trim();
        if (s.equals("[]")) return new double[0];
        s = s.substring(1, s.length() - 1);
        String[] parts = s.split(",");
        double[] arr = new double[parts.length];
        for (int i = 0; i < parts.length; i++) arr[i] = Double.parseDouble(parts[i].trim());
        return arr;
    }

    static String[] parseStringArray(String s) {
        s = s.trim();
        if (s.equals("[]")) return new String[0];
        List<String> list = new ArrayList<>();
        boolean inQuote = false;
        StringBuilder cur = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '"') {
                if (inQuote) { list.add(cur.toString()); cur = new StringBuilder(); }
                inQuote = !inQuote;
            } else if (inQuote) {
                cur.append(c);
            }
        }
        return list.toArray(new String[0]);
    }

    static int[][] parseInt2DArray(String s) {
        s = s.trim();
        if (s.equals("[]")) return new int[0][0];
        List<int[]> result = new ArrayList<>();
        int depth = 0;
        StringBuilder inner = new StringBuilder();
        for (int i = 1; i < s.length() - 1; i++) {
            char c = s.charAt(i);
            if (c == '[') { depth++; inner = new StringBuilder(); inner.append(c); }
            else if (c == ']') { depth--; inner.append(c); result.add(parseIntArray(inner.toString())); }
            else if (depth > 0) inner.append(c);
        }
        return result.toArray(new int[0][]);
    }

    static String[][] parseString2DArray(String s) {
        s = s.trim();
        if (s.equals("[]")) return new String[0][0];
        List<String[]> result = new ArrayList<>();
        int depth = 0;
        StringBuilder inner = new StringBuilder();
        for (int i = 1; i < s.length() - 1; i++) {
            char c = s.charAt(i);
            if (c == '[') { depth++; inner = new StringBuilder(); inner.append(c); }
            else if (c == ']') { depth--; inner.append(c); result.add(parseStringArray(inner.toString())); }
            else if (depth > 0) inner.append(c);
        }
        return result.toArray(new String[0][]);
    }

    static String formatIntArray(int[] arr) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < arr.length; i++) { if (i > 0) sb.append(","); sb.append(arr[i]); }
        sb.append("]");
        return sb.toString();
    }

    static String formatLongArray(long[] arr) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < arr.length; i++) { if (i > 0) sb.append(","); sb.append(arr[i]); }
        sb.append("]");
        return sb.toString();
    }

    static String formatDoubleArray(double[] arr) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < arr.length; i++) { if (i > 0) sb.append(","); sb.append(arr[i]); }
        sb.append("]");
        return sb.toString();
    }

    static String formatStringArray(String[] arr) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < arr.length; i++) {
            if (i > 0) sb.append(",");
            sb.append("\"").append(arr[i]).append("\"");
        }
        sb.append("]");
        return sb.toString();
    }

    static String formatInt2DArray(int[][] arr) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < arr.length; i++) { if (i > 0) sb.append(","); sb.append(formatIntArray(arr[i])); }
        sb.append("]");
        return sb.toString();
    }

    static String formatString2DArray(String[][] arr) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < arr.length; i++) { if (i > 0) sb.append(","); sb.append(formatStringArray(arr[i])); }
        sb.append("]");
        return sb.toString();
    }

    public static void main(String[] args) throws Exception {
        String raw = new String(System.in.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8).trim();
        String[] lines = raw.isEmpty() ? new String[0] : raw.split("\\n", -1);
        int lineIdx = 0;

${parsing}

${call}
        ${output}
    }
}
`;
}

function generateCppWrapper(userCode: string, meta: WrapperProblemMeta): string {
  const parsing = meta.parameterTypes.map((param) => `    ${generateCppParsing(param)}`).join("\n");
  const call = generateFunctionCall(userCode, "cpp", meta)
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");
  const output = formatOutputCpp(meta.returnType);

  return `#include <bits/stdc++.h>
using namespace std;

vector<int> __parseIntArray(const string& s) {
    vector<int> result;
    string num;
    bool neg = false;
    for (char c : s) {
        if (c == '-') neg = true;
        else if (isdigit(c)) num += c;
        else if (!num.empty()) { result.push_back(neg ? -stoi(num) : stoi(num)); num.clear(); neg = false; }
    }
    if (!num.empty()) result.push_back(neg ? -stoi(num) : stoi(num));
    return result;
}

vector<long long> __parseLongArray(const string& s) {
    vector<long long> result;
    string num;
    bool neg = false;
    for (char c : s) {
        if (c == '-') neg = true;
        else if (isdigit(c)) num += c;
        else if (!num.empty()) { result.push_back(neg ? -stoll(num) : stoll(num)); num.clear(); neg = false; }
    }
    if (!num.empty()) result.push_back(neg ? -stoll(num) : stoll(num));
    return result;
}

vector<double> __parseDoubleArray(const string& s) {
    vector<double> result;
    string token;
    for (char c : s) {
        if ((c >= '0' && c <= '9') || c == '.' || c == '-') token += c;
        else if (!token.empty()) { result.push_back(stod(token)); token.clear(); }
    }
    if (!token.empty()) result.push_back(stod(token));
    return result;
}

vector<string> __parseStringArray(const string& s) {
    vector<string> result;
    bool inStr = false;
    string cur;
    for (char c : s) {
        if (c == '"') { if (inStr) { result.push_back(cur); cur.clear(); } inStr = !inStr; }
        else if (inStr) cur += c;
    }
    return result;
}

vector<vector<int>> __parseInt2DArray(const string& s) {
    vector<vector<int>> result;
    int depth = 0;
    string inner;
    for (int i = 1; i < (int)s.size() - 1; i++) {
        if (s[i] == '[') { depth++; inner.clear(); inner += s[i]; }
        else if (s[i] == ']') { depth--; inner += s[i]; result.push_back(__parseIntArray(inner)); }
        else if (depth > 0) inner += s[i];
    }
    return result;
}

vector<vector<string>> __parseString2DArray(const string& s) {
    vector<vector<string>> result;
    int depth = 0;
    string inner;
    for (int i = 1; i < (int)s.size() - 1; i++) {
        if (s[i] == '[') { depth++; inner.clear(); inner += s[i]; }
        else if (s[i] == ']') { depth--; inner += s[i]; result.push_back(__parseStringArray(inner)); }
        else if (depth > 0) inner += s[i];
    }
    return result;
}

string __formatIntArray(const vector<int>& arr) {
    string s = "[";
    for (int i = 0; i < (int)arr.size(); i++) { if (i) s += ","; s += to_string(arr[i]); }
    return s + "]";
}

string __formatDoubleArray(const vector<double>& arr) {
    string s = "[";
    for (int i = 0; i < (int)arr.size(); i++) { if (i) s += ","; s += to_string(arr[i]); }
    return s + "]";
}

string __formatStringArray(const vector<string>& arr) {
    string s = "[";
    for (int i = 0; i < (int)arr.size(); i++) { if (i) s += ","; s += "\"" + arr[i] + "\""; }
    return s + "]";
}

string __formatInt2DArray(const vector<vector<int>>& arr) {
    string s = "[";
    for (int i = 0; i < (int)arr.size(); i++) { if (i) s += ","; s += __formatIntArray(arr[i]); }
    return s + "]";
}

string __formatString2DArray(const vector<vector<string>>& arr) {
    string s = "[";
    for (int i = 0; i < (int)arr.size(); i++) { if (i) s += ","; s += __formatStringArray(arr[i]); }
    return s + "]";
}

${userCode}

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    vector<string> __lines;
    string __line;
    while (getline(cin, __line)) __lines.push_back(__line);
    int __idx = 0;

${parsing}

${call}
    ${output}

    return 0;
}
`;
}

function generateCWrapper(userCode: string, meta: WrapperProblemMeta): string {
  const parsing = meta.parameterTypes
    .map((param) => generateCParsing(param))
    .filter(Boolean)
    .map((line) => `    ${line}`)
    .join("\n");
  const args = meta.parameterTypes
    .flatMap((param) => (param.type.endsWith("[]") ? [param.name, `${param.name}Size`] : [param.name]))
    .join(", ");
  const returnsArray = ["int[]", "long[]", "float[]", "double[]", "string[]", "char[]"].includes(meta.returnType);
  const output = formatOutputC(meta.returnType);

  const call = (() => {
    if (meta.returnType === "void") {
      return `${meta.functionName}(${args});`;
    }

    if (returnsArray) {
      return `int __returnSize = 0;\n    ${cReturnType(meta.returnType)} __result = ${meta.functionName}(${args}${args ? ", " : ""}&__returnSize);`;
    }

    return `${cReturnType(meta.returnType)} __result = ${meta.functionName}(${args});`;
  })();

  return `#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include <ctype.h>

${userCode}

char __buf[1000000];

char* __dup(const char* s) {
    size_t len = strlen(s);
    char* out = (char*)malloc(len + 1);
    memcpy(out, s, len + 1);
    return out;
}

char* __readLine() {
    if (!fgets(__buf, sizeof(__buf), stdin)) return "";
    size_t len = strlen(__buf);
    if (len > 0 && __buf[len - 1] == '\\n') __buf[len - 1] = '\\0';
    return __buf;
}

bool __parseBool(const char* s) {
    char lower[16];
    size_t n = strlen(s);
    if (n >= sizeof(lower)) n = sizeof(lower) - 1;
    for (size_t i = 0; i < n; i++) lower[i] = (char)tolower((unsigned char)s[i]);
    lower[n] = '\\0';
    return strcmp(lower, "true") == 0 || strcmp(lower, "1") == 0;
}

int* __parseIntArray(const char* s, int* size) {
    int capacity = 16;
    int* arr = (int*)malloc(capacity * sizeof(int));
    *size = 0;
    int num = 0, neg = 0, hasNum = 0;
    for (int i = 0; s[i]; i++) {
        if (s[i] == '-') neg = 1;
        else if (s[i] >= '0' && s[i] <= '9') { num = num * 10 + (s[i] - '0'); hasNum = 1; }
        else if (hasNum) {
            if (*size >= capacity) { capacity *= 2; arr = (int*)realloc(arr, capacity * sizeof(int)); }
            arr[(*size)++] = neg ? -num : num;
            num = 0; neg = 0; hasNum = 0;
        }
    }
    if (hasNum) arr[(*size)++] = neg ? -num : num;
    return arr;
}

long* __parseLongArray(const char* s, int* size) {
    int capacity = 16;
    long* arr = (long*)malloc(capacity * sizeof(long));
    *size = 0;
    long num = 0;
    int neg = 0, hasNum = 0;
    for (int i = 0; s[i]; i++) {
        if (s[i] == '-') neg = 1;
        else if (s[i] >= '0' && s[i] <= '9') { num = num * 10 + (s[i] - '0'); hasNum = 1; }
        else if (hasNum) {
            if (*size >= capacity) { capacity *= 2; arr = (long*)realloc(arr, capacity * sizeof(long)); }
            arr[(*size)++] = neg ? -num : num;
            num = 0; neg = 0; hasNum = 0;
        }
    }
    if (hasNum) arr[(*size)++] = neg ? -num : num;
    return arr;
}

double* __parseDoubleArray(const char* s, int* size) {
    int capacity = 16;
    double* arr = (double*)malloc(capacity * sizeof(double));
    *size = 0;
    char token[128];
    int tokenIdx = 0;
    for (int i = 0; s[i]; i++) {
        char c = s[i];
        if ((c >= '0' && c <= '9') || c == '-' || c == '.' || c == 'e' || c == 'E' || c == '+') {
            if (tokenIdx < (int)sizeof(token) - 1) token[tokenIdx++] = c;
        } else if (tokenIdx > 0) {
            token[tokenIdx] = '\\0';
            if (*size >= capacity) { capacity *= 2; arr = (double*)realloc(arr, capacity * sizeof(double)); }
            arr[(*size)++] = strtod(token, NULL);
            tokenIdx = 0;
        }
    }
    if (tokenIdx > 0) {
        token[tokenIdx] = '\\0';
        if (*size >= capacity) { capacity *= 2; arr = (double*)realloc(arr, capacity * sizeof(double)); }
        arr[(*size)++] = strtod(token, NULL);
    }
    return arr;
}

char** __parseStringArray(const char* s, int* size) {
    int capacity = 8;
    char** arr = (char**)malloc(capacity * sizeof(char*));
    *size = 0;
    int inQuote = 0;
    char token[1024];
    int tokenIdx = 0;

    for (int i = 0; s[i]; i++) {
      if (s[i] == '"') {
        if (inQuote) {
          token[tokenIdx] = '\\0';
          if (*size >= capacity) { capacity *= 2; arr = (char**)realloc(arr, capacity * sizeof(char*)); }
          arr[(*size)++] = __dup(token);
          tokenIdx = 0;
        }
        inQuote = !inQuote;
      } else if (inQuote && tokenIdx < (int)sizeof(token) - 1) {
        token[tokenIdx++] = s[i];
      }
    }
    return arr;
}

void __printIntArray(const int* arr, int n) {
    printf("[");
    for (int i = 0; i < n; i++) { if (i) printf(","); printf("%d", arr[i]); }
    printf("]\\n");
}

void __printLongArray(const long* arr, int n) {
    printf("[");
    for (int i = 0; i < n; i++) { if (i) printf(","); printf("%ld", arr[i]); }
    printf("]\\n");
}

void __printDoubleArray(const double* arr, int n) {
    printf("[");
    for (int i = 0; i < n; i++) { if (i) printf(","); printf("%.12g", arr[i]); }
    printf("]\\n");
}

void __printStringArray(char* const* arr, int n) {
    printf("[");
    for (int i = 0; i < n; i++) { if (i) printf(","); printf("\\\"%s\\\"", arr[i] ? arr[i] : ""); }
    printf("]\\n");
}

int main() {
${parsing}

    ${call}
    ${output}

    return 0;
}
`;
}

function cReturnType(type: SupportedParamType | "void"): string {
  switch (type) {
    case "int":
      return "int";
    case "long":
      return "long";
    case "float":
      return "float";
    case "double":
      return "double";
    case "string":
      return "char*";
    case "bool":
      return "bool";
    case "int[]":
      return "int*";
    case "long[]":
      return "long*";
    case "float[]":
    case "double[]":
      return "double*";
    case "string[]":
    case "char[]":
      return "char**";
    default:
      return "void*";
  }
}

export function generateWrappedCode(
  language: WrapperLanguage,
  userCode: string,
  meta: WrapperProblemMeta
): string {
  if (!meta.functionName || meta.parameterTypes.length === 0 || !meta.returnType) {
    throw new Error("Wrapper metadata is incomplete. functionName, parameterTypes, and returnType are required.");
  }

  switch (language) {
    case "javascript":
      return generateJavaScriptWrapper(userCode, meta);
    case "typescript":
      return generateTypeScriptWrapper(userCode, meta);
    case "python":
      return generatePythonWrapper(userCode, meta);
    case "java":
      return generateJavaWrapper(userCode, meta);
    case "cpp":
      return generateCppWrapper(userCode, meta);
    case "c":
      return generateCWrapper(userCode, meta);
    default:
      throw new Error(`Unsupported wrapper language: ${language}`);
  }
}
