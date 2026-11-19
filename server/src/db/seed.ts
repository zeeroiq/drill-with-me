import type { DatabaseInstance } from './schema.js';

export interface SeedProblem {
  slug: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  description_md: string;
  starter_code: string;
  test_harness_code: string;
  test_cases: {
    input_display: string;
    input_payload: string;
    expected_output: string;
    is_hidden: number;
    sort_order: number;
  }[];
}

const HARNESS_HELPER_METHODS = `
    static String escape(String s) {
        if (s == null) return "null";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': sb.append("\\\\\\""); break;
                case '\\\\': sb.append("\\\\\\\\"); break;
                case '\\b': sb.append("\\\\b"); break;
                case '\\f': sb.append("\\\\f"); break;
                case '\\n': sb.append("\\\\n"); break;
                case '\\r': sb.append("\\\\r"); break;
                case '\\t': sb.append("\\\\t"); break;
                default:
                    if (c < 32 || c > 126) {
                        sb.append(String.format("\\\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
            }
        }
        return sb.toString();
    }

    static void printResult(int testIndex, boolean passed, String input, String expected, String actual, String errorMessage) {
        System.out.println("---TEST_RESULT_START---");
        System.out.print("{\\"testIndex\\": " + testIndex + ", ");
        System.out.print("\\"passed\\": " + passed + ", ");
        System.out.print("\\"input\\": \\"" + escape(input) + "\\", ");
        System.out.print("\\"expected\\": \\"" + escape(expected) + "\\", ");
        System.out.print("\\"actual\\": " + (actual == null ? "null" : "\\"" + escape(actual) + "\\"") + ", ");
        System.out.print("\\"errorMessage\\": " + (errorMessage == null ? "null" : "\\"" + escape(errorMessage) + "\\""));
        System.out.println("}");
        System.out.println("---TEST_RESULT_END---");
    }

    static void printSummary(int passedCount, int totalCount) {
        System.out.println("---SUMMARY_START---");
        System.out.println("{\\"passedCount\\": " + passedCount + ", \\"totalCount\\": " + totalCount + ", \\"allPassed\\": " + (passedCount == totalCount && totalCount > 0) + "}");
        System.out.println("---SUMMARY_END---");
    }
`;

