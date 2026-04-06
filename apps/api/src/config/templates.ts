/**
 * Language-specific drivers (templates) for professional LeetCode-style execution.
 * These templates provide the `main` method and I/O logic,
 * allowing users to focus only on the core Solution class or function.
 *
 * RankRoom wrapped submissions (generateWrappedCode) already include a full `main`
 * and helpers — applying the driver again breaks C++/C (shadowed_main arity) and
 * would double-wrap Python. Skip when markers are present.
 */

export function isRankRoomWrappedSubmission(sourceCode: string): boolean {
  const wrappers = [
    /vector<string>\s+__lines\s*;[\s\S]*size_t\s+__idx\s*=\s*0\s*;/,
    /char\s+__buf\[1000000\]\s*;[\s\S]*fgets\(__buf,\s*sizeof\(__buf\),\s*stdin\)/,
    /__input_lines\s*=\s*sys\.stdin\.read\(\)\.splitlines\(\)/,
    /const\s+__input\s*=\s*require\(['"]fs['"]\)\.readFileSync\(0,\s*['"]utf8['"]\)\s*;[\s\S]*function\s+__readLine\s*\(\)/,
    /StringBuilder\s+inputBuilder\s*=\s*new\s+StringBuilder\(\);[\s\S]*inputBuilder\.append\(sc\.nextLine\(\)\)/,
  ];

  return wrappers.some((pattern) => pattern.test(sourceCode));
}

export interface CodeTemplate {
  wrap: (userCode: string) => string;
}

const JAVA_TEMPLATE: CodeTemplate = {
  wrap: (userCode: string) => {
    // If user already provided a Main class, don't wrap it.
    if (userCode.includes("public class Main") || userCode.includes("class Main")) {
      return userCode;
    }

    return `
import java.util.*;
import java.io.*;

/**
 * RankRoom Platform Driver
 */

${userCode}

public class Main {
    public static void main(String[] args) throws Exception {
        // Driver calls solve() if it exists in a Solution class
        // This is a basic generic driver for the MVP.
        Scanner sc = new Scanner(System.in);
        try {
            // Attempt to use a Solution class if defined by user
            // We use reflection or simply rely on the user's code being in scope.
            // For now, we simply ensure the user's code is included and the Main class exists.
            while (sc.hasNextLine()) {
                String line = sc.nextLine();
                System.out.println(line);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
`;
  },
};

const CPP_TEMPLATE: CodeTemplate = {
  wrap: (userCode: string) => {
    // If user already has a main, shadow it. Judge0's outer driver calls
    // main(argc, argv) — our wrapped solutions use zero-arg int main().
    if (userCode.includes("int main")) {
      const replaced = userCode.replace(/int\s+main\s*\(/g, "int shadowed_main(");
      return `${replaced}\n\nint main(int argc, char** argv) { (void)argc; (void)argv; return shadowed_main(); }\n`;
    }

    return `
#include <iostream>
#include <vector>
#include <string>
#include <algorithm>

using namespace std;

${userCode}

int main() {
    string line;
    while (getline(cin, line)) {
        cout << line << endl;
    }
    return 0;
}
`;
  },
};

const C_TEMPLATE: CodeTemplate = {
  wrap: (userCode: string) => {
    let processingCode = userCode;
    if (userCode.includes("int main")) {
      processingCode = userCode.replace(/int\s+main\s*\(/g, "int shadowed_main(");
      return `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

${processingCode}

int main(void) {
    return shadowed_main();
}
`;
    }

    return `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

${processingCode}

int main() {
    char buffer[4096];
    while (fgets(buffer, sizeof(buffer), stdin)) {
        printf("%s", buffer);
    }
    return 0;
}
`;
  },
};

const PYTHON_TEMPLATE: CodeTemplate = {
  wrap: (userCode: string) => {
    if (userCode.includes("if __name__ == ")) {
        return userCode;
    }
    return `
import sys

${userCode}

if __name__ == "__main__":
    for line in sys.stdin:
        sys.stdout.write(line)
`;
  },
};

export const CODE_TEMPLATES: Record<number, CodeTemplate> = {
  62: JAVA_TEMPLATE,
  91: JAVA_TEMPLATE,
  54: CPP_TEMPLATE,
  76: CPP_TEMPLATE,
  52: CPP_TEMPLATE,
  53: CPP_TEMPLATE,
  50: C_TEMPLATE,
  75: C_TEMPLATE,
  48: C_TEMPLATE,
  49: C_TEMPLATE,
  71: PYTHON_TEMPLATE,
  70: PYTHON_TEMPLATE,
};

export function wrapSourceCode(languageId: number, sourceCode: string): string {
  if (isRankRoomWrappedSubmission(sourceCode)) {
    return sourceCode;
  }
  const template = CODE_TEMPLATES[languageId];
  if (!template) return sourceCode;
  return template.wrap(sourceCode);
}
