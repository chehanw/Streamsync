/**
 * International Prostate Symptom Score (IPSS) Questionnaire
 *
 * The IPSS is a validated 8-question instrument for assessing
 * lower urinary tract symptoms (LUTS) in men with BPH.
 *
 * Scoring:
 * - Questions 1-7: 0-5 scale (symptom frequency)
 * - Question 8 (QoL): 0-6 scale (quality of life)
 * - Total IPSS Score: 0-35 (sum of Q1-Q7)
 *   - Mild: 0-7
 *   - Moderate: 8-19
 *   - Severe: 20-35
 *
 * Reference: Barry MJ, et al. The American Urological Association
 * Symptom Index for Benign Prostatic Hyperplasia. J Urol. 1992.
 */

import type { Questionnaire } from 'fhir/r4';
import { QuestionnaireBuilder } from '@spezivibe/questionnaire';

/**
 * Standard IPSS frequency answer options (0-5)
 */
const FREQUENCY_OPTIONS = [
  { value: 0, display: 'Not at all' },
  { value: 1, display: 'Less than 1 time in 5' },
  { value: 2, display: 'Less than half the time' },
  { value: 3, display: 'About half the time' },
  { value: 4, display: 'More than half the time' },
  { value: 5, display: 'Almost always' },
];

/**
 * Quality of Life answer options (0-6)
 */
const QOL_OPTIONS = [
  { value: 0, display: 'Delighted' },
  { value: 1, display: 'Pleased' },
  { value: 2, display: 'Mostly satisfied' },
  { value: 3, display: 'Mixed - about equally satisfied and dissatisfied' },
  { value: 4, display: 'Mostly dissatisfied' },
  { value: 5, display: 'Unhappy' },
  { value: 6, display: 'Terrible' },
];

/**
 * IPSS Questionnaire - FHIR R4 compliant
 */
export const IPSS_QUESTIONNAIRE: Questionnaire = new QuestionnaireBuilder('ipss')
  .title('International Prostate Symptom Score (IPSS)')
  .description(
    'Please answer the following questions about your urinary symptoms over the past month.'
  )
  .version('1.0.0')
  .addDisplay(
    'instructions',
    'For each question, select the answer that best describes your experience over the past month.'
  )
  // Question 1: Incomplete Emptying
  .addChoice('q1_incomplete_emptying',
    'Over the past month, how often have you had a sensation of not emptying your bladder completely after you finished urinating?',
    {
      required: true,
      answerOption: FREQUENCY_OPTIONS,
    }
  )
  // Question 2: Frequency
  .addChoice('q2_frequency',
    'Over the past month, how often have you had to urinate again less than two hours after you finished urinating?',
    {
      required: true,
      answerOption: FREQUENCY_OPTIONS,
    }
  )
  // Question 3: Intermittency
  .addChoice('q3_intermittency',
    'Over the past month, how often have you found you stopped and started again several times when you urinated?',
    {
      required: true,
      answerOption: FREQUENCY_OPTIONS,
    }
  )
  // Question 4: Urgency
  .addChoice('q4_urgency',
    'Over the past month, how often have you found it difficult to postpone urination?',
    {
      required: true,
      answerOption: FREQUENCY_OPTIONS,
    }
  )
  // Question 5: Weak Stream
  .addChoice('q5_weak_stream',
    'Over the past month, how often have you had a weak urinary stream?',
    {
      required: true,
      answerOption: FREQUENCY_OPTIONS,
    }
  )
  // Question 6: Straining
  .addChoice('q6_straining',
    'Over the past month, how often have you had to push or strain to begin urination?',
    {
      required: true,
      answerOption: FREQUENCY_OPTIONS,
    }
  )
  // Question 7: Nocturia
  .addChoice('q7_nocturia',
    'Over the past month, how many times did you most typically get up to urinate from the time you went to bed at night until the time you got up in the morning?',
    {
      required: true,
      answerOption: [
        { value: 0, display: 'None' },
        { value: 1, display: '1 time' },
        { value: 2, display: '2 times' },
        { value: 3, display: '3 times' },
        { value: 4, display: '4 times' },
        { value: 5, display: '5 or more times' },
      ],
    }
  )
  // Question 8: Quality of Life
  .addChoice('q8_quality_of_life',
    'If you were to spend the rest of your life with your urinary condition just the way it is now, how would you feel about that?',
    {
      required: true,
      answerOption: QOL_OPTIONS,
    }
  )
  .build();

/**
 * Calculate IPSS total score from questionnaire response
 */
export function calculateIPSSScore(answers: Record<string, number>): {
  totalScore: number;
  qolScore: number;
  severity: 'mild' | 'moderate' | 'severe';
} {
  // Sum questions 1-7
  const symptomQuestions = [
    'q1_incomplete_emptying',
    'q2_frequency',
    'q3_intermittency',
    'q4_urgency',
    'q5_weak_stream',
    'q6_straining',
    'q7_nocturia',
  ];

  const totalScore = symptomQuestions.reduce((sum, q) => {
    const value = answers[q];
    return sum + (typeof value === 'number' ? value : 0);
  }, 0);

  const qolScore = answers['q8_quality_of_life'] ?? 0;

  // Determine severity
  let severity: 'mild' | 'moderate' | 'severe';
  if (totalScore <= 7) {
    severity = 'mild';
  } else if (totalScore <= 19) {
    severity = 'moderate';
  } else {
    severity = 'severe';
  }

  return { totalScore, qolScore, severity };
}

/**
 * Get a human-readable description of the IPSS severity
 */
export function getIPSSSeverityDescription(severity: 'mild' | 'moderate' | 'severe'): string {
  switch (severity) {
    case 'mild':
      return 'Your symptoms are mild. Continue monitoring and discuss with your healthcare provider at your next visit.';
    case 'moderate':
      return 'Your symptoms are moderate. Consider discussing treatment options with your healthcare provider.';
    case 'severe':
      return 'Your symptoms are severe. We recommend consulting with your healthcare provider about treatment options.';
  }
}
