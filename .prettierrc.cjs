// Codifies the formatting the codebase already uses (semicolons, double
// quotes) rather than forcing a repo-wide reformat. printWidth is a target
// for new code — plenty of existing dense one-liner JSX is intentionally
// wider than this and was left alone rather than auto-wrapped.
module.exports = {
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  printWidth: 120,
  trailingComma: "all",
};