export const PROBLEMS: SeedProblem[] = [
  // 1. Two Sum
  {
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    description_md: `# Two Sum

Given an array of integers \`nums\` and an integer \`target\`, return *indices of the two numbers such that they add up to \`target\`*.

You may assume that each input would have **exactly one solution**, and you may not use the same element twice.

You can return the answer in any order.

### Example 1:
\`\`\`
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].
\`\`\`

### Example 2:
\`\`\`
Input: nums = [3,2,4], target = 6
Output: [1,2]
\`\`\`

### Example 3:
\`\`\`
Input: nums = [3,3], target = 6
Output: [0,1]
\`\`\`

### Constraints:
* \`2 <= nums.length <= 10^4\`
* \`-10^9 <= nums[i] <= 10^9\`
* \`-10^9 <= target <= 10^9\`
* **Only one valid answer exists.**
`,
    starter_code: `class Solution {
    public int[] twoSum(int[] nums, int target) {
        // Write your solution here
        return new int[]{};
    }
}`,
    test_harness_code: `import java.util.*;

public class Main {
${HARNESS_HELPER_METHODS}

    public static void main(String[] args) {
        boolean visibleOnly = args.length > 0 && ("--visible-only".equals(args[0]) || "run".equalsIgnoreCase(args[0]) || "--run".equalsIgnoreCase(args[0]));
        Solution sol = new Solution();
        int passed = 0;
        int total = visibleOnly ? 2 : 5;

        // Test 0 (Visible)
        {
            int testIndex = 0;
            String input = "nums = [2,7,11,15], target = 9";
            String expected = "[0,1]";
            try {
                int[] nums = {2, 7, 11, 15};
                int target = 9;
                int[] res = sol.twoSum(nums, target);
                String actual = res == null ? "null" : Arrays.toString(res);
                boolean ok = false;
                if (res != null && res.length == 2) {
                    int[] sorted = res.clone();
                    Arrays.sort(sorted);
                    ok = (sorted[0] == 0 && sorted[1] == 1);
                }
                if (ok) passed++;
                printResult(testIndex, ok, input, expected, actual, null);
            } catch (Throwable t) {
                printResult(testIndex, false, input, expected, null, t.getClass().getSimpleName() + ": " + (t.getMessage() != null ? t.getMessage() : "Execution failed"));
            }
        }

        // Test 1 (Visible)
        {
            int testIndex = 1;
            String input = "nums = [3,2,4], target = 6";
            String expected = "[1,2]";
            try {
                int[] nums = {3, 2, 4};
                int target = 6;
                int[] res = sol.twoSum(nums, target);
                String actual = res == null ? "null" : Arrays.toString(res);
                boolean ok = false;
                if (res != null && res.length == 2) {
                    int[] sorted = res.clone();
                    Arrays.sort(sorted);
                    ok = (sorted[0] == 1 && sorted[1] == 2);
                }
                if (ok) passed++;
                printResult(testIndex, ok, input, expected, actual, null);
            } catch (Throwable t) {
                printResult(testIndex, false, input, expected, null, t.getClass().getSimpleName() + ": " + (t.getMessage() != null ? t.getMessage() : "Execution failed"));
            }
        }

        if (!visibleOnly) {
            // Test 2 (Hidden)
            {
                int testIndex = 2;
                String input = "nums = [3,3], target = 6";
                String expected = "[0,1]";
                try {
                    int[] nums = {3, 3};
                    int target = 6;
                    int[] res = sol.twoSum(nums, target);
                    String actual = res == null ? "null" : Arrays.toString(res);
                    boolean ok = false;
                    if (res != null && res.length == 2) {
                        int[] sorted = res.clone();
                        Arrays.sort(sorted);
                        ok = (sorted[0] == 0 && sorted[1] == 1);
                    }
                    if (ok) passed++;
                    printResult(testIndex, ok, input, expected, actual, null);
                } catch (Throwable t) {
                    printResult(testIndex, false, input, expected, null, t.getClass().getSimpleName() + ": " + (t.getMessage() != null ? t.getMessage() : "Execution failed"));
                }
            }

            // Test 3 (Hidden)
            {
                int testIndex = 3;
                String input = "nums = [-1,-2,-3,-4,-5], target = -8";
                String expected = "[2,4]";
                try {
                    int[] nums = {-1, -2, -3, -4, -5};
                    int target = -8;
                    int[] res = sol.twoSum(nums, target);
                    String actual = res == null ? "null" : Arrays.toString(res);
                    boolean ok = false;
                    if (res != null && res.length == 2) {
                        int[] sorted = res.clone();
                        Arrays.sort(sorted);
                        ok = (sorted[0] == 2 && sorted[1] == 4);
                    }
                    if (ok) passed++;
                    printResult(testIndex, ok, input, expected, actual, null);
                } catch (Throwable t) {
                    printResult(testIndex, false, input, expected, null, t.getClass().getSimpleName() + ": " + (t.getMessage() != null ? t.getMessage() : "Execution failed"));
                }
            }

            // Test 4 (Hidden)
            {
                int testIndex = 4;
                String input = "nums = [0,4,3,0], target = 0";
                String expected = "[0,3]";
                try {
                    int[] nums = {0, 4, 3, 0};
                    int target = 0;
                    int[] res = sol.twoSum(nums, target);
                    String actual = res == null ? "null" : Arrays.toString(res);
                    boolean ok = false;
                    if (res != null && res.length == 2) {
                        int[] sorted = res.clone();
                        Arrays.sort(sorted);
                        ok = (sorted[0] == 0 && sorted[1] == 3);
                    }
                    if (ok) passed++;
                    printResult(testIndex, ok, input, expected, actual, null);
                } catch (Throwable t) {
                    printResult(testIndex, false, input, expected, null, t.getClass().getSimpleName() + ": " + (t.getMessage() != null ? t.getMessage() : "Execution failed"));
                }
            }
        }

        printSummary(passed, total);
    }
}`,
    test_cases: [
      {
        input_display: 'nums = [2,7,11,15], target = 9',
        input_payload: JSON.stringify({ nums: [2, 7, 11, 15], target: 9 }),
        expected_output: '[0,1]',
        is_hidden: 0,
        sort_order: 1,
      },
      {
        input_display: 'nums = [3,2,4], target = 6',
        input_payload: JSON.stringify({ nums: [3, 2, 4], target: 6 }),
        expected_output: '[1,2]',
        is_hidden: 0,
        sort_order: 2,
      },
      {
        input_display: 'nums = [3,3], target = 6',
        input_payload: JSON.stringify({ nums: [3, 3], target: 6 }),
        expected_output: '[0,1]',
        is_hidden: 1,
        sort_order: 3,
      },
      {
        input_display: 'nums = [-1,-2,-3,-4,-5], target = -8',
        input_payload: JSON.stringify({ nums: [-1, -2, -3, -4, -5], target: -8 }),
        expected_output: '[2,4]',
        is_hidden: 1,
        sort_order: 4,
      },
      {
        input_display: 'nums = [0,4,3,0], target = 0',
        input_payload: JSON.stringify({ nums: [0, 4, 3, 0], target: 0 }),
        expected_output: '[0,3]',
        is_hidden: 1,
        sort_order: 5,
      },
    ],
  },

  // 2. Valid Palindrome
  {
    slug: 'valid-palindrome',
    title: 'Valid Palindrome',
    difficulty: 'Easy',
    description_md: `# Valid Palindrome

A phrase is a **palindrome** if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. Alphanumeric characters include letters and numbers.

Given a string \`s\`, return \`true\` *if it is a palindrome, or* \`false\` *otherwise*.

### Example 1:
\`\`\`
Input: s = "A man, a plan, a canal: Panama"
Output: true
Explanation: "amanaplanacanalpanama" is a palindrome.
\`\`\`

### Example 2:
\`\`\`
Input: s = "race a car"
Output: false
Explanation: "raceacar" is not a palindrome.
\`\`\`

### Example 3:
\`\`\`
Input: s = " "
Output: true
Explanation: s is an empty string "" after removing non-alphanumeric characters.
Since an empty string reads the same forward and backward, it is a palindrome.
\`\`\`

### Constraints:
* \`1 <= s.length <= 2 * 10^5\`
* \`s\` consists only of printable ASCII characters.
`,
    starter_code: `class Solution {
    public boolean isPalindrome(String s) {
        // Write your solution here
        return false;
    }
}`,
    test_harness_code: `import java.util.*;

public class Main {
${HARNESS_HELPER_METHODS}

    public static void main(String[] args) {
        boolean visibleOnly = args.length > 0 && ("--visible-only".equals(args[0]) || "run".equalsIgnoreCase(args[0]) || "--run".equalsIgnoreCase(args[0]));
        Solution sol = new Solution();
        int passed = 0;
        int total = visibleOnly ? 2 : 5;

        // Test 0 (Visible)
        {
            int testIndex = 0;
            String input = "s = \\"A man, a plan, a canal: Panama\\"";
            String expected = "true";
            try {
                String s = "A man, a plan, a canal: Panama";
                boolean res = sol.isPalindrome(s);
                String actual = String.valueOf(res);
                boolean ok = (res == true);
                if (ok) passed++;
                printResult(testIndex, ok, input, expected, actual, null);
            } catch (Throwable t) {
                printResult(testIndex, false, input, expected, null, t.getClass().getSimpleName() + ": " + (t.getMessage() != null ? t.getMessage() : "Execution failed"));
            }
        }

        // Test 1 (Visible)
        {
            int testIndex = 1;
            String input = "s = \\"race a car\\"";
            String expected = "false";
            try {
                String s = "race a car";
                boolean res = sol.isPalindrome(s);
                String actual = String.valueOf(res);
                boolean ok = (res == false);
                if (ok) passed++;
                printResult(testIndex, ok, input, expected, actual, null);
            } catch (Throwable t) {
                printResult(testIndex, false, input, expected, null, t.getClass().getSimpleName() + ": " + (t.getMessage() != null ? t.getMessage() : "Execution failed"));
            }
        }

        if (!visibleOnly) {
            // Test 2 (Hidden)
            {
                int testIndex = 2;
                String input = "s = \\" \\"";
                String expected = "true";
                try {
                    String s = " ";
                    boolean res = sol.isPalindrome(s);
                    String actual = String.valueOf(res);
                    boolean ok = (res == true);
                    if (ok) passed++;
                    printResult(testIndex, ok, input, expected, actual, null);
                } catch (Throwable t) {
                    printResult(testIndex, false, input, expected, null, t.getClass().getSimpleName() + ": " + (t.getMessage() != null ? t.getMessage() : "Execution failed"));
                }
            }

            // Test 3 (Hidden)
            {
                int testIndex = 3;
                String input = "s = \\"0P\\"";
                String expected = "false";
                try {
                    String s = "0P";
                    boolean res = sol.isPalindrome(s);
                    String actual = String.valueOf(res);
                    boolean ok = (res == false);
                    if (ok) passed++;
                    printResult(testIndex, ok, input, expected, actual, null);
                } catch (Throwable t) {
                    printResult(testIndex, false, input, expected, null, t.getClass().getSimpleName() + ": " + (t.getMessage() != null ? t.getMessage() : "Execution failed"));
                }
            }

            // Test 4 (Hidden)
            {
                int testIndex = 4;
                String input = "s = \\"ab_a\\"";
                String expected = "true";
                try {
                    String s = "ab_a";
                    boolean res = sol.isPalindrome(s);
                    String actual = String.valueOf(res);
                    boolean ok = (res == true);
                    if (ok) passed++;
                    printResult(testIndex, ok, input, expected, actual, null);
                } catch (Throwable t) {
                    printResult(testIndex, false, input, expected, null, t.getClass().getSimpleName() + ": " + (t.getMessage() != null ? t.getMessage() : "Execution failed"));
                }
            }
        }

        printSummary(passed, total);
    }
}`,
    test_cases: [
      {
        input_display: 's = "A man, a plan, a canal: Panama"',
        input_payload: JSON.stringify({ s: 'A man, a plan, a canal: Panama' }),
        expected_output: 'true',
        is_hidden: 0,
        sort_order: 1,
      },
      {
        input_display: 's = "race a car"',
        input_payload: JSON.stringify({ s: 'race a car' }),
        expected_output: 'false',
        is_hidden: 0,
        sort_order: 2,
      },
      {
        input_display: 's = " "',
        input_payload: JSON.stringify({ s: ' ' }),
        expected_output: 'true',
        is_hidden: 1,
        sort_order: 3,
      },
      {
        input_display: 's = "0P"',
        input_payload: JSON.stringify({ s: '0P' }),
        expected_output: 'false',
        is_hidden: 1,
        sort_order: 4,
      },
      {
        input_display: 's = "ab_a"',
        input_payload: JSON.stringify({ s: 'ab_a' }),
        expected_output: 'true',
        is_hidden: 1,
        sort_order: 5,
      },
    ],
  },

  // 3. Valid Parentheses
  {
    slug: 'valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: 'Easy',
    description_md: `# Valid Parentheses

Given a string \`s\` containing just the characters \`'('\`, \`')'\`, \`'{'\`, \`'}'\`, \`'['\` and \`']'\`, determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.

### Example 1:
\`\`\`
Input: s = "()"
Output: true
\`\`\`

### Example 2:
\`\`\`
Input: s = "()[]{}"
Output: true
\`\`\`

### Example 3:
\`\`\`
Input: s = "(]"
Output: false
\`\`\`

### Example 4:
\`\`\`
Input: s = "([])"
Output: true
\`\`\`

### Constraints:
* \`1 <= s.length <= 10^4\`
* \`s\` consists of parentheses only \`'()[]{}'\`.
`,
    starter_code: `class Solution {
    public boolean isValid(String s) {
        // Write your solution here
        return false;
    }
}`,
    test_harness_code: `import java.util.*;

public class Main {
${HARNESS_HELPER_METHODS}

    public static void main(String[] args) {
        boolean visibleOnly = args.length > 0 && ("--visible-only".equals(args[0]) || "run".equalsIgnoreCase(args[0]) || "--run".equalsIgnoreCase(args[0]));
        Solution sol = new Solution();
        int passed = 0;
        int total = visibleOnly ? 2 : 5;

        // Test 0 (Visible)
        {
            int testIndex = 0;
            String input = "s = \\"()\\"";
            String expected = "true";
            try {
                String s = "()";
                boolean res = sol.isValid(s);
                String actual = String.valueOf(res);
                boolean ok = (res == true);
                if (ok) passed++;
                printResult(testIndex, ok, input, expected, actual, null);
            } catch (Throwable t) {
                printResult(testIndex, false, input, expected, null, t.getClass().getSimpleName() + ": " + (t.getMessage() != null ? t.getMessage() : "Execution failed"));
            }
        }

        // Test 1 (Visible)
        {
            int testIndex = 1;
            String input = "s = \\"()[]{}\\"";
            String expected = "true";
            try {
                String s = "()[]{}";
                boolean res = sol.isValid(s);
                String actual = String.valueOf(res);
                boolean ok = (res == true);
                if (ok) passed++;
                printResult(testIndex, ok, input, expected, actual, null);
            } catch (Throwable t) {
                printResult(testIndex, false, input, expected, null, t.getClass().getSimpleName() + ": " + (t.getMessage() != null ? t.getMessage() : "Execution failed"));
            }
        }

        if (!visibleOnly) {
            // Test 2 (Hidden)
            {
                int testIndex = 2;
                String input = "s = \\"(]\\\"";
                String expected = "false";
                try {
                    String s = "(]";
                    boolean res = sol.isValid(s);
                    String actual = String.valueOf(res);
                    boolean ok = (res == false);
                    if (ok) passed++;
                    printResult(testIndex, ok, input, expected, actual, null);
                } catch (Throwable t) {
                    printResult(testIndex, false, input, expected, null, t.getClass().getSimpleName() + ": " + (t.getMessage() != null ? t.getMessage() : "Execution failed"));
                }
            }

            // Test 3 (Hidden)
            {
                int testIndex = 3;
                String input = "s = \\"([])\\"";
                String expected = "true";
                try {
                    String s = "([])";
                    boolean res = sol.isValid(s);
                    String actual = String.valueOf(res);
                    boolean ok = (res == true);
                    if (ok) passed++;
                    printResult(testIndex, ok, input, expected, actual, null);
                } catch (Throwable t) {
                    printResult(testIndex, false, input, expected, null, t.getClass().getSimpleName() + ": " + (t.getMessage() != null ? t.getMessage() : "Execution failed"));
                }
            }

            // Test 4 (Hidden)
            {
                int testIndex = 4;
                String input = "s = \\"([)]\\"";
                String expected = "false";
                try {
                    String s = "([)]";
                    boolean res = sol.isValid(s);
                    String actual = String.valueOf(res);
                    boolean ok = (res == false);
                    if (ok) passed++;
                    printResult(testIndex, ok, input, expected, actual, null);
                } catch (Throwable t) {
                    printResult(testIndex, false, input, expected, null, t.getClass().getSimpleName() + ": " + (t.getMessage() != null ? t.getMessage() : "Execution failed"));
                }
            }
        }

        printSummary(passed, total);
    }
}`,
    test_cases: [
      {
        input_display: 's = "()"',
        input_payload: JSON.stringify({ s: '()' }),
        expected_output: 'true',
        is_hidden: 0,
        sort_order: 1,
      },
      {
        input_display: 's = "()[]{}"',
        input_payload: JSON.stringify({ s: '()[]{}' }),
        expected_output: 'true',
        is_hidden: 0,
        sort_order: 2,
      },
      {
        input_display: 's = "(]"',
        input_payload: JSON.stringify({ s: '(]' }),
        expected_output: 'false',
        is_hidden: 1,
        sort_order: 3,
      },
      {
        input_display: 's = "([])"',
        input_payload: JSON.stringify({ s: '([])' }),
        expected_output: 'true',
        is_hidden: 1,
        sort_order: 4,
      },
      {
        input_display: 's = "([)]"',
        input_payload: JSON.stringify({ s: '([)]' }),
        expected_output: 'false',
        is_hidden: 1,
        sort_order: 5,
      },
    ],
  },

  // 4. Best Time to Buy and Sell Stock
  {
    slug: 'best-time-to-buy-and-sell-stock',
    title: 'Best Time to Buy and Sell Stock',
    difficulty: 'Easy',
    description_md: `# Best Time to Buy and Sell Stock

You are given an array \`prices\` where \`prices[i]\` is the price of a given stock on the \`i\`th day.

You want to maximize your profit by choosing a **single day** to buy one stock and choosing a **different day in the future** to sell that stock.

Return *the maximum profit you can achieve from this transaction*. If you cannot achieve any profit, return \`0\`.

### Example 1:
\`\`\`
Input: prices = [7,1,5,3,6,4]
Output: 5
Explanation: Buy on day 2 (price = 1) and sell on day 5 (price = 6), profit = 6-1 = 5.
Note that buying on day 2 and selling on day 1 is not allowed because you must buy before you sell.
\`\`\`

### Example 2:
\`\`\`
Input: prices = [7,6,4,3,1]
Output: 0
Explanation: In this case, no transactions are done and the max profit = 0.
\`\`\`

### Constraints:
* \`1 <= prices.length <= 10^5\`
* \`0 <= prices[i] <= 10^4\`
`,
    starter_code: `class Solution {
    public int maxProfit(int[] prices) {
        // Write your solution here
        return 0;
    }
}`,
    test_harness_code: `import java.util.*;

public class Main {
${HARNESS_HELPER_METHODS}

    public static void main(String[] args) {
        boolean visibleOnly = args.length > 0 && ("--visible-only".equals(args[0]) || "run".equalsIgnoreCase(args[0]) || "--run".equalsIgnoreCase(args[0]));
        Solution sol = new Solution();
        int passed = 0;
        int total = visibleOnly ? 2 : 5;

        // Test 0 (Visible)
        {
            int testIndex = 0;
            String input = "prices = [7,1,5,3,6,4]";
            String expected = "5";
            try {
                int[] prices = {7, 1, 5, 3, 6, 4};
                int res = sol.maxProfit(prices);
                String actual = String.valueOf(res);
                boolean ok = (res == 5);
                if (ok) passed++;
                printResult(testIndex, ok, input, expected, actual, null);
            } catch (Throwable t) {
                printResult(testIndex, false, input, expected, null, t.getClass().getSimpleName() + ": " + (t.getMessage() != null ? t.getMessage() : "Execution failed"));
            }
        }

        // Test 1 (Visible)
        {
            int testIndex = 1;
            String input = "prices = [7,6,4,3,1]";
            String expected = "0";
            try {
                int[] prices = {7, 6, 4, 3, 1};
                int res = sol.maxProfit(prices);
                String actual = String.valueOf(res);
                boolean ok = (res == 0);
                if (ok) passed++;
                printResult(testIndex, ok, input, expected, actual, null);
            } catch (Throwable t) {
                printResult(testIndex, false, input, expected, null, t.getClass().getSimpleName() + ": " + (t.getMessage() != null ? t.getMessage() : "Execution failed"));
            }
        }

        if (!visibleOnly) {
            // Test 2 (Hidden)
            {
                int testIndex = 2;
                String input = "prices = [1,2]";
                String expected = "1";
                try {
                    int[] prices = {1, 2};
                    int res = sol.maxProfit(prices);
                    String actual = String.valueOf(res);
                    boolean ok = (res == 1);
                    if (ok) passed++;
                    printResult(testIndex, ok, input, expected, actual, null);
                } catch (Throwable t) {
                    printResult(testIndex, false, input, expected, null, t.getClass().getSimpleName() + ": " + (t.getMessage() != null ? t.getMessage() : "Execution failed"));
                }
            }

            // Test 3 (Hidden)
            {
                int testIndex = 3;
                String input = "prices = [2,4,1]";
                String expected = "2";
                try {
                    int[] prices = {2, 4, 1};
                    int res = sol.maxProfit(prices);
                    String actual = String.valueOf(res);
                    boolean ok = (res == 2);
                    if (ok) passed++;
                    printResult(testIndex, ok, input, expected, actual, null);
                } catch (Throwable t) {
                    printResult(testIndex, false, input, expected, null, t.getClass().getSimpleName() + ": " + (t.getMessage() != null ? t.getMessage() : "Execution failed"));
                }
            }

            // Test 4 (Hidden)
            {
                int testIndex = 4;
                String input = "prices = [3,2,6,5,0,3]";
                String expected = "4";
                try {
                    int[] prices = {3, 2, 6, 5, 0, 3};
                    int res = sol.maxProfit(prices);
                    String actual = String.valueOf(res);
                    boolean ok = (res == 4);
                    if (ok) passed++;
                    printResult(testIndex, ok, input, expected, actual, null);
                } catch (Throwable t) {
                    printResult(testIndex, false, input, expected, null, t.getClass().getSimpleName() + ": " + (t.getMessage() != null ? t.getMessage() : "Execution failed"));
                }
            }
        }

        printSummary(passed, total);
    }
}`,
    test_cases: [
      {
        input_display: 'prices = [7,1,5,3,6,4]',
        input_payload: JSON.stringify({ prices: [7, 1, 5, 3, 6, 4] }),
        expected_output: '5',
        is_hidden: 0,
        sort_order: 1,
      },
      {
        input_display: 'prices = [7,6,4,3,1]',
        input_payload: JSON.stringify({ prices: [7, 6, 4, 3, 1] }),
        expected_output: '0',
        is_hidden: 0,
        sort_order: 2,
      },
      {
        input_display: 'prices = [1,2]',
        input_payload: JSON.stringify({ prices: [1, 2] }),
        expected_output: '1',
        is_hidden: 1,
        sort_order: 3,
      },
      {
        input_display: 'prices = [2,4,1]',
        input_payload: JSON.stringify({ prices: [2, 4, 1] }),
        expected_output: '2',
        is_hidden: 1,
        sort_order: 4,
      },
      {
        input_display: 'prices = [3,2,6,5,0,3]',
        input_payload: JSON.stringify({ prices: [3, 2, 6, 5, 0, 3] }),
        expected_output: '4',
        is_hidden: 1,
        sort_order: 5,
      },
    ],
  },

  // 5. Maximum Subarray
  {
    slug: 'maximum-subarray',
    title: 'Maximum Subarray',
    difficulty: 'Medium',
    description_md: `# Maximum Subarray

Given an integer array \`nums\`, find the subarray with the largest sum, and return *its sum*.

A **subarray** is a contiguous non-empty sequence of elements within an array.

### Example 1:
\`\`\`
Input: nums = [-2,1,-3,4,-1,2,1,-5,4]
Output: 6
Explanation: The subarray [4,-1,2,1] has the largest sum 6.
\`\`\`

### Example 2:
\`\`\`
Input: nums = [1]
Output: 1
Explanation: The subarray [1] has the largest sum 1.
\`\`\`

### Example 3:
\`\`\`
Input: nums = [5,4,-1,7,8]
Output: 23
Explanation: The subarray [5,4,-1,7,8] has the largest sum 23.
\`\`\`

### Constraints:
* \`1 <= nums.length <= 10^5\`
* \`-10^4 <= nums[i] <= 10^4\`
`,
    starter_code: `class Solution {
    public int maxSubArray(int[] nums) {
        // Write your solution here
        return 0;
    }
}`,
    test_harness_code: `import java.util.*;

public class Main {
${HARNESS_HELPER_METHODS}

    public static void main(String[] args) {
        boolean visibleOnly = args.length > 0 && ("--visible-only".equals(args[0]) || "run".equalsIgnoreCase(args[0]) || "--run".equalsIgnoreCase(args[0]));
        Solution sol = new Solution();
        int passed = 0;
        int total = visibleOnly ? 2 : 5;

        // Test 0 (Visible)
        {
            int testIndex = 0;
            String input = "nums = [-2,1,-3,4,-1,2,1,-5,4]";
            String expected = "6";
            try {
                int[] nums = {-2, 1, -3, 4, -1, 2, 1, -5, 4};
                int res = sol.maxSubArray(nums);
                String actual = String.valueOf(res);
                boolean ok = (res == 6);
                if (ok) passed++;
                printResult(testIndex, ok, input, expected, actual, null);
            } catch (Throwable t) {
                printResult(testIndex, false, input, expected, null, t.getClass().getSimpleName() + ": " + (t.getMessage() != null ? t.getMessage() : "Execution failed"));
            }
        }

        // Test 1 (Visible)
        {
            int testIndex = 1;
            String input = "nums = [1]";
            String expected = "1";
            try {
                int[] nums = {1};
                int res = sol.maxSubArray(nums);
                String actual = String.valueOf(res);
                boolean ok = (res == 1);
                if (ok) passed++;
                printResult(testIndex, ok, input, expected, actual, null);
            } catch (Throwable t) {
                printResult(testIndex, false, input, expected, null, t.getClass().getSimpleName() + ": " + (t.getMessage() != null ? t.getMessage() : "Execution failed"));
            }
        }

        if (!visibleOnly) {
            // Test 2 (Hidden)
            {
                int testIndex = 2;
                String input = "nums = [5,4,-1,7,8]";
                String expected = "23";
                try {
                    int[] nums = {5, 4, -1, 7, 8};
                    int res = sol.maxSubArray(nums);
                    String actual = String.valueOf(res);
                    boolean ok = (res == 23);
                    if (ok) passed++;
                    printResult(testIndex, ok, input, expected, actual, null);
                } catch (Throwable t) {
                    printResult(testIndex, false, input, expected, null, t.getClass().getSimpleName() + ": " + (t.getMessage() != null ? t.getMessage() : "Execution failed"));
                }
            }

            // Test 3 (Hidden)
            {
                int testIndex = 3;
                String input = "nums = [-1]";
                String expected = "-1";
                try {
                    int[] nums = {-1};
                    int res = sol.maxSubArray(nums);
                    String actual = String.valueOf(res);
                    boolean ok = (res == -1);
                    if (ok) passed++;
                    printResult(testIndex, ok, input, expected, actual, null);
                } catch (Throwable t) {
                    printResult(testIndex, false, input, expected, null, t.getClass().getSimpleName() + ": " + (t.getMessage() != null ? t.getMessage() : "Execution failed"));
                }
            }

            // Test 4 (Hidden)
            {
                int testIndex = 4;
                String input = "nums = [-2,-1]";
                String expected = "-1";
                try {
                    int[] nums = {-2, -1};
                    int res = sol.maxSubArray(nums);
                    String actual = String.valueOf(res);
                    boolean ok = (res == -1);
                    if (ok) passed++;
                    printResult(testIndex, ok, input, expected, actual, null);
                } catch (Throwable t) {
                    printResult(testIndex, false, input, expected, null, t.getClass().getSimpleName() + ": " + (t.getMessage() != null ? t.getMessage() : "Execution failed"));
                }
            }
        }

        printSummary(passed, total);
    }
}`,
    test_cases: [
      {
        input_display: 'nums = [-2,1,-3,4,-1,2,1,-5,4]',
        input_payload: JSON.stringify({ nums: [-2, 1, -3, 4, -1, 2, 1, -5, 4] }),
        expected_output: '6',
        is_hidden: 0,
        sort_order: 1,
      },
      {
        input_display: 'nums = [1]',
        input_payload: JSON.stringify({ nums: [1] }),
        expected_output: '1',
        is_hidden: 0,
        sort_order: 2,
      },
      {
        input_display: 'nums = [5,4,-1,7,8]',
        input_payload: JSON.stringify({ nums: [5, 4, -1, 7, 8] }),
        expected_output: '23',
        is_hidden: 1,
        sort_order: 3,
      },
      {
        input_display: 'nums = [-1]',
        input_payload: JSON.stringify({ nums: [-1] }),
        expected_output: '-1',
        is_hidden: 1,
        sort_order: 4,
      },
      {
        input_display: 'nums = [-2,-1]',
        input_payload: JSON.stringify({ nums: [-2, -1] }),
        expected_output: '-1',
        is_hidden: 1,
        sort_order: 5,
      },
    ],
  },
];

