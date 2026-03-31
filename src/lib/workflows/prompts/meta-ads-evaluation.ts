export function getEvaluationPrompt(stepId: string): string {
  return `You are evaluating Meta Ads performance for step: ${stepId}. Provide your assessment based on the data provided. If you suggest action items, format each as:\nACTION: [specific action]\nPRIORITY: [CRITICAL/HIGH/MEDIUM]\nOWNER: [AGENCY/DIRECTOR/JOINT]`;
}
