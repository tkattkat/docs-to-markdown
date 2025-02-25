

export class TokenEstimator {
  
  static estimateTokenCount(text: string): number {
    if (!text) return 0;

    const charCount = text.length;
    const wordCount = text.split(/\s+/).length;

    return Math.ceil((charCount / 4 + wordCount / 0.75) / 2);
  }

  static wouldExceedLimit(current: number, tokensToAdd: number, limit: number): boolean {
    return (current + tokensToAdd > limit);
  }
}

export default TokenEstimator; 