export function seedProblems(db: DatabaseInstance): void {
  const insertProblem = db.prepare(`
    INSERT INTO problems (slug, title, difficulty, description_md, starter_code, test_harness_code, created_at)
    VALUES (@slug, @title, @difficulty, @description_md, @starter_code, @test_harness_code, @created_at)
    ON CONFLICT(slug) DO UPDATE SET
      title = excluded.title,
      difficulty = excluded.difficulty,
      description_md = excluded.description_md,
      starter_code = excluded.starter_code,
      test_harness_code = excluded.test_harness_code
  `);

  const getProblemId = db.prepare(`SELECT id FROM problems WHERE slug = ?`);
  const deleteTestCases = db.prepare(`DELETE FROM test_cases WHERE problem_id = ?`);
  const insertTestCase = db.prepare(`
    INSERT INTO test_cases (problem_id, input_display, input_payload, expected_output, is_hidden, sort_order)
    VALUES (@problem_id, @input_display, @input_payload, @expected_output, @is_hidden, @sort_order)
  `);

  const seedTransaction = db.transaction(() => {
    for (const prob of PROBLEMS) {
      insertProblem.run({
        slug: prob.slug,
        title: prob.title,
        difficulty: prob.difficulty,
        description_md: prob.description_md,
        starter_code: prob.starter_code,
        test_harness_code: prob.test_harness_code,
        created_at: new Date().toISOString(),
      });

      const row = getProblemId.get(prob.slug) as { id: number };
      deleteTestCases.run(row.id);

      for (const tc of prob.test_cases) {
        insertTestCase.run({
          problem_id: row.id,
          input_display: tc.input_display,
          input_payload: tc.input_payload,
          expected_output: tc.expected_output,
          is_hidden: tc.is_hidden,
          sort_order: tc.sort_order,
        });
      }
    }
  });

  seedTransaction();
}
