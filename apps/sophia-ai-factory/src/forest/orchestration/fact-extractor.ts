export class FactExtractor {
  /**
   * Extracts structured facts from agent responses based on markers.
   * Pattern: "DECISION: key = value" or "CONSTRAINT: key = value"
   */
  static extractDecisions(text: string): Array<{ key: string; value: string }> {
    return this.parsePattern(text, /DECISION:\s*([\w.-]+)\s*=\s*(.+)/gi);
  }

  static extractConstraints(text: string): Array<{ key: string; value: string }> {
    return this.parsePattern(text, /CONSTRAINT:\s*([\w.-]+)\s*=\s*(.+)/gi);
  }

  static extractFindings(text: string): Array<{ key: string; value: string }> {
    return this.parsePattern(text, /FINDING:\s*([\w.-]+)\s*=\s*(.+)/gi);
  }

  private static parsePattern(text: string, regex: RegExp): Array<{ key: string; value: string }> {
    const facts: Array<{ key: string; value: string }> = [];
    let match;

    // Reset regex state for global flag
    regex.lastIndex = 0;

    while ((match = regex.exec(text)) !== null) {
      if (match[1] && match[2]) {
        facts.push({
          key: match[1].trim(),
          value: match[2].trim(),
        });
      }
    }
    return facts;
  }
}